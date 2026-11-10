"use client";
// The Policy check card: which published PayPal rule applies, what it implies for cases like this,
// and what evidence is missing. It is never a prediction of PayPal's decision.
import type { CaseBundle } from "@/lib/case/types";
import { ruleById } from "@/lib/ai/rules";
import { EvidenceId, PAYPAL_RULE_PAGES } from "./ui";

// The reason the buyer picked on PayPal, next to what the buyer's own words are about.
const REASON_TO_TYPE: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "item_not_received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "not_as_described",
};
const TYPE_LABEL: Record<string, string> = {
  item_not_received: "an item that did not arrive",
  not_as_described: "an item that differs from its description",
  changed_mind: "a change of mind about the purchase",
};

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

      {p.complaint_type && TYPE_LABEL[p.complaint_type] && REASON_TO_TYPE[bundle.case.reason] && REASON_TO_TYPE[bundle.case.reason] !== p.complaint_type && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          The reason chosen on PayPal and the buyer&apos;s own words point to different things. In the evidence, the buyer describes{" "}
          {TYPE_LABEL[p.complaint_type]}. The rules and options below follow the buyer&apos;s words. Both sides can check this against the case file.
        </p>
      )}

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
              <p className="mt-1 text-xs text-stone-500">
                Source:{" "}
                <a href={PAYPAL_RULE_PAGES[rule.source].url} target="_blank" rel="noreferrer" className="text-blue-800 underline underline-offset-2">
                  {PAYPAL_RULE_PAGES[rule.source].name}
                </a>
              </p>
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

      <p className="text-xs text-stone-600">
        Read the rules yourself on PayPal:{" "}
        {Object.values(PAYPAL_RULE_PAGES).map((page, i) => (
          <span key={page.url}>
            {i > 0 && " · "}
            <a href={page.url} target="_blank" rel="noreferrer" className="text-blue-800 underline underline-offset-2">{page.name}</a>
          </span>
        ))}
        . The rule texts above are Parley&apos;s short wording of those pages (read 10 Nov 2026).
      </p>

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
