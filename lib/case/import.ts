// Import: turns PayPal's records for one dispute into a Parley case with numbered evidence.
//
//   PayPal dispute + payment + order  ->  case row  +  E1 order, E2 payment, E3 tracking, E4 dispute, messages, offers
//
// Running it again on the same dispute is safe: it updates the case status and adds only what is new.
import { getDispute, allowedActions, type Dispute } from "@/lib/paypal/disputes";
import { paypalFetch } from "@/lib/paypal/token";
import { addEvidence, listEvidence, updateEvidenceBody, upsertCase, type NewEvidence } from "@/lib/db/cases";
import { fingerprint } from "./fingerprint";
import type { CaseRow } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function money(m?: { currency_code?: string; value?: string } | null): string {
  if (!m?.value) return "unknown amount";
  return m.currency_code === "USD" ? `$${m.value}` : `${m.value} ${m.currency_code}`;
}

export function when(iso?: string | null): string {
  if (!iso) return "unknown date";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return (
    d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
  );
}

const REASONS: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Item not as described",
  UNAUTHORISED: "Unauthorized payment",
  CREDIT_NOT_PROCESSED: "Refund not processed",
  DUPLICATE_TRANSACTION: "Charged twice",
  INCORRECT_AMOUNT: "Wrong amount charged",
  CANCELED_RECURRING_BILLING: "Cancelled subscription still billed",
  OTHER: "Other",
};

export function reasonLabel(code: string): string {
  return REASONS[code] || code.replace(/_/g, " ").toLowerCase();
}

/** Fetch the payment (capture) and the order behind a dispute. Either may be missing; the import copes. */
async function fetchPaymentAndOrder(dispute: Dispute): Promise<{ capture: any | null; order: any | null }> {
  const tx = dispute.disputed_transactions?.[0];
  const ids = [tx?.seller_transaction_id, tx?.buyer_transaction_id].filter(Boolean) as string[];
  for (const id of ids) {
    try {
      const capture: any = await paypalFetch("GET", `/v2/payments/captures/${id}`);
      const orderId = capture?.supplementary_data?.related_ids?.order_id;
      let order: any = null;
      if (orderId) {
        try {
          order = await paypalFetch("GET", `/v2/checkout/orders/${orderId}`);
        } catch {
          order = null;
        }
      }
      return { capture, order };
    } catch {
      // try the next ID
    }
  }
  return { capture: null, order: null };
}

/** "Living" records can change over time (tracking gets added). They are updated in place, keyed by title. */
const LIVING_TITLES = { order: "Order record", payment: "Payment record", tracking: "Shipping and tracking record", dispute: "Dispute record" };

function buildRecords(dispute: Dispute, capture: any | null, order: any | null): NewEvidence[] {
  const tx = dispute.disputed_transactions?.[0];
  const unit = order?.purchase_units?.[0];
  const items: NewEvidence[] = [];

  // Order
  const itemName = unit?.description || unit?.items?.[0]?.name || tx?.items?.[0]?.item_name || tx?.items?.[0]?.item_description;
  const addr = unit?.shipping?.address;
  const shipTo = addr
    ? [unit?.shipping?.name?.full_name, addr.address_line_1, addr.admin_area_2, addr.admin_area_1, addr.postal_code, addr.country_code].filter(Boolean).join(", ")
    : null;
  const orderLines = [
    order?.id ? `Order ${order.id}.` : "Order details were not available from PayPal.",
    itemName ? `Item: ${itemName}.` : null,
    `Order amount: ${money(unit?.amount || tx?.gross_amount || dispute.dispute_amount)}.`,
    order?.create_time ? `Ordered on ${when(order.create_time)}.` : null,
    tx?.buyer?.name || order?.payer?.name?.given_name ? `Buyer: ${tx?.buyer?.name || [order?.payer?.name?.given_name, order?.payer?.name?.surname].filter(Boolean).join(" ")}.` : null,
    tx?.seller?.name ? `Seller: ${tx.seller.name}.` : null,
    shipTo ? `Ship to: ${shipTo}.` : null,
  ].filter(Boolean);
  items.push({ source: "paypal", kind: "order", title: LIVING_TITLES.order, body: orderLines.join(" "), occurred_at: order?.create_time || tx?.create_time || null });

  // Payment
  if (capture) {
    const sp = capture.seller_protection;
    const funding = order?.payment_source ? Object.keys(order.payment_source)[0] : null;
    const payLines = [
      `Payment ${capture.id} of ${money(capture.amount)} has status ${capture.status}.`,
      capture.create_time ? `Paid on ${when(capture.create_time)}.` : null,
      funding ? `Paid with: ${funding === "paypal" ? "PayPal account" : funding}.` : null,
      sp?.status
        ? `PayPal Seller Protection status recorded at payment: ${sp.status}${sp.dispute_categories?.length ? ` for ${sp.dispute_categories.join(" and ")}` : ""}.`
        : null,
    ].filter(Boolean);
    items.push({ source: "paypal", kind: "payment", title: LIVING_TITLES.payment, body: payLines.join(" "), occurred_at: capture.create_time || null });
  }

  // Tracking
  const trackers: any[] = unit?.shipping?.trackers || [];
  const trackLines = trackers.length
    ? trackers.map((t) => {
        const number = String(t.id || "").split("-").slice(1).join("-") || t.id;
        return `Tracking number ${number} was added to the order${t.create_time ? ` on ${when(t.create_time)}` : ""}. PayPal tracking status: ${t.status || "unknown"}. No delivery confirmation is recorded in PayPal.`;
      })
    : ["No tracking number has been added to this order in PayPal. No proof of shipment or delivery is on file in PayPal."];
  items.push({ source: "paypal", kind: "tracking", title: LIVING_TITLES.tracking, body: trackLines.join(" "), occurred_at: trackers[0]?.create_time || null });

  // Dispute (only facts that do not change; the live status sits on the case itself)
  const disputeLines = [
    `Dispute ${dispute.dispute_id} was opened by the buyer on ${when(dispute.create_time)}.`,
    `Reason given: ${reasonLabel(dispute.reason)} (${dispute.reason}).`,
    `Amount in dispute: ${money(dispute.dispute_amount)}.`,
    dispute.offer?.buyer_requested_amount ? `Refund the buyer asked for: ${money(dispute.offer.buyer_requested_amount)}.` : null,
  ].filter(Boolean);
  items.push({ source: "paypal", kind: "dispute", title: LIVING_TITLES.dispute, body: disputeLines.join(" "), occurred_at: dispute.create_time });

  return items;
}

