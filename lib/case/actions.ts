// The three settlement actions. Each runs only after a click by the right person, and each asks PayPal
// what is allowed right now before it does anything.
//
//   agree   buyer    "I would accept this option." Saved in Parley with the case-file fingerprint. Moves no money.
//   offer   seller   Sends a partial-refund offer on the PayPal dispute. The buyer accepts or declines it on PayPal.
//   settle  seller   After the buyer agreed to a full refund: refunds in full, which closes the PayPal dispute.
//
// No AI is involved here. Amounts come from the priced options (lib/settle/price.ts), never from the request.
import { getCase, getPolicyCheck, listEvidence, updateCase } from "@/lib/db/cases";
import { acceptClaimFullRefund, can, getDispute, makeOffer, type Dispute } from "@/lib/paypal/disputes";
import { offerState, syncNow } from "./bundle";
import { caseFingerprint } from "./fingerprint";
import type { CaseRow, SettlementOption } from "./types";

/** A refusal the person should read as-is, for example "PayPal does not allow an offer right now". */
export class ActionRefused extends Error {
  constructor(message: string, public status = 409) {
    super(message);
  }
}

const maxUsd = () => Number(process.env.MAX_OFFER_USD || 200);

// One action per case at a time, so a double click cannot send two offers or two refunds.
const busy = new Set<string>();
async function oneAtATime<T>(caseId: string, job: () => Promise<T>): Promise<T> {
  if (busy.has(caseId)) throw new ActionRefused("Another action on this case is still running. Please wait a moment.");
  busy.add(caseId);
  try {
    return await job();
  } finally {
    busy.delete(caseId);
  }
}

async function openCase(caseId: string): Promise<CaseRow> {
  const c = await getCase(caseId);
  if (!c) throw new ActionRefused("Case not found.", 404);
  if (c.is_replay) throw new ActionRefused("This is a replay of a finished case. Its actions are switched off.");
  if (c.paypal_status === "RESOLVED") throw new ActionRefused("This case is already resolved on PayPal.");
  return c;
}

async function findOption(caseId: string, optionId: string): Promise<SettlementOption> {
  const policy = await getPolicyCheck(caseId);
  const option = policy?.options.find((o) => o.id === optionId);
  if (!option) throw new ActionRefused("That option does not exist for this case. Run the analysis first.", 400);
  if (option.amount > maxUsd()) throw new ActionRefused(`This demo moves at most $${maxUsd()} per case.`);
  return option;
}

function statusText(d: Dispute): string {
  return d.status.replace(/_/g, " ").toLowerCase();
}

/** Buyer: agree to an option, or pass null to withdraw the agreement. */
export async function agree(caseId: string, optionId: string | null): Promise<void> {
  const c = await openCase(caseId);
  if (optionId === null) {
    await updateCase(c.id, { agreed_option: null, agreed_at: null, agreed_fingerprint: null });
    return;
  }
  const option = await findOption(c.id, optionId);
  const fp = caseFingerprint(await listEvidence(c.id));
  await updateCase(c.id, { agreed_option: option.id, agreed_at: new Date().toISOString(), agreed_fingerprint: fp });
}

/** Seller: send a partial-refund offer on PayPal. The seller's message travels inside the offer note. */
export async function sendOffer(caseId: string, optionId: string, message: string): Promise<void> {
  await oneAtATime(caseId, async () => {
    const c = await openCase(caseId);
    const option = await findOption(c.id, optionId);
    if (option.path !== "make_offer") throw new ActionRefused("A full refund is not sent as an offer. Use the full-refund option.", 400);
    if (option.amount >= Number(c.amount)) throw new ActionRefused("A partial offer must be lower than the order amount.", 400);
    if (offerState(await listEvidence(c.id)).state === "pending") throw new ActionRefused("An offer is already waiting for the buyer on PayPal.");

    const dispute = await getDispute(c.paypal_dispute_id);
    const types = dispute.allowed_response_options?.make_offer?.offer_types;
    if (!can(dispute, "make_offer") || (types && !types.includes("REFUND"))) {
      throw new ActionRefused(`PayPal does not allow a refund offer on this case right now (PayPal status: ${statusText(dispute)}).`);
    }

    const note = (message.trim() || `Offer made through Parley: ${option.label}.`).slice(0, 1000);
    await makeOffer(c.paypal_dispute_id, { currency_code: c.currency || "USD", value: option.amount.toFixed(2) }, note);
    console.log(`[action] offer ${option.amount.toFixed(2)} sent on ${c.paypal_dispute_id}`);
    await updateCase(c.id, { offer_amount: option.amount });
    syncNow(c.id);
  });
}

/** Seller: confirm the full refund the buyer agreed to. PayPal refunds the buyer and closes the dispute. */
export async function settleFullRefund(caseId: string): Promise<void> {
  await oneAtATime(caseId, async () => {
    const c = await openCase(caseId);
    const option = await findOption(c.id, "full");
    if (c.agreed_option !== "full" || !c.agreed_at) {
      throw new ActionRefused("The buyer has not agreed to a full refund in Parley yet.");
    }

    const dispute = await getDispute(c.paypal_dispute_id);
    const types = dispute.allowed_response_options?.accept_claim?.accept_claim_types;
    if (!can(dispute, "accept_claim") || (types && !types.includes("REFUND"))) {
      throw new ActionRefused(`PayPal does not allow a full-refund close on this case right now (PayPal status: ${statusText(dispute)}).`);
    }

    const note = `Buyer agreed in Parley to a full refund on ${c.agreed_at.slice(0, 16).replace("T", " ")} UTC (case-file fingerprint ${(c.agreed_fingerprint || "").slice(0, 12)}). Seller confirmed.`;
    await acceptClaimFullRefund(c.paypal_dispute_id, note);
    console.log(`[action] full refund ${option.amount.toFixed(2)} confirmed on ${c.paypal_dispute_id}`);
    syncNow(c.id);
  });
}
