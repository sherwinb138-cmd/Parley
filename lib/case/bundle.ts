// Loads everything a screen needs to show one case, as a single "bundle".
// With sync on, it first brings the case up to date with PayPal (new messages, offers, status).
import { getCase, getPolicyCheck, listClaims, listEvidence } from "@/lib/db/cases";
import { caseFingerprint } from "./fingerprint";
import { syncCaseFromPayPal } from "./import";
import type { CaseBundle, EvidenceRow, OfferState } from "./types";

const lastSync = new Map<string, number>();
const lastAllowed = new Map<string, string[]>(); // what PayPal allowed at the last sync, per case
const SYNC_EVERY_MS = 10_000;

/** After an action (offer, refund) the next load must ask PayPal again at once. */
export function syncNow(caseId: string) {
  lastSync.delete(caseId);
}

/** The latest offer event in the case file tells where the offer stands. These events come from PayPal's offer history. */
export function offerState(evidence: EvidenceRow[]): OfferState {
  const offers = evidence.filter((e) => e.kind === "offer" && e.source === "paypal").sort((a, b) => (a.occurred_at || "").localeCompare(b.occurred_at || ""));
  const last = offers[offers.length - 1];
  if (!last) return { state: "none", amount: null };
  // The amount sits on the "proposed" event; accept and decline events may not repeat it.
  const withAmount = [...offers].reverse().find((e) => /\$\d/.test(e.body || ""));
  const amount = Number(withAmount?.body?.match(/\$(\d+(?:\.\d+)?)/)?.[1] ?? NaN);
  const verb = last.title.match(/^Offer (\w+)/)?.[1];
  const state = verb === "proposed" ? "pending" : verb === "accepted" ? "accepted" : verb === "declined" ? "declined" : "none";
  return { state, amount: Number.isFinite(amount) ? amount : null };
}

export async function loadBundle(caseId: string, opts: { sync?: boolean } = {}): Promise<CaseBundle | null> {
  let caseRow = await getCase(caseId);
  if (!caseRow) return null;

  const due = Date.now() - (lastSync.get(caseId) || 0) > SYNC_EVERY_MS;
  if (opts.sync && due) {
    try {
      const synced = await syncCaseFromPayPal(caseRow.paypal_dispute_id);
      caseRow = synced.caseRow;
      lastAllowed.set(caseId, synced.allowed);
      lastSync.set(caseId, Date.now());
    } catch (e) {
      // PayPal being slow or down must not hide the saved case file.
      console.error("[bundle] PayPal sync failed:", (e as Error).message);
    }
  }

  const [evidence, { claims, links }, policy] = await Promise.all([listEvidence(caseId), listClaims(caseId), getPolicyCheck(caseId)]);
  return {
    case: caseRow,
    evidence,
    claims,
    links,
    policy,
    fingerprint: caseFingerprint(evidence),
    allowed: lastAllowed.get(caseId) || [],
    offer: offerState(evidence),
  };
}
