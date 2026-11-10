"use client";
// The claim-to-evidence map. Left: what each side claims. Right: the evidence linked to each claim,
// with a supports / contradicts badge and the exact quote. Both sides see the same map.
import type { CaseBundle, ClaimLinkRow, Party } from "@/lib/case/types";
import { EvidenceId } from "./ui";

export function ClaimMap({ bundle }: { bundle: CaseBundle }) {
  const { claims, links, evidence } = bundle;
  if (!claims.length) return null;
  const titleOf = (id: string) => evidence.find((e) => e.id === id)?.title || id;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Claims and their evidence</h2>
        <p className="text-sm text-stone-600">Organized by AI, then checked by code: every quote below was found word for word in the evidence it points to.</p>
      </div>
      {(["buyer", "seller"] as Party[]).map((party) => {
        const mine = claims.filter((c) => c.party === party);
        if (!mine.length) return null;
        return (
          <div key={party} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{party === "buyer" ? "The buyer says" : "The seller says"}</h3>
            {mine.map((c) => {
              const mineLinks = links.filter((l) => l.claim_id === c.id);
              return (
                <div key={c.id} className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 md:grid-cols-2">
                  <p className="text-sm font-medium leading-relaxed">
                    <span className="mr-2 font-mono text-xs text-stone-400">{c.id}</span>
                    {c.body}
                  </p>
                  <div className="flex flex-col gap-2">
                    {mineLinks.length === 0 && (
                      <span className="inline-flex w-fit rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">Unsupported: no evidence on file</span>
                    )}
                    {mineLinks.map((l) => (
                      <LinkCard key={l.evidence_id} link={l} title={titleOf(l.evidence_id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

function LinkCard({ link, title }: { link: ClaimLinkRow; title: string }) {
  const supports = link.relation === "supports";
  return (
    <a href={`#evidence-${link.evidence_id}`} className="block rounded-lg border border-stone-200 bg-stone-50 p-3 hover:border-stone-400">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${supports ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>
          {supports ? "Supports" : "Contradicts"}
        </span>
        <EvidenceId id={link.evidence_id} />
        <span className="truncate text-xs text-stone-600">{title}</span>
      </div>
      {link.quote && <p className="mt-2 border-l-2 border-stone-300 pl-3 text-sm italic text-stone-700">“{link.quote}”</p>}
      {link.quote_kind === "photo_description" && <p className="mt-1 text-xs text-stone-500">AI description of photo</p>}
    </a>
  );
}
