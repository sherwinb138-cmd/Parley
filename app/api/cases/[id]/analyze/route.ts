// POST /api/cases/{id}/analyze          -> run the AI pipeline (reuses the saved result if the evidence is unchanged)
// POST /api/cases/{id}/analyze?force=1  -> run it again even if nothing changed
import { errorResponse } from "@/lib/api";
import { analyzeCase } from "@/lib/case/analyze";
import { loadBundle } from "@/lib/case/bundle";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "analyze", 6);
  if (limited) return limited;
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Case not found." }, { status: 404 });
    const force = new URL(request.url).searchParams.get("force") === "1";
    const current = await loadBundle(id);
    if (!current) return Response.json({ error: "Case not found." }, { status: 404 });
    // A replay keeps its saved analysis, so the demo never waits for the AI model.
    if (current.case.is_replay && current.policy) return Response.json({ ...current, analysis_run: { reused: true } });
    const run = await analyzeCase(id, { force });
    const bundle = await loadBundle(id);
    return Response.json({ ...bundle, analysis_run: run });
  } catch (e) {
    return errorResponse(e);
  }
}
