// POST /api/cases/{id}/offer   body: { "option_id": "partial_50", "message": "..." }
// The seller sends a partial-refund offer on the PayPal dispute. The buyer accepts or declines it on PayPal.
// The amount comes from the priced option, never from the request.
import { errorResponse } from "@/lib/api";
import { sendOffer } from "@/lib/case/actions";
import { loadBundle } from "@/lib/case/bundle";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "offer", 10);
  if (limited) return limited;
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Case not found." }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    if (!body.option_id) return Response.json({ error: "Choose an option first." }, { status: 400 });
    await sendOffer(id, String(body.option_id), String(body.message || ""));
    return Response.json(await loadBundle(id, { sync: true }));
  } catch (e) {
    return errorResponse(e);
  }
}
