// POST /api/cases/{id}/evidence -> the buyer or the seller adds evidence to the case file.
// Form fields: party ("buyer" | "seller"), note (text), file (optional image, up to 5 MB).
// The file is stored privately and fingerprinted. Uploaded content is treated as untrusted data.
import { errorResponse } from "@/lib/api";
import { fingerprint } from "@/lib/case/fingerprint";
import { addEvidence, getCase } from "@/lib/db/cases";
import { db, EVIDENCE_BUCKET } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "evidence", 10);
  if (limited) return limited;
  try {
    const { id } = await params;
    const caseRow = /^[0-9a-f-]{36}$/.test(id) ? await getCase(id) : null;
    if (!caseRow) return Response.json({ error: "Case not found." }, { status: 404 });
    if (caseRow.is_replay) return Response.json({ error: "This is a finished replay case. Evidence cannot be added." }, { status: 409 });

    const form = await request.formData();
    const party = form.get("party");
    const note = String(form.get("note") || "").trim().slice(0, 2000);
    const file = form.get("file");
    if (party !== "buyer" && party !== "seller") return Response.json({ error: "Choose who is adding this: buyer or seller." }, { status: 400 });

    const who = party === "buyer" ? "Buyer" : "Seller";

    if (file instanceof File && file.size > 0) {
      const ext = IMAGE_TYPES[file.type];
      if (!ext) return Response.json({ error: "Only JPG, PNG or WebP images can be uploaded." }, { status: 400 });
      if (file.size > MAX_BYTES) return Response.json({ error: "The image is larger than 5 MB." }, { status: 400 });

      const bytes = Buffer.from(await file.arrayBuffer());
      const sha = fingerprint(bytes);
      const path = `${caseRow.id}/${sha.slice(0, 16)}.${ext}`;
      const { error } = await db().storage.from(EVIDENCE_BUCKET).upload(path, bytes, { contentType: file.type, upsert: true });
      if (error) throw new Error(`Could not store the image: ${error.message}`);

      const row = await addEvidence(caseRow.id, {
        source: party,
        kind: "photo",
        title: `${who} photo${note ? `: ${note.slice(0, 60)}` : ""}`,
        body: note ? `${who}'s note with the photo: ${note}` : null,
        file_path: path,
        sha256: sha,
        occurred_at: new Date().toISOString(),
      });
      return Response.json({ evidence: row });
    }

    if (!note) return Response.json({ error: "Add a photo or write a statement." }, { status: 400 });
    const row = await addEvidence(caseRow.id, {
      source: party,
      kind: "statement",
      title: `${who} statement in Parley`,
      body: note,
      occurred_at: new Date().toISOString(),
    });
    return Response.json({ evidence: row });
  } catch (e) {
    return errorResponse(e);
  }
}
