// The entry screen of one case: two doors, "Enter as the buyer" and "Enter as the seller".
// There is no password. This is a sandbox prototype where one person can play both sides.
// In a real version each side would arrive already signed in through PayPal.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/Reveal";
import { StatusChip, TONE, usd } from "@/components/ui";
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
      role: "buyer" as const,
      who: c.buyer_name || "The buyer",
      title: "Enter as the buyer",
      can: "Add evidence and choose an option.",
    },
    {
      role: "seller" as const,
      who: c.seller_name || "The seller",
      title: "Enter as the seller",
      can: "Add evidence, send an offer or refund.",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <Link href="/" className="font-mono text-sm text-stone-500 hover:text-stone-900">← Parley</Link>

      <header className="flex flex-col gap-2 border-b border-stone-200 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-sm text-stone-500"><span className="font-medium text-paypal">PayPal</span> case {c.paypal_dispute_id}</p>
          <span className="ml-auto"><StatusChip status={c.paypal_status} /></span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{c.item_name || "Order"}{" · "}{usd(c.amount)}</h1>
        <p className="text-sm text-stone-600">{REASON[c.reason] || "Dispute"}{c.is_replay ? " · replay of a finished case" : ""}</p>
      </header>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold"><Reveal delay={350}>Which side are you on?</Reveal></h2>
          <p className="text-sm text-stone-600">Both sides see the same facts.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {doors.map((d) => (
            <Link
              key={d.role}
              href={`/case/${c.id}/${d.role}`}
              className={`group flex flex-col gap-2 rounded-2xl p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${TONE[d.role].soft}`}
            >
              <span className={`text-xs font-bold uppercase tracking-widest ${TONE[d.role].text}`}>{d.role}</span>
              <span className="text-xl font-semibold tracking-tight">{d.who}</span>
              <span className="text-sm text-stone-700">{d.can}</span>
              <span className={`mt-2 w-fit rounded-lg px-4 py-2 text-sm font-medium ${TONE[d.role].solid} group-hover:opacity-90`}>{d.title}</span>
            </Link>
          ))}
        </div>
        <p className="max-w-lg text-xs text-pretty text-stone-500">
          No password in this prototype. A real version would use the PayPal login.
        </p>
      </section>
    </main>
  );
}
