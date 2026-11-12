"use client";
// "Ways to settle": the options priced by plain code, with each side's buttons.
//   Buyer:  "I would accept this" (saved in Parley, moves no money).
//   Seller: "Send this offer" (partial refund offer on PayPal) or "Confirm full refund" (closes the PayPal dispute).
// The server checks every click again with PayPal, so a button here can never do more than PayPal allows.
import { useState } from "react";
import type { CaseBundle, Party, SettlementOption } from "@/lib/case/types";
import { Hl } from "./Reveal";
import { RESOLUTION_CENTER_URL, TONE, shortDate, usd } from "./ui";

type Props = { bundle: CaseBundle; role: Party; onBundle: (b: CaseBundle) => void };

export function Options({ bundle, role, onBundle }: Props) {
  const options = bundle.policy?.options || [];
  const c = bundle.case;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!options.length) return null;

  const resolved = c.paypal_status === "RESOLVED";
  const locked = resolved || c.is_replay;

  /** One click = one call to a route. Shows a spinner on that button and any refusal in plain words. */
  async function act(key: string, path: "agree" | "offer" | "settle", body: object = {}) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${c.id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That did not work. Please try again.");
      onBundle(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">Ways to settle</h2>
        <p className="text-sm text-stone-600"><Hl>Amounts are set by fixed rules in code, not by AI. Nothing is sent to PayPal until a person clicks.</Hl></p>
      </div>

      <Progress bundle={bundle} role={role} />
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {options.map((o) => (
          <div key={o.id} className={`flex flex-col gap-2 rounded-2xl p-5 ${c.agreed_option === o.id ? "bg-emerald-50 ring-2 ring-emerald-300" : "bg-stone-100/80"}`}>
            <p className="text-2xl font-semibold tracking-tight">{usd(o.amount)}</p>
            <p className="text-sm font-medium">{o.label}</p>
            <p className="text-sm text-stone-600"><Hl>{o.rationale}</Hl></p>
            <div className="mt-auto flex flex-col gap-2 pt-2">
              {!locked && role === "buyer" && <BuyerAction o={o} bundle={bundle} busy={busy} act={act} />}
              {!locked && role === "seller" && <SellerAction o={o} bundle={bundle} busy={busy} act={act} />}
              <p className="text-xs text-stone-500">
                <Hl>{o.path === "accept_claim"
                  ? "Buyer agrees in Parley. The seller's refund closes the PayPal dispute."
                  : "Seller sends this offer from Parley. The buyer accepts it on PayPal."}</Hl>
              </p>
            </div>
          </div>
        ))}
      </div>

      {!resolved && (
        <p className="text-sm text-stone-600">
          No agreement? Either side can ask <span className="font-medium text-paypal">PayPal</span> to step in at any time:{" "}
          <a href={RESOLUTION_CENTER_URL} target="_blank" rel="noreferrer" className="font-medium text-paypal underline underline-offset-4">
            escalate this case in PayPal&apos;s Resolution Center
          </a>
          . The case file stays available to both sides.
        </p>
      )}
    </section>
  );
}

type ActFn = (key: string, path: "agree" | "offer" | "settle", body?: object) => void;
const primary = "rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50";
const sellerBtn = `${primary} ${TONE.seller.solid} ${TONE.seller.hover}`;
const quiet = "rounded-lg bg-white px-3 py-2 text-sm font-medium hover:bg-stone-200 disabled:opacity-50";

/** The line at the top that says where the settlement stands, in words both sides can act on. */
function Progress({ bundle, role }: { bundle: CaseBundle; role: Party }) {
  const c = bundle.case;
  const { offer } = bundle;
  const box = "rounded-xl p-3 text-sm";
  if (c.paypal_status === "RESOLVED") {
    const refunded = c.outcome?.amount_refunded?.value;
    return (
      <p className={`${box} bg-emerald-50 text-emerald-900`}>
        <strong>Resolved on <span className="text-paypal">PayPal</span>.</strong>
        {refunded ? ` ${usd(refunded)} was refunded to the buyer.` : ""}
        {c.agreed_option === "full" && offer.state !== "accepted" ? " Buyer agreed in Parley. Seller's refund closed the PayPal dispute." : ""}
        {offer.state === "accepted" ? " The buyer accepted the seller's offer on PayPal." : ""}
      </p>
    );
  }
  if (c.is_replay) return null;
  if (offer.state === "pending") {
    return (
      <p className={`${box} bg-paypal-soft text-stone-800`}>
        <strong>An offer{offer.amount ? ` of ${usd(offer.amount)}` : ""} is waiting for the buyer on PayPal.</strong>{" "}
        {role === "buyer" ? "Accept or decline it in " : "The buyer accepts or declines it in "}
        <a href={RESOLUTION_CENTER_URL} target="_blank" rel="noreferrer" className="font-medium text-paypal underline underline-offset-4">PayPal&apos;s Resolution Center</a>. This page updates by itself.
      </p>
    );
  }
  if (offer.state === "declined") {
    return <p className={`${box} bg-amber-100/70 text-amber-900`}>The buyer declined the last offer on PayPal. Another option can still be agreed below.</p>;
  }
  if (c.agreed_option) {
    const changed = c.agreed_fingerprint && c.agreed_fingerprint !== bundle.fingerprint;
    return (
      <p className={`${box} bg-emerald-50 text-emerald-900`}>
        <strong>The buyer agreed to an option in Parley</strong> on {shortDate(c.agreed_at)}, on case file{" "}
        <span className="font-mono text-xs">{(c.agreed_fingerprint || "").slice(0, 12)}</span>.
        {changed ? " Evidence has been added since then." : ""} {role === "seller" ? "It is your move." : "Waiting for the seller."}
      </p>
    );
  }
  return null;
}

