// Shared shapes for a Parley case. Used by the server routes and the screens.

export type Party = "buyer" | "seller";
export type EvidenceSource = "paypal" | Party;
export type EvidenceKind = "order" | "payment" | "tracking" | "dispute" | "message" | "offer" | "outcome" | "photo" | "statement";

export type CaseRow = {
  id: string;
  paypal_dispute_id: string;
  order_id: string | null;
  capture_id: string | null;
  reason: string;
  amount: number;
  currency: string;
  paypal_status: string;
  paypal_stage: string | null;
  item_name: string | null;
  buyer_name: string | null;
  seller_name: string | null;
  is_replay: boolean;
  agreed_option: string | null;
  agreed_at: string | null;
  agreed_fingerprint: string | null;
  offer_amount: number | null;
  outcome: { outcome_code?: string; outcome_reason?: string; amount_refunded?: { currency_code: string; value: string } } | null;
  created_at: string;
  updated_at: string;
};

export type EvidenceRow = {
  case_id: string;
  id: string; // E1, E2, ...
  source: EvidenceSource;
  kind: EvidenceKind;
  title: string;
  body: string | null;
  file_path: string | null;
  sha256: string;
  occurred_at: string | null;
  created_at: string;
};

export type ClaimRow = { case_id: string; id: string; party: Party; body: string };

export type ClaimLinkRow = {
  case_id: string;
  claim_id: string;
  evidence_id: string;
  relation: "supports" | "contradicts";
  quote: string | null;
  quote_kind: "text" | "photo_description";
};

export type SettlementOption = {
  id: string; // "full", "partial_50", ...
  label: string;
  amount: number;
  path: "accept_claim" | "make_offer";
  rationale: string;
};

export type PolicyCheckRow = {
  case_id: string;
  rule_ids: string[];
  implication: string;
  evidence_ids: string[];
  missing_evidence: string[];
  summary: string | null;
  options: SettlementOption[];
  evidence_fingerprint: string;
  model: string | null;
  created_at: string;
};

/** Everything a screen needs to show one case. */
export type CaseBundle = {
  case: CaseRow;
  evidence: EvidenceRow[];
  claims: ClaimRow[];
  links: ClaimLinkRow[];
  policy: PolicyCheckRow | null;
  fingerprint: string;
  allowed: string[]; // actions PayPal allows right now on the dispute
};
