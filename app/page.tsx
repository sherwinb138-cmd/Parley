// Home screen: what Parley is, the finished cases (replays), the live cases with the judges' button, and the import box.
import Link from "next/link";
import { DemoStart } from "@/components/DemoStart";
import { ImportForm } from "@/components/ImportForm";
import { StatusChip, usd } from "@/components/ui";
import { listCases } from "@/lib/db/cases";
import type { CaseRow } from "@/lib/case/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let cases: CaseRow[] = [];
  let loadError: string | null = null;
  try {
    cases = await listCases();
  } catch (e) {
    loadError = (e as Error).message;
  }

  const replays = cases.filter((c) => c.is_replay);
  const live = cases.filter((c) => !c.is_replay);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <section className="flex flex-col gap-4">
        <p className="font-mono text-sm text-stone-500">Parley · sandbox prototype</p>
        <h1 className="text-4xl font-semibold tracking-tight">AI organizes the facts. People decide. PayPal settles.</h1>
        <p className="text-lg text-pretty text-stone-600">
          One shared case file for both sides of a PayPal dispute, with every claim linked to its evidence.
        </p>
        <p className="max-w-lg text-sm text-pretty text-stone-600">
          A prototype of a capability PayPal could add to its Resolution Center, built on PayPal&apos;s sandbox with test money only. Here one person can open both the buyer view and the seller view; in a real version each side would be identified through their PayPal login.
        </p>
      </section>

      {loadError && <p className="text-sm text-red-700">{loadError}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Finished cases</h2>
        <p className="text-sm text-stone-600">Real sandbox disputes settled through Parley, kept as replays. Open either side to see the shared case file, the claim-to-evidence map and how the case closed on PayPal.</p>
        {!loadError && replays.length === 0 && <p className="text-sm text-stone-500">No finished cases have been saved yet.</p>}
        <CaseList cases={replays} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Live cases</h2>
        <DemoStart />
        <CaseList cases={live} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Import a dispute from PayPal</h2>
        <p className="text-sm text-stone-600">Parley starts when a buyer opens a dispute in PayPal. Enter its case ID to open the shared case file.</p>
        <ImportForm />
      </section>
    </main>
  );
}

const REASON: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Item not as described",
};

/** One line that tells what the case was about and how it ended, from PayPal's own outcome. */
function story(c: CaseRow): string {
  const about = REASON[c.reason] || "Dispute";
  if (c.paypal_status !== "RESOLVED") return about;
  const refunded = Number(c.outcome?.amount_refunded?.value || 0);
  if (!refunded) return `${about} · closed on PayPal`;
  if (refunded >= Number(c.amount)) return `${about} · settled by a full refund of ${usd(refunded)}${c.agreed_option === "full" ? ", agreed in Parley" : ""}`;
  return `${about} · settled by the seller's offer of ${usd(refunded)}, accepted on PayPal`;
}

function CaseList({ cases }: { cases: CaseRow[] }) {
  if (!cases.length) return null;
  return (
    <ul className="flex flex-col gap-2">
      {cases.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-balance [overflow-wrap:anywhere]">{c.item_name || "Order"}{" ·\u00a0"}{usd(c.amount)}</p>
            {story(c) && <p className="text-sm text-stone-600">{story(c)}</p>}
            <p className="font-mono text-xs text-stone-500">{c.paypal_dispute_id}</p>
          </div>
          <StatusChip status={c.paypal_status} />
          <Link href={`/case/${c.id}/buyer`} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100">Buyer view</Link>
          <Link href={`/case/${c.id}/seller`} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100">Seller view</Link>
        </li>
      ))}
    </ul>
  );
}
