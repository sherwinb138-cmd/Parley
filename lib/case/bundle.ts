// Loads everything a screen needs to show one case, as a single "bundle".
// With sync on, it first brings the case up to date with PayPal (new messages, offers, status).
import { getCase, getPolicyCheck, listClaims, listEvidence } from "@/lib/db/cases";
import { caseFingerprint } from "./fingerprint";
import { syncCaseFromPayPal } from "./import";
import type { CaseBundle } from "./types";

const lastSync = new Map<string, number>();
const SYNC_EVERY_MS = 10_000;

export async function loadBundle(caseId: string, opts: { sync?: boolean } = {}): Promise<CaseBundle | null> {
  let caseRow = await getCase(caseId);
  if (!caseRow) return null;

  let allowed: string[] = [];
  const due = Date.now() - (lastSync.get(caseId) || 0) > SYNC_EVERY_MS;
  if (opts.sync && due) {
    try {
      const synced = await syncCaseFromPayPal(caseRow.paypal_dispute_id);
      caseRow = synced.caseRow;
      allowed = synced.allowed;
      lastSync.set(caseId, Date.now());
    } catch (e) {
      // PayPal being slow or down must not hide the saved case file.
      console.error("[bundle] PayPal sync failed:", (e as Error).message);
    }
  }

  const [evidence, { claims, links }, policy] = await Promise.all([listEvidence(caseId), listClaims(caseId), getPolicyCheck(caseId)]);
  return { case: caseRow, evidence, claims, links, policy, fingerprint: caseFingerprint(evidence), allowed };
}
