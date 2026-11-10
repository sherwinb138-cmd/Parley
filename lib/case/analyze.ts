// Runs the AI pipeline for a saved case and stores the result.
//   1. Any uploaded photo without a description is described by the vision model first.
//   2. The pipeline in lib/ai/analyze.ts builds the map, the Policy check and the options.
//   3. The result is saved together with the case-file fingerprint it was made from.
// If the evidence has not changed since the last run, the saved result is reused.
import { analyzeEvidence } from "@/lib/ai/analyze";
import { PHOTO_MARK } from "@/lib/ai/evidence-text";
import { describePhoto } from "@/lib/ai/photo";
import { getCase, getPolicyCheck, listEvidence, saveAnalysis, updateEvidenceBody } from "@/lib/db/cases";
import { db, EVIDENCE_BUCKET } from "@/lib/db/client";
import { caseFingerprint } from "./fingerprint";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function analyzeCase(caseId: string, opts: { force?: boolean } = {}): Promise<{ reused: boolean; timings?: Record<string, number> }> {
  const caseRow = await getCase(caseId);
  if (!caseRow) throw new Error("Case not found.");

  let evidence = await listEvidence(caseId);

  // 1. Describe photos that have no AI description yet.
  for (const item of evidence.filter((e) => e.kind === "photo" && e.file_path && !e.body?.includes(PHOTO_MARK))) {
    try {
      const { data, error } = await db().storage.from(EVIDENCE_BUCKET).download(item.file_path!);
      if (error || !data) throw new Error(error?.message || "download failed");
      const ext = item.file_path!.split(".").pop() || "jpg";
      const { text } = await describePhoto({ data: Buffer.from(await data.arrayBuffer()), mediaType: TYPES[ext] || "image/jpeg" }, item.body);
      // The fingerprint of a photo stays the fingerprint of the image file itself.
      await updateEvidenceBody(caseId, item.id, `${item.body ? `${item.body}\n` : ""}${PHOTO_MARK} ${text}`, item.sha256);
    } catch (e) {
      console.error(`[analyze] could not describe photo ${item.id}:`, (e as Error).message);
    }
  }
  evidence = await listEvidence(caseId);

  // 2. Reuse the saved analysis when nothing changed.
  const fp = caseFingerprint(evidence);
  if (!opts.force) {
    const saved = await getPolicyCheck(caseId);
    if (saved && saved.evidence_fingerprint === fp) return { reused: true };
  }

  // 3. Run the pipeline and save.
  const result = await analyzeEvidence(evidence, Number(caseRow.amount));
  await saveAnalysis(caseId, result.claims, result.links, { ...result.policy, evidence_fingerprint: fp });
  return { reused: false, timings: result.timings };
}
