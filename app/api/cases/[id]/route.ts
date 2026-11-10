// GET /api/cases/{id}          -> the full case bundle (case, evidence, claims, policy check)
// GET /api/cases/{id}?sync=1   -> same, after bringing the case up to date with PayPal
import { errorResponse } from "@/lib/api";
import { loadBundle } from "@/lib/case/bundle";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Case not found." }, { status: 404 });
    const sync = new URL(request.url).searchParams.get("sync") === "1";
    const bundle = await loadBundle(id, { sync });
    if (!bundle) return Response.json({ error: "Case not found." }, { status: 404 });
    return Response.json(bundle);
  } catch (e) {
    return errorResponse(e);
  }
}
