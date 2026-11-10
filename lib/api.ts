// Shared helper for server routes: turns any thrown error into a clean JSON answer.
import { PayPalError } from "@/lib/paypal/token";

export function errorResponse(e: unknown): Response {
  if (e instanceof PayPalError) {
    return Response.json(
      { error: `PayPal did not accept this action (${e.issue}).`, paypal_issue: e.issue, debug_id: e.debugId },
      { status: e.status === 404 ? 404 : 502 }
    );
  }
  const message = e instanceof Error ? e.message : "Something went wrong.";
  console.error("[api]", message);
  return Response.json({ error: message }, { status: 500 });
}
