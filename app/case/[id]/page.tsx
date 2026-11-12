// The entry screen of one case: two doors, "Enter as the buyer" and "Enter as the seller".
// There is no password. This is a sandbox prototype where one person can play both sides.
// In a real version each side would arrive already signed in through PayPal.
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusChip, usd } from "@/components/ui";
import { getCase } from "@/lib/db/cases";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Item not as described",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await getCase(id);
  if (!c) notFound();

  const doors = [
    {
      role: "buyer",
      who: c.buyer_name || "The buyer",
      title: "Enter as the buyer",
      can: "See the shared case file, add a statement or a photo, and say which option you would accept.",
    },
    {
      role: "seller",
      who: c.seller_name || "The seller",
      title: "Enter as the seller",
      can: "See the same case file, add a statement or a photo, and send an offer or confirm a refund.",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <Link href="/" className="font-mono text-sm text-stone-500 hover:text-stone-900">← Parley</Link>

      <header className="flex flex-col gap-2 border-b border-stone-200 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-sm text-stone-500">PayPal case {c.paypal_dispute_id}</p>
          <span className="ml-auto"><StatusChip status={c.paypal_status} /></span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{c.item_name || "Order"}{" · "}{usd(c.amount)}</h1>
        <p className="text-sm text-stone-600">{REASON[c.reason] || "Dispute"}{c.is_replay ? " · replay of a finished case" : ""}</p>
      </header>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Which side are you on?</h2>
          <p className="text-sm text-stone-600">Both sides see the same facts. Only the buttons differ.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {doors.map((d) => (
            <Link
              key={d.role}
              href={`/case/${c.id}/${d.role}`}
              className="group flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-5 hover:border-stone-900 focus-visible:border-stone-900 focus-visible:outline-none"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{d.role}</span>
              <span className="text-xl font-semibold tracking-tight">{d.who}</span>
              <span className="text-sm text-stone-600">{d.can}</span>
              <span className="mt-2 w-fit rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white group-hover:bg-stone-700">{d.title}</span>
            </Link>
          ))}
        </div>
        <p className="max-w-lg text-xs text-pretty text-stone-500">
          No password is needed here: this is a sandbox prototype, so one person can try both sides. In a real version each side would arrive already signed in through PayPal.
        </p>
      </section>
    </main>
  );
}
