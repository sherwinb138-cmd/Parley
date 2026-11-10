// Pricing. Plain code, no AI. Given the kind of complaint and the order amount, it produces
// two or three settlement options. A full refund is always one of them.
//   path "accept_claim": the seller's full refund closes the PayPal dispute directly.
//   path "make_offer":   the seller sends a partial-refund offer; the buyer accepts it on PayPal.
// The AI never chooses an amount and never sends anything; a person picks an option and clicks.
import type { SettlementOption } from "@/lib/case/types";
import type { ComplaintType } from "@/lib/ai/policy";

const PARTIALS: Record<ComplaintType, Array<{ id: string; share: number; label: string; rationale: string }>> = {
  item_not_received: [
    {
      id: "partial_50",
      share: 0.5,
      label: "Half back now, buyer keeps the parcel if it arrives",
      rationale: "Shares the risk of a parcel that may still be in transit. The buyer is partly refunded at once and keeps the item if it turns up.",
    },
  ],
  not_as_described: [
    {
      id: "partial_40",
      share: 0.4,
      label: "Buyer keeps the item with 40% back",
      rationale: "Reflects a clear difference from the listing without the cost and delay of a return.",
    },
    {
      id: "partial_20",
      share: 0.2,
      label: "Buyer keeps the item with 20% back",
      rationale: "Reflects a small difference from the listing. No return is needed.",
    },
  ],
  changed_mind: [
    {
      id: "partial_25",
      share: 0.25,
      label: "Goodwill: buyer keeps the item with 25% back",
      rationale: "The item matches its description, so this is a goodwill gesture. No return is needed.",
    },
    {
      id: "partial_10",
      share: 0.1,
      label: "Goodwill: buyer keeps the item with 10% back",
      rationale: "A smaller goodwill gesture for an item that matches its description.",
    },
  ],
  other: [
    {
      id: "partial_50",
      share: 0.5,
      label: "Meet in the middle: half back",
      rationale: "Splits the amount in dispute evenly.",
    },
  ],
};

const FULL_RATIONALE: Record<ComplaintType, string> = {
  item_not_received: "The buyer gets the full amount back. The seller's refund closes the PayPal dispute at once.",
  not_as_described: "The buyer gets the full amount back. PayPal's published rules say a buyer may be asked to return the item at their own cost in such cases.",
  changed_mind: "The buyer gets the full amount back. The two sides arrange any return between themselves.",
  other: "The buyer gets the full amount back. The seller's refund closes the PayPal dispute at once.",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function priceOptions(complaint: ComplaintType, orderAmount: number, maxOfferUsd = Number(process.env.MAX_OFFER_USD || 200)): SettlementOption[] {
  const options: SettlementOption[] = [
    { id: "full", label: "Full refund", amount: round2(orderAmount), path: "accept_claim", rationale: FULL_RATIONALE[complaint] },
  ];
  for (const p of PARTIALS[complaint]) {
    const amount = round2(orderAmount * p.share);
    if (amount < 1 || amount > maxOfferUsd) continue;
    options.push({ id: p.id, label: p.label, amount, path: "make_offer", rationale: p.rationale });
  }
  return options;
}