function buildEvents(dispute: Dispute): NewEvidence[] {
  const items: NewEvidence[] = [];
  for (const m of dispute.messages || []) {
    const who = m.posted_by === "BUYER" ? "buyer" : m.posted_by === "SELLER" ? "seller" : null;
    if (!who || !m.content) continue;
    items.push({
      source: who,
      kind: "message",
      title: `${who === "buyer" ? "Buyer" : "Seller"} message on PayPal, ${when(m.time_posted)}`,
      body: m.content,
      occurred_at: m.time_posted,
    });
  }
  for (const h of dispute.offer?.history || []) {
    const actor = h.actor === "SELLER" ? "Seller" : h.actor === "BUYER" ? "Buyer" : h.actor;
    const verb = h.event_type === "PROPOSED" ? "proposed" : h.event_type === "ACCEPTED" ? "accepted" : h.event_type === "DENIED" ? "declined" : h.event_type.toLowerCase();
    const what = h.offer_amount ? `a ${h.offer_type === "REFUND" ? "refund" : h.offer_type || "refund"} offer of ${money(h.offer_amount)}` : "the offer";
    items.push({
      source: "paypal",
      kind: "offer",
      title: `Offer ${verb} by ${actor.toLowerCase()}, ${when(h.offer_time)}`,
      body: `${actor} ${verb} ${what} on ${when(h.offer_time)}.`,
      occurred_at: h.offer_time,
    });
  }
  if (dispute.status === "RESOLVED" && dispute.dispute_outcome) {
    const o = dispute.dispute_outcome;
    items.push({
      source: "paypal",
      kind: "outcome",
      title: "Dispute closed on PayPal",
      body: `PayPal closed the dispute. Outcome: ${o.outcome_code}${o.outcome_reason ? ` (${o.outcome_reason})` : ""}.${o.amount_refunded ? ` Amount refunded to the buyer: ${money(o.amount_refunded)}.` : ""}`,
      occurred_at: dispute.update_time || null,
    });
  }
  return items;
}

/** Import a dispute as a new case, or bring an existing case up to date with PayPal. */
export async function syncCaseFromPayPal(disputeId: string): Promise<{ caseRow: CaseRow; allowed: string[]; added: number }> {
  const dispute = await getDispute(disputeId);
  const { capture, order } = await fetchPaymentAndOrder(dispute);
  const tx = dispute.disputed_transactions?.[0];
  const unit = order?.purchase_units?.[0];

  const caseRow = await upsertCase({
    paypal_dispute_id: dispute.dispute_id,
    order_id: order?.id ?? null,
    capture_id: capture?.id ?? tx?.seller_transaction_id ?? null,
    reason: dispute.reason,
    amount: Number(dispute.dispute_amount?.value || 0),
    currency: dispute.dispute_amount?.currency_code || "USD",
    paypal_status: dispute.status,
    paypal_stage: dispute.dispute_life_cycle_stage ?? null,
    item_name: unit?.description || unit?.items?.[0]?.name || tx?.items?.[0]?.item_name || null,
    buyer_name: tx?.buyer?.name ?? null,
    seller_name: tx?.seller?.name ?? null,
    outcome: dispute.dispute_outcome ?? null,
  });

  const existing = await listEvidence(caseRow.id);
  let added = 0;

  for (const rec of buildRecords(dispute, capture, order)) {
    const prior = existing.find((e) => e.source === "paypal" && e.title === rec.title);
    if (!prior) {
      await addEvidence(caseRow.id, rec);
      added++;
    } else if (prior.sha256 !== fingerprint(rec.body ?? "")) {
      await updateEvidenceBody(caseRow.id, prior.id, rec.body ?? "");
      added++;
    }
  }
  for (const ev of buildEvents(dispute)) {
    if (existing.some((e) => e.title === ev.title && e.source === ev.source)) continue;
    await addEvidence(caseRow.id, ev);
    added++;
  }

  return { caseRow, allowed: allowedActions(dispute), added };
}
