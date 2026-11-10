"use client";
// The settlement options, priced by plain code. Level 8 adds the buttons that act on them.
import type { CaseBundle } from "@/lib/case/types";
import { usd } from "./ui";

export function Options({ bundle }: { bundle: CaseBundle }) {
  const options = bundle.policy?.options || [];
  if (!options.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">Ways to settle</h2>
        <p className="text-sm text-stone-600">Amounts are set by fixed rules in code, not by AI. Escalating to PayPal stays available at any time.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {options.map((o) => (
          <div key={o.id} className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-2xl font-semibold tracking-tight">{usd(o.amount)}</p>
            <p className="text-sm font-medium">{o.label}</p>
            <p className="text-sm text-stone-600">{o.rationale}</p>
            <p className="mt-auto pt-2 text-xs text-stone-500">
              {o.path === "accept_claim" ? "Closes in Parley: the seller's refund ends the PayPal dispute." : "Seller sends this offer from Parley. The buyer accepts it on PayPal."}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
