// GET /api/cases/{id}/evidence/{eid}/file -> sends the browser to a short-lived private link for an uploaded photo.
import { errorResponse } from "@/lib/api";
import { listEvidence } from "@/lib/db/cases";
import { db, EVIDENCE_BUCKET } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; eid: string }> }) {
  try {
    const { id, eid } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Not found." }, { status: 404 });
    const item = (await listEvidence(id)).find((e) => e.id === eid);
    if (!item?.file_path) return Response.json({ error: "Not found." }, { status: 404 });
    const { data, error } = await db().storage.from(EVIDENCE_BUCKET).createSignedUrl(item.file_path, 300);
    if (error || !data) throw new Error(error?.message || "Could not open the image.");
    return Response.redirect(data.signedUrl, 302);
  } catch (e) {
    return errorResponse(e);
  }
}
