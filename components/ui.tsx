// Small shared building blocks for the screens: status chips, badges, and formatters.
import type { EvidenceSource } from "@/lib/case/types";

export function usd(amount: number | string): string {
  return `$${Number(amount).toFixed(2)}`;
}

export function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

const STATUS_TEXT: Record<string, { label: string; tone: string }> = {
  OPEN: { label: "Open", tone: "bg-amber-100 text-amber-900" },
  WAITING_FOR_SELLER_RESPONSE: { label: "Waiting for the seller", tone: "bg-amber-100 text-amber-900" },
  WAITING_FOR_BUYER_RESPONSE: { label: "Waiting for the buyer", tone: "bg-sky-100 text-sky-900" },
  UNDER_REVIEW: { label: "PayPal is updating the case", tone: "bg-stone-200 text-stone-800" },
  RESOLVED: { label: "Resolved on PayPal", tone: "bg-emerald-100 text-emerald-900" },
};

export function StatusChip({ status }: { status: string }) {
  const s = STATUS_TEXT[status] || { label: status.replace(/_/g, " ").toLowerCase(), tone: "bg-stone-200 text-stone-800" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.tone}`}>{s.label}</span>;
}

const SOURCE_TONE: Record<EvidenceSource, string> = {
  paypal: "bg-blue-50 text-blue-900 ring-blue-200",
  buyer: "bg-violet-50 text-violet-900 ring-violet-200",
  seller: "bg-teal-50 text-teal-900 ring-teal-200",
};

export function SourceBadge({ source }: { source: EvidenceSource }) {
  const label = source === "paypal" ? "PayPal record" : source === "buyer" ? "From the buyer" : "From the seller";
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${SOURCE_TONE[source]}`}>{label}</span>;
}

export function EvidenceId({ id }: { id: string }) {
  return <span className="inline-flex rounded bg-stone-900 px-1.5 py-0.5 font-mono text-xs font-semibold text-white">{id}</span>;
}

// Where PayPal's own pages live. Sandbox only: this prototype never touches real money.
export const RESOLUTION_CENTER_URL = "https://www.sandbox.paypal.com/resolutioncenter";
export const PAYPAL_RULE_PAGES = {
  "buyer-protection": { name: "PayPal Purchase Protection (buyers)", url: "https://www.paypal.com/us/legalhub/paypal/buyer-protection" },
  "seller-protection": { name: "PayPal Seller Protection (sellers)", url: "https://www.paypal.com/us/legalhub/paypal/seller-protection" },
} as const;
