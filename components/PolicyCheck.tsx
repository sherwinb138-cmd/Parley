"use client";
// The Policy check card: which published PayPal rule applies, what it implies for cases like this,
// and what evidence is missing. It is never a prediction of PayPal's decision.
import type { CaseBundle } from "@/lib/case/types";
import { ruleById } from "@/lib/ai/rules";
import { EvidenceId } from "./ui";

export function PolicyCheck({ bundle }: { bundle: CaseBundle }) {
  const p = bundle.policy;
  if (!p) return null;
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50/50 p-5">
      <div>
        <h2 className="text-lg font-semibold">Policy check</h2>
        <p className="text-sm text-stone-600">Based on PayPal&apos;s published protection rules. Not PayPal&apos;s decision.</p>
      </div>

      {p.summary && <p className="text-sm leading-relaxed text-stone-800">{p.summary}</p>}

      <div className="flex flex-col gap-2">
        {p.rule_ids.map((id) => {
          const rule = ruleById(id);
          if (!rule) return null;
          return (
            <details key={id} className="rounded-lg border border-blue-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium">
                <span className="mr-2 rounded bg-blue-900 px-1.5 py-0.5 font-mono text-xs text-white">{id}</span>
                {rule.title}
              </summary>
              <p className="mt-2 text-sm text-stone-700">{rule.text}</p>
              <p className="mt-1 text-xs text-stone-500">Source: PayPal {rule.source === "buyer-protection" ? "Purchase Protection" : "Seller Protection"} page</p>
            </details>
          );
        })}
      </div>

      <div>
        <h3 className="text-sm font-semibold">What this implies for cases like this</h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-800">{p.implication}</p>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
          Relies on {p.evidence_ids.map((id) => <a key={id} href={`#evidence-${id}`}><EvidenceId id={id} /></a>)}
        </p>
      </div>

      {p.missing_evidence.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Evidence that is not on file</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-stone-800">
            {p.missing_evidence.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}

      {p.checker && (
        <p className="border-t border-blue-200 pt-3 text-xs text-stone-500">
          Checked by code: {p.checker.links_verified} quote{p.checker.links_verified === 1 ? "" : "s"} verified against the evidence
          {p.checker.links_removed > 0 ? `, ${p.checker.links_removed} removed because the quote or evidence ID could not be verified` : ", none removed"}.
          {p.model ? ` Model: ${p.model}.` : ""}
        </p>
      )}
    </section>
  );
}
