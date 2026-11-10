// Database reads and writes for cases and evidence. The only file that knows the table names.
import { db } from "./client";
import { fingerprint } from "@/lib/case/fingerprint";
import type { CaseRow, ClaimLinkRow, ClaimRow, EvidenceKind, EvidenceRow, EvidenceSource, PolicyCheckRow } from "@/lib/case/types";

function fail(what: string, message: string): never {
  throw new Error(`Database error while ${what}: ${message}`);
}

export async function listCases(): Promise<CaseRow[]> {
  const { data, error } = await db().from("cases").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) fail("listing cases", error.message);
  return data as CaseRow[];
}

export async function getCase(id: string): Promise<CaseRow | null> {
  const { data, error } = await db().from("cases").select("*").eq("id", id).maybeSingle();
  if (error) fail("reading a case", error.message);
  return data as CaseRow | null;
}

export async function getCaseByDispute(disputeId: string): Promise<CaseRow | null> {
  const { data, error } = await db().from("cases").select("*").eq("paypal_dispute_id", disputeId).maybeSingle();
  if (error) fail("reading a case", error.message);
  return data as CaseRow | null;
}

/** Create the case, or update it if this PayPal dispute was imported before. */
export async function upsertCase(fields: Partial<CaseRow> & { paypal_dispute_id: string }): Promise<CaseRow> {
  const { data, error } = await db()
    .from("cases")
    .upsert({ ...fields, updated_at: new Date().toISOString() }, { onConflict: "paypal_dispute_id" })
    .select("*")
    .single();
  if (error) fail("saving a case", error.message);
  return data as CaseRow;
}

export async function updateCase(id: string, fields: Partial<CaseRow>): Promise<CaseRow> {
  const { data, error } = await db()
    .from("cases")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail("updating a case", error.message);
  return data as CaseRow;
}

export async function listEvidence(caseId: string): Promise<EvidenceRow[]> {
  const { data, error } = await db().from("evidence").select("*").eq("case_id", caseId);
  if (error) fail("reading evidence", error.message);
  return (data as EvidenceRow[]).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

export type NewEvidence = {
  source: EvidenceSource;
  kind: EvidenceKind;
  title: string;
  body: string | null;
  file_path?: string | null;
  /** Fingerprint of an uploaded file. For text evidence it is computed from the body. */
  sha256?: string;
  occurred_at?: string | null;
};

function nextId(existing: EvidenceRow[]): string {
  const max = existing.reduce((m, e) => Math.max(m, Number(e.id.slice(1)) || 0), 0);
  return `E${max + 1}`;
}

/** Add one evidence item with the next free ID (E1, E2, ...). */
export async function addEvidence(caseId: string, item: NewEvidence): Promise<EvidenceRow> {
  // Two uploads at the same moment could pick the same ID; the primary key rejects the second, so retry.
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await listEvidence(caseId);
    const row = {
      case_id: caseId,
      id: nextId(existing),
      source: item.source,
      kind: item.kind,
      title: item.title,
      body: item.body,
      file_path: item.file_path ?? null,
      sha256: item.sha256 ?? fingerprint(item.body ?? ""),
      occurred_at: item.occurred_at ?? null,
    };
    const { data, error } = await db().from("evidence").insert(row).select("*").single();
    if (!error) return data as EvidenceRow;
    if (error.code !== "23505") fail("adding evidence", error.message);
  }
  fail("adding evidence", "could not find a free evidence ID");
}

export async function updateEvidenceBody(caseId: string, id: string, body: string, sha256?: string) {
  const { error } = await db()
    .from("evidence")
    .update({ body, sha256: sha256 ?? fingerprint(body) })
    .eq("case_id", caseId)
    .eq("id", id);
  if (error) fail("updating evidence", error.message);
}

export async function listClaims(caseId: string): Promise<{ claims: ClaimRow[]; links: ClaimLinkRow[] }> {
  const [c, l] = await Promise.all([
    db().from("claims").select("*").eq("case_id", caseId),
    db().from("claim_links").select("*").eq("case_id", caseId),
  ]);
  if (c.error) fail("reading claims", c.error.message);
  if (l.error) fail("reading claim links", l.error.message);
  const claims = (c.data as ClaimRow[]).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return { claims, links: l.data as ClaimLinkRow[] };
}

export async function getPolicyCheck(caseId: string): Promise<PolicyCheckRow | null> {
  const { data, error } = await db().from("policy_checks").select("*").eq("case_id", caseId).maybeSingle();
  if (error) fail("reading the policy check", error.message);
  return data as PolicyCheckRow | null;
}

/** Replace the AI's saved analysis for a case in one go. */
export async function saveAnalysis(
  caseId: string,
  claims: Array<Omit<ClaimRow, "case_id">>,
  links: Array<Omit<ClaimLinkRow, "case_id">>,
  policy: Omit<PolicyCheckRow, "case_id" | "created_at">
) {
  const d = db();
  let r = await d.from("claim_links").delete().eq("case_id", caseId);
  if (r.error) fail("clearing claim links", r.error.message);
  r = await d.from("claims").delete().eq("case_id", caseId);
  if (r.error) fail("clearing claims", r.error.message);
  if (claims.length) {
    r = await d.from("claims").insert(claims.map((c) => ({ ...c, case_id: caseId })));
    if (r.error) fail("saving claims", r.error.message);
  }
  if (links.length) {
    r = await d.from("claim_links").insert(links.map((l) => ({ ...l, case_id: caseId })));
    if (r.error) fail("saving claim links", r.error.message);
  }
  r = await d.from("policy_checks").upsert({ ...policy, case_id: caseId, created_at: new Date().toISOString() });
  if (r.error) fail("saving the policy check", r.error.message);
}
