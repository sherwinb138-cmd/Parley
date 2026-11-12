"use client";
// One case, as seen by the buyer or the seller. Both see the same facts; each side gets its own buttons under "Ways to settle".
// Left: what the case is and the short summary. Right: four tabs (claims, Policy check, ways to settle, case file).
// It reloads from PayPal every 15 seconds so new messages, offers and status changes appear by themselves.
import Link from "next/link";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import type { CaseBundle, Party } from "@/lib/case/types";
import { CaseFile } from "./CaseFile";
import { ClaimMap } from "./ClaimMap";
import { Options } from "./Options";
import { PolicyCheck } from "./PolicyCheck";
import { Hl, Reveal } from "./Reveal";
import { BOX, StatusChip, TONE, splitSummary, usd } from "./ui";

type Tab = "claims" | "rules" | "settle" | "file";
const TABS: { id: Tab; label: string }[] = [
  { id: "claims", label: "Claims" },
  { id: "rules", label: "Policy check" },
  { id: "settle", label: "Ways to settle" },
  { id: "file", label: "Case file" },
];

const REASON: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Item not as described",
};

export function CaseView({ caseId, role }: { caseId: string; role: Party }) {
  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null); // null = not chosen yet: claims once analysed, the case file before that

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
  const current: Tab = tab ?? (bundle.policy ? "claims" : "file");
  const stale = bundle.policy && bundle.policy.evidence_fingerprint !== bundle.fingerprint;

  /** A click on an evidence chip (E1, E2…) opens the case file tab and scrolls to that item. */
  function openEvidence(e: MouseEvent<HTMLDivElement>) {
    const link = (e.target as HTMLElement).closest("a");
    const href = link?.getAttribute("href") || "";
    if (!href.startsWith("#evidence-")) return;
    e.preventDefault();
    setTab("file");
    setTimeout(() => document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }

  return (
    <Shell>
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Left: the case and its short summary. It stays in view while the right side scrolls. */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-8 lg:self-start">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className={`rounded-full px-3 py-1 font-medium ${TONE[role].solid}`}>{role === "buyer" ? "Buyer view" : "Seller view"}</span>
              <Link href={`/case/${c.id}/${other}`} className="text-stone-500 underline-offset-4 hover:underline">
                Switch to the {other} view
              </Link>
              <span className="ml-auto"><StatusChip status={c.paypal_status} /></span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              <Reveal>{`${c.item_name || "Order"} ·\u00a0${usd(c.amount)}`}</Reveal>
            </h1>
            <p className="text-sm text-stone-600">
              {REASON[c.reason] || c.reason.replace(/_/g, " ").toLowerCase()} · <span className="font-medium text-paypal">PayPal</span> case <span className="font-mono">{c.paypal_dispute_id}</span>
              {c.buyer_name && <> · <span className={TONE.buyer.text}>Buyer: {c.buyer_name}</span></>}
              {c.seller_name && <> · <span className={TONE.seller.text}>Seller: {c.seller_name}</span></>}
            </p>
            {error && <p className="text-sm text-amber-700">Could not refresh from PayPal just now. Showing the saved case file.</p>}
          </header>

          {c.is_replay && (
            <p className={`${BOX} p-4 text-sm text-stone-700`}>
              <strong>Replay of a finished case.</strong> This is a real sandbox dispute that was settled through Parley. The analysis was saved when it ran, and the buttons are switched off.
            </p>
          )}

          {!(c.is_replay && bundle.policy) && (
            <section className={`${BOX} flex flex-col gap-3 p-4`}>
              <p className="text-sm text-stone-700">
                {!bundle.policy && <Hl>{"AI can read the case file, link each claim to its evidence, and check PayPal's published rules."}</Hl>}
                {bundle.policy && !stale && "The analysis matches the current case file."}
                {stale && "The case file has changed since this analysis. Run it again to include the new evidence."}
              </p>
              <button
                onClick={() => analyze(Boolean(bundle.policy && !stale))}
                disabled={analyzing}
                className="w-fit rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
              >
                {analyzing ? "Reading the evidence… (up to a minute)" : bundle.policy ? "Run the analysis again" : "Organize the facts"}
              </button>
              {analyzeError && <p className="text-sm text-red-700">{analyzeError}</p>}
            </section>
          )}

          {bundle.policy && <Overview summary={bundle.policy.summary} />}
        </div>

        {/* Right: four tabs. Every tab stays loaded, so nothing typed in a form is lost when switching. */}
        <div className="flex min-w-0 flex-col gap-5" onClick={openEvidence}>
          <div role="tablist" aria-label="Parts of this case" className="flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={current === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${current === t.id ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" id="panel-claims" aria-labelledby="tab-claims" hidden={current !== "claims"}>
            {bundle.claims.length ? <ClaimMap bundle={bundle} /> : <Empty />}
          </div>
          <div role="tabpanel" id="panel-rules" aria-labelledby="tab-rules" hidden={current !== "rules"}>
            {bundle.policy ? <PolicyCheck bundle={bundle} /> : <Empty />}
          </div>
          <div role="tabpanel" id="panel-settle" aria-labelledby="tab-settle" hidden={current !== "settle"}>
            {bundle.policy?.options.length ? <Options bundle={bundle} role={role} onBundle={setBundle} /> : <Empty />}
          </div>
          <div role="tabpanel" id="panel-file" aria-labelledby="tab-file" hidden={current !== "file"}>
            <CaseFile bundle={bundle} role={role} onChanged={load} />
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Empty() {
  return <p className={`${BOX} p-5 text-sm text-stone-600`}>Nothing here yet. Click &quot;Organize the facts&quot; on the left, and this tab fills in.</p>;
}

/** The first thing a reader sees after the analysis: one sentence, then a short neutral summary. */
function Overview({ summary }: { summary: string | null }) {
  const { inShort, rest } = splitSummary(summary);
  return (
    <section className={`${BOX} p-5`}>
      {inShort && (
        <>
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">In short</p>
          <p className="mt-1 text-lg font-medium leading-snug text-pretty"><Reveal delay={250} step={30}>{inShort}</Reveal></p>
        </>
      )}
      {rest && <p className={`text-sm leading-relaxed text-stone-700 ${inShort ? "mt-3" : ""}`}><Hl>{rest}</Hl></p>}
      <p className="mt-3 text-xs text-stone-500"><Hl>{"Written by AI from the case file for both sides. It is not PayPal's decision."}</Hl></p>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <Link href="/" className="font-mono text-sm text-stone-500 hover:text-stone-900">← Parley</Link>
      {children}
    </main>
  );
}
