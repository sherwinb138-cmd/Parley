// Shared helper for server routes: turns any thrown error into a clean JSON answer.
import { ActionRefused } from "@/lib/case/actions";
import { PayPalError } from "@/lib/paypal/token";

export function errorResponse(e: unknown): Response {
  if (e instanceof ActionRefused) return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof PayPalError) {
    return Response.json(
      { error: `PayPal did not accept this action (${e.issue.replace(/_/g, " ").toLowerCase()}).`, paypal_issue: e.issue, debug_id: e.debugId },
      { status: e.status === 404 ? 404 : 502 }
    );
  }
  const message = e instanceof Error ? e.message : "Something went wrong.";
  console.error("[api]", message);
  return Response.json({ error: message }, { status: 500 });
}