function BuyerAction({ o, bundle, busy, act }: { o: SettlementOption; bundle: CaseBundle; busy: string | null; act: ActFn }) {
  const c = bundle.case;
  if (bundle.offer.state === "pending") return null; // the banner above tells the buyer to answer on PayPal
  if (c.agreed_option === o.id) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900">You agreed to this</span>
        <button className="text-xs text-stone-500 underline underline-offset-4" disabled={busy !== null} onClick={() => act(`un-${o.id}`, "agree", { option_id: null })}>
          {busy === `un-${o.id}` ? "Withdrawing…" : "Withdraw"}
        </button>
      </div>
    );
  }
  return (
    <button className={`${primary} ${TONE.buyer.solid} ${TONE.buyer.hover}`} disabled={busy !== null} onClick={() => act(o.id, "agree", { option_id: o.id })}>
      {busy === o.id ? "Saving…" : o.path === "accept_claim" ? "Agree to a full refund" : "I would accept this"}
    </button>
  );
}

function SellerAction({ o, bundle, busy, act }: { o: SettlementOption; bundle: CaseBundle; busy: string | null; act: ActFn }) {
  const c = bundle.case;
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(
    `Hello, this is ${c.seller_name || "the seller"}. We both see the same case file in Parley. I would like to offer a refund of ${usd(o.amount)}: ${o.label.toLowerCase()}.`
  );
  const agreed = c.agreed_option === o.id;
  // PayPal's own list of allowed actions. When it is known and the action is missing, the button is switched off.
  const known = bundle.allowed.length > 0;
  const action = o.path === "accept_claim" ? "accept_claim" : "make_offer";
  const blocked = known && !bundle.allowed.includes(action);

  if (bundle.offer.state === "pending") return null;
  if (blocked) return <p className="text-xs text-amber-800">PayPal does not allow this step right now. It may be the buyer&apos;s turn, or PayPal may be updating the case.</p>;

  if (o.path === "accept_claim") {
    if (!agreed) return <p className="text-xs text-stone-600">Waiting for the buyer to agree to this in Parley.</p>;
    if (!open) return <button className={sellerBtn} disabled={busy !== null} onClick={() => setOpen(true)}>Confirm full refund</button>;
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-white p-3">
        <p className="text-sm">Refund {usd(o.amount)} to the buyer now? PayPal moves the money and closes the dispute. This cannot be undone.</p>
        <div className="flex gap-2">
          <button className={sellerBtn} disabled={busy !== null} onClick={() => act(o.id, "settle")}>{busy === o.id ? "Asking PayPal…" : `Yes, refund ${usd(o.amount)}`}</button>
          <button className={quiet} disabled={busy !== null} onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {agreed && <span className="w-fit rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900">The buyer said they would accept this</span>}
      {!open && <button className={agreed ? sellerBtn : quiet} disabled={busy !== null} onClick={() => setOpen(true)}>Send this offer</button>}
      {open && (
        <div className="flex flex-col gap-2 rounded-xl bg-white p-3">
          <label className="text-xs font-medium text-stone-600" htmlFor={`msg-${o.id}`}>Your message to the buyer (sent inside the PayPal offer)</label>
          <textarea id={`msg-${o.id}`} value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500" />
          <div className="flex gap-2">
            <button className={sellerBtn} disabled={busy !== null} onClick={() => act(o.id, "offer", { option_id: o.id, message })}>{busy === o.id ? "Asking PayPal…" : `Send offer of ${usd(o.amount)}`}</button>
            <button className={quiet} disabled={busy !== null} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
