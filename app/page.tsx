// Home screen: what Parley is, the finished cases (replays), the live cases with the judges' button, and the import box.
import Link from "next/link";
import { DemoStart } from "@/components/DemoStart";
import { ImportForm } from "@/components/ImportForm";
import { Reveal } from "@/components/Reveal";
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-14">
      <section className="grid items-end gap-x-14 gap-y-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <p className="font-mono text-sm text-stone-500">Parley · sandbox prototype</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance">
            <Reveal step={70} blue>AI organizes the facts. People decide. PayPal settles.</Reveal>
          </h1>
          <p className="text-lg text-pretty text-stone-600">
            <Reveal delay={650} step={25}>One shared case file for both sides of a PayPal dispute, with every claim linked to its evidence.</Reveal>
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-stone-600">Open a PayPal dispute by its case ID.</p>
          <ImportForm />
        </div>
      </section>

      {loadError && <p className="text-sm text-red-700">{loadError}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-3xl bg-panel p-6">
          <h2 className="text-base font-bold uppercase tracking-widest">Finished cases</h2>
          {!loadError && replays.length === 0 && <p className="text-sm text-stone-500">No finished cases have been saved yet.</p>}
          <CaseList cases={replays} />
        </section>

        <section className="flex flex-col gap-4 rounded-3xl bg-panel p-6 lg:self-start">
          <h2 className="text-base font-bold uppercase tracking-widest">Live cases</h2>
          <DemoStart />
          <CaseList cases={live} />
        </section>
      </div>

      <p className="max-w-lg text-xs text-pretty text-stone-500">
        A sandbox prototype of a capability PayPal could add to its Resolution Center.
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
  if (refunded >= Number(c.amount)) return `${about} · full refund of ${usd(refunded)}`;
  return `${about} · settled for ${usd(refunded)}`;
}

function CaseList({ cases }: { cases: CaseRow[] }) {
  if (!cases.length) return null;
  return (
    <ul className="flex flex-col gap-2">
      {cases.map((c) => (
        <li key={c.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium [overflow-wrap:anywhere]">
                {itemName(c)}
                <span className="font-normal text-stone-500">{" ·\u00a0"}{usd(c.amount)}</span>
              </p>
              {story(c) && <p className="text-sm text-pretty text-stone-500">{story(c)}</p>}
            </div>
            <StatusChip status={c.paypal_status} />
          </div>
          <Link href={`/case/${c.id}`} className="w-fit rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700">Open case</Link>
        </li>
      ))}
    </ul>
  );
}

/** The item without the shop's name after the dash, so each row reads as one short title. */
function itemName(c: CaseRow): string {
  return (c.item_name || "Order").split(" - ")[0];
}
