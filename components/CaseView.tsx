"use client";
// One case, as seen by the buyer or the seller. Both see the same facts; each side gets its own buttons under "Ways to settle".
// It reloads from PayPal every 15 seconds so new messages, offers and status changes appear by themselves.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CaseBundle, Party } from "@/lib/case/types";
import { CaseFile } from "./CaseFile";
import { ClaimMap } from "./ClaimMap";
import { Options } from "./Options";
import { PolicyCheck } from "./PolicyCheck";
import { StatusChip, usd } from "./ui";

const REASON: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Item not as described",
};

export function CaseView({ caseId, role }: { caseId: string; role: Party }) {
  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  async function analyze(force = false) {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/analyze${force ? "?force=1" : ""}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The analysis failed.");
      setBundle(data);
    } catch (e) {
      setAnalyzeError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}?sync=1`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load the case.");
      setBundle(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [caseId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  if (error && !bundle) return <Shell><p className="text-red-700">{error}</p></Shell>;
  if (!bundle) return <Shell><p className="text-stone-500">Loading the case from PayPal…</p></Shell>;

  const c = bundle.case;
  const other: Party = role === "buyer" ? "seller" : "buyer";

  return (
    <Shell>
      <header className="flex flex-col gap-3 border-b border-stone-200 pb-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-stone-900 px-3 py-1 font-medium text-white">{role === "buyer" ? "Buyer view" : "Seller view"}</span>
          <Link href={`/case/${c.id}/${other}`} className="text-stone-500 underline-offset-4 hover:underline">
            Switch to the {other} view
          </Link>
          <span className="ml-auto"><StatusChip status={c.paypal_status} /></span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{c.item_name || "Order"} · {usd(c.amount)}</h1>
        <p className="text-sm text-stone-600">
          {REASON[c.reason] || c.reason.replace(/_/g, " ").toLowerCase()} · PayPal case <span className="font-mono">{c.paypal_dispute_id}</span>
          {c.buyer_name ? ` · Buyer: ${c.buyer_name}` : ""}{c.seller_name ? ` · Seller: ${c.seller_name}` : ""}
        </p>
        {error && <p className="text-sm text-amber-700">Could not refresh from PayPal just now. Showing the saved case file.</p>}
      </header>

      {(() => {
        const stale = bundle.policy && bundle.policy.evidence_fingerprint !== bundle.fingerprint;
        return (
          <section className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-4">
            <p className="min-w-0 flex-1 text-sm text-stone-700">
              {!bundle.policy && "AI can read the case file, link each claim to its evidence, and check PayPal's published rules."}
              {bundle.policy && !stale && "The analysis below matches the current case file."}
              {stale && "The case file has changed since this analysis. Run it again to include the new evidence."}
            </p>
            <button
              onClick={() => analyze(Boolean(bundle.policy && !stale))}
              disabled={analyzing}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {analyzing ? "Reading the evidence… (up to a minute)" : bundle.policy ? "Run the analysis again" : "Organize the facts"}
            </button>
            {analyzeError && <p className="w-full text-sm text-red-700">{analyzeError}</p>}
          </section>
        );
      })()}

      <PolicyCheck bundle={bundle} />
      <ClaimMap bundle={bundle} />
      <Options bundle={bundle} role={role} onBundle={setBundle} />
      <CaseFile bundle={bundle} role={role} onChanged={load} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <Link href="/" className="font-mono text-sm text-stone-500 hover:text-stone-900">← Parley</Link>
      {children}
    </main>
  );
}
