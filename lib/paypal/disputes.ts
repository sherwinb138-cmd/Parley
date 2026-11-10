// PayPal Customer Disputes API v1, raw REST, seller side only.
// Verified in the sandbox on 10 Nov 2026 (see CLAUDE.md, "Current status"):
//  - the buyer opens the dispute in PayPal's Resolution Center; Parley only reads it
//  - make-offer must go out BEFORE any send-message (a message hands the turn to the buyer)
//  - accept-claim accepts only a full REFUND at the inquiry stage
import { paypalFetch } from "./token";

export type Money = { currency_code: string; value: string };

export type DisputeMessage = { posted_by: "BUYER" | "SELLER" | string; time_posted: string; content: string };

export type Dispute = {
  dispute_id: string;
  create_time: string;
  update_time?: string;
  reason: string;
  status: string;
  dispute_life_cycle_stage?: string;
  dispute_amount: Money;
  dispute_outcome?: { outcome_code: string; outcome_reason?: string; amount_refunded?: Money };
  disputed_transactions?: Array<{
    seller_transaction_id?: string;
    buyer_transaction_id?: string;
    gross_amount?: Money;
    invoice_number?: string;
    custom?: string;
    buyer?: { name?: string };
    seller?: { name?: string; merchant_id?: string };
    items?: Array<{ item_name?: string; item_description?: string }>;
    seller_protection_eligible?: boolean;
    create_time?: string;
  }>;
  messages?: DisputeMessage[];
  offer?: {
    buyer_requested_amount?: Money;
    seller_offered_amount?: Money;
    offer_type?: string;
    history?: Array<{ offer_time: string; actor: string; event_type: string; offer_type?: string; offer_amount?: Money }>;
  };
  refund_details?: { allowed_refund_amount?: Money; transactions?: Array<{ id: string; gross_amount: Money; create_time: string }> };
  allowed_response_options?: { accept_claim?: { accept_claim_types?: string[] }; make_offer?: { offer_types?: string[] } };
  seller_response_due_date?: string;
  buyer_response_due_date?: string;
  links?: Array<{ rel: string; href: string; method: string }>;
};

export type DisputeAction = "send_message" | "make_offer" | "accept_claim" | "provide_evidence" | "escalate";

/** Which actions PayPal allows right now, read from the dispute's HATEOAS links. */
export function allowedActions(d: Dispute): DisputeAction[] {
  return (d.links || []).map((l) => l.rel).filter((r) => r !== "self") as DisputeAction[];
}

export function can(d: Dispute, action: DisputeAction): boolean {
  return allowedActions(d).includes(action);
}

/** The list endpoint lags a few minutes behind new disputes; getDispute by ID works at once. */
export async function listDisputes(): Promise<Dispute[]> {
  const data = await paypalFetch<{ items?: Dispute[] }>("GET", "/v1/customer/disputes?page_size=20");
  return (data.items || []).sort((a, b) => (a.create_time < b.create_time ? 1 : -1));
}

export async function getDispute(id: string): Promise<Dispute> {
  return paypalFetch<Dispute>("GET", `/v1/customer/disputes/${encodeURIComponent(id)}`);
}

export async function sendMessage(id: string, message: string) {
  return paypalFetch("POST", `/v1/customer/disputes/${encodeURIComponent(id)}/send-message`, { message });
}

/** Seller proposes a partial refund. The buyer accepts or declines in PayPal's Resolution Center. */
export async function makeOffer(id: string, amount: Money, note: string) {
  return paypalFetch("POST", `/v1/customer/disputes/${encodeURIComponent(id)}/make-offer`, {
    note,
    offer_amount: amount,
    offer_type: "REFUND",
  });
}

/** Seller accepts the claim with a full refund. PayPal refunds the buyer and closes the dispute. */
export async function acceptClaimFullRefund(id: string, note: string) {
  return paypalFetch("POST", `/v1/customer/disputes/${encodeURIComponent(id)}/accept-claim`, {
    note,
    accept_claim_type: "REFUND",
  });
}
