// The "Try a live case" button for judges.
//   GET  /api/demo/start  -> how many open PayPal disputes are left to try
//   POST /api/demo/start  -> imports one open dispute as a case and returns its ID
// A live case is a real sandbox dispute that is still at PayPal's inquiry stage, so both settle paths work on it.
// Each one can be settled only once. When none are left, the home screen says so and points to the replays.
import { errorResponse } from "@/lib/api";
import { syncCaseFromPayPal } from "@/lib/case/import";
import { listDisputes, type Dispute } from "@/lib/paypal/disputes";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function openDisputes(): Promise<Dispute[]> {
  return (await listDisputes()).filter(
    (d) => d.dispute_life_cycle_stage === "INQUIRY" && (d.status === "WAITING_FOR_SELLER_RESPONSE" || d.status === "OPEN")
  );
}

export async function GET() {
  try {
    return Response.json({ available: (await openDisputes()).length });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "demo", 5);
  if (limited) return limited;
  try {
    const pool = await openDisputes();
    if (!pool.length) {
      return Response.json({ error: "No live case is left right now. The finished cases below show the full flow." }, { status: 404 });
    }
    // The oldest open dispute first, so the ones closest to PayPal's 20-day limit are used up first.
    const pick = pool[pool.length - 1];
    const { caseRow } = await syncCaseFromPayPal(pick.dispute_id);
    return Response.json({ id: caseRow.id, available: pool.length - 1 });
  } catch (e) {
    return errorResponse(e);
  }
}
