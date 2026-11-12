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
  const live = cases.filter((c) => !c.is_replay && c.paypal_status !== "RESOLVED");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 py-16">
      <section className="flex flex-col gap-4">
        <p className="font-mono text-sm text-stone-500">Parley · sandbox prototype</p>
        <h1 className="text-4xl font-semibold tracking-tight">AI organizes the facts. People decide. PayPal settles.</h1>
        <p className="text-lg text-pretty text-stone-600">
          One shared case file for both sides of a PayPal dispute, with every claim linked to its evidence.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm text-stone-600">Parley starts when a buyer opens a dispute in PayPal. Enter its case ID to open the shared case file.</p>
          <ImportForm />
        </div>
      </section>

      {loadError && <p className="text-sm text-red-700">{loadError}</p>}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-500">Finished cases</h2>
          <p className="mt-1 text-sm text-stone-600">Real sandbox disputes settled through Parley. Open one to see both sides.</p>
        </div>
        {!loadError && replays.length === 0 && <p className="text-sm text-stone-500">No finished cases have been saved yet.</p>}
        <CaseList cases={replays} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-500">Live cases</h2>
        <DemoStart />
        <CaseList cases={live} />
      </section>

      <p className="max-w-lg border-t border-stone-200 pt-6 text-xs text-pretty text-stone-500">
        A sandbox prototype of a capability PayPal could add to its Resolution Center. Open any case and enter as the buyer or as the seller to see both sides of the same case file.
      </p>
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
    <ul className="divide-y divide-stone-200 border-y border-stone-200">
      {cases.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
          <div className="min-w-0 flex-1 basis-64">
            <p className="font-medium [overflow-wrap:anywhere]">
              {itemName(c)}
              <span className="font-normal text-stone-500">{" ·\u00a0"}{usd(c.amount)}</span>
            </p>
            {story(c) && <p className="text-sm text-pretty text-stone-600">{story(c)}</p>}
          </div>
          <StatusChip status={c.paypal_status} />
          <Link href={`/case/${c.id}`} className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700">Open case</Link>
        </li>
      ))}
    </ul>
  );
}

/** The item without the shop's name after the dash, so each row reads as one short title. */
function itemName(c: CaseRow): string {
  return (c.item_name || "Order").split(" - ")[0];
}
