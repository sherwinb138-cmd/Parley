// The rules brief: the only PayPal rules the AI is allowed to cite, each with an ID.
// Every rule is taken from PayPal's own published pages (read on 10 Nov 2026), not from memory:
//   Buyer side:  https://www.paypal.com/us/legalhub/paypal/buyer-protection
//   Seller side: https://www.paypal.com/us/legalhub/paypal/seller-protection
// The Policy check may cite these IDs and nothing else. It explains what a rule implies
// "for cases like this"; it never predicts PayPal's decision.

export type Rule = { id: string; title: string; text: string; source: "buyer-protection" | "seller-protection" };

export const RULES: Rule[] = [
  {
    id: "R1",
    title: "Item not received: what defeats the buyer's claim",
    source: "buyer-protection",
    text: "A buyer's Item Not Received claim does not qualify under Purchase Protection when the seller has provided proof of shipment or delivery. Proof of delivery is confirmation that can be viewed online and shows the delivery address (at least city and state, or ZIP code), the delivery date and the shipping company.",
  },
  {
    id: "R2",
    title: "Item not received: what the seller needs for Seller Protection",
    source: "seller-protection",
    text: 'For an Item Not Received claim, Seller Protection requires the seller to provide proof of delivery: an online and verifiable tracking number, the date of shipment, a recipient address matching the shipping address on the Transaction Details page, and a date of delivery with "delivered" status.',
  },
  {
    id: "R3",
    title: "What counts as proof of shipment",
    source: "seller-protection",
    text: "Proof of shipment for a physical item must include an online and verifiable tracking number, the date of shipment, and a recipient address that matches the shipping address on the Transaction Details page (at least city and state, city and country, or postal code).",
  },
  {
    id: "R4",
    title: "What 'Significantly Not as Described' means",
    source: "buyer-protection",
    text: "An item may be Significantly Not as Described if it is materially different from the seller's description, a completely different item was received, its condition was misrepresented, it was advertised as authentic but is not, it is missing major parts or features that were not disclosed, fewer items arrived than were purchased, it was damaged during shipment, or it is unusable as received and that was not disclosed.",
  },
  {
    id: "R5",
    title: "What is not 'Significantly Not as Described'",
    source: "buyer-protection",
    text: "An item may not qualify as Significantly Not as Described if the defect was correctly described by the seller, if the buyer simply no longer wants the item, or if the item was accurately described but did not meet the buyer's expectations.",
  },
  {
    id: "R6",
    title: "Seller Protection does not cover 'not as described' claims",
    source: "seller-protection",
    text: "Seller Protection does not apply to items where the buyer claims that the item sent is not what was ordered (Significantly Not as Described claims).",
  },
  {
    id: "R7",
    title: "Time limits",
    source: "buyer-protection",
    text: "A buyer must open an Item Not Received dispute within 180 days of payment, and a Significantly Not as Described dispute within 30 days of delivery or 180 days of payment, whichever is sooner. A dispute must be escalated to a claim within 20 days of opening, or PayPal closes it automatically.",
  },
  {
    id: "R8",
    title: "What a decision in the buyer's favour covers",
    source: "buyer-protection",
    text: "When a claim is decided in the buyer's favour, coverage can be the full purchase price plus the original shipping costs paid. The buyer may be required to return the item at the buyer's own expense and provide proof of delivery for the return; return shipping costs are not covered.",
  },
  {
    id: "R9",
    title: "Seller Protection basics",
    source: "seller-protection",
    text: "To be eligible for Seller Protection the item must be a physical good that can be shipped, the seller must ship to the shipping address on the Transaction Details page, respond to PayPal's requests for documentation in a timely manner, and provide valid proof of shipment or delivery.",
  },
];

export const RULE_IDS = RULES.map((r) => r.id);

export function rulesBrief(): string {
  return RULES.map((r) => `${r.id} (${r.title}): ${r.text}`).join("\n");
}

export function ruleById(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id);
}
