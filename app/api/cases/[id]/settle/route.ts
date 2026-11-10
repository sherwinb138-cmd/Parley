// POST /api/cases/{id}/settle
// The seller confirms the full refund the buyer agreed to in Parley. PayPal refunds the buyer and closes the dispute.
import { errorResponse } from "@/lib/api";
import { settleFullRefund } from "@/lib/case/actions";
import { loadBundle } from "@/lib/case/bundle";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "settle", 10);
  if (limited) return limited;
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Case not found." }, { status: 404 });
    await settleFullRefund(id);
    return Response.json(await loadBundle(id, { sync: true }));
  } catch (e) {
    return errorResponse(e);
  }
}
