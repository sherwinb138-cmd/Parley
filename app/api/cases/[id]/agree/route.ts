// POST /api/cases/{id}/agree   body: { "option_id": "full" }   -> the buyer agrees to an option in Parley
//                              body: { "option_id": null }     -> the buyer withdraws the agreement
// Saves the agreement with the case-file fingerprint. It moves no money and sends nothing to PayPal.
import { errorResponse } from "@/lib/api";
import { agree } from "@/lib/case/actions";
import { loadBundle } from "@/lib/case/bundle";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "agree", 10);
  if (limited) return limited;
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Case not found." }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const optionId = body.option_id === null ? null : String(body.option_id || "");
    if (optionId === "") return Response.json({ error: "Choose an option first." }, { status: 400 });
    await agree(id, optionId);
    return Response.json(await loadBundle(id, { sync: true }));
  } catch (e) {
    return errorResponse(e);
  }
}
