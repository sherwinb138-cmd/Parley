// Home screen: what Parley is, the list of cases, and the box to import a PayPal dispute.
import Link from "next/link";
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <section className="flex flex-col gap-4">
        <p className="font-mono text-sm text-stone-500">Parley · sandbox prototype</p>
        <h1 className="text-4xl font-semibold tracking-tight">AI organizes the facts. People decide. PayPal settles.</h1>
        <p className="text-lg text-stone-600">
          One shared case file for both sides of a PayPal dispute, with every claim linked to its evidence.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Import a dispute from PayPal</h2>
        <p className="text-sm text-stone-600">Parley starts when a buyer opens a dispute in PayPal. Enter its case ID to open the shared case file.</p>
        <ImportForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Cases</h2>
        {loadError && <p className="text-sm text-red-700">{loadError}</p>}
        {!loadError && cases.length === 0 && <p className="text-sm text-stone-500">No cases yet. Import a dispute to begin.</p>}
        <ul className="flex flex-col gap-2">
          {cases.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.item_name || "Order"} · {usd(c.amount)}</p>
                <p className="font-mono text-xs text-stone-500">{c.paypal_dispute_id}</p>
              </div>
              <StatusChip status={c.paypal_status} />
              <Link href={`/case/${c.id}/buyer`} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100">Buyer view</Link>
              <Link href={`/case/${c.id}/seller`} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100">Seller view</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
