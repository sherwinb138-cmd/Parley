// The AI pipeline for one case, start to finish. It needs no database, so it can be tested alone.
//
//   evidence ──► mapper (AI) ──► checker (code) ──► policy check (AI) ──► checker (code) ──► pricing (code)
//                    ▲ one retry if the checker removed something ▲
//
// What comes out is safe to save and show: every link points at real evidence with a verified quote,
// every rule ID is from the rules brief, and the amounts were set by code.
import type { ClaimLinkRow, ClaimRow, EvidenceRow, PolicyCheckRow } from "@/lib/case/types";
import { priceOptions } from "@/lib/settle/price";
import { mapClaims } from "./mapper";
import { checkPolicy } from "./policy";
import { validateMap, validatePolicy } from "./validate";

export type Analysis = {
  claims: Array<Omit<ClaimRow, "case_id">>;
  links: Array<Omit<ClaimLinkRow, "case_id">>;
  policy: Omit<PolicyCheckRow, "case_id" | "created_at" | "evidence_fingerprint">;
  timings: Record<string, number>;
};

export async function analyzeEvidence(evidence: EvidenceRow[], orderAmount: number): Promise<Analysis> {
  const timings: Record<string, number> = {};
  const notes: string[] = [];
  let retried = false;

  // 1. Claim-to-evidence map, then the checker.
  let mapAnswer = await mapClaims(evidence);
  timings.mapper = mapAnswer.ms;
  let map = validateMap(mapAnswer.data, evidence);
  let removed = map.problems.length;
  if (map.problems.length) {
    retried = true;
    notes.push(`First map: ${map.problems.length} link(s) failed the check, so the model was asked once to correct them.`);
    try {
      mapAnswer = await mapClaims(evidence, map.problems.slice(0, 8).join("\n"));
      timings.mapper_retry = mapAnswer.ms;
      const second = validateMap(mapAnswer.data, evidence);
      removed = second.problems.length;
      map = second;
      if (second.problems.length) notes.push(`After the retry, ${second.problems.length} link(s) still failed and were removed.`);
    } catch {
      notes.push("The retry failed, so the first map was kept with the failed links removed.");
    }
  }

  // 2. Policy check, then the checker.
  let policyAnswer = await checkPolicy(evidence, map.claims);
  timings.policy = policyAnswer.ms;
  let policy = validatePolicy(policyAnswer.data, evidence);
  if (policy.problems.length) {
    retried = true;
    notes.push(`Policy check: ${policy.problems.length} problem(s) found, so the model was asked once to correct them.`);
    try {
      policyAnswer = await checkPolicy(evidence, map.claims, policy.problems.join("\n"));
      timings.policy_retry = policyAnswer.ms;
      policy = validatePolicy(policyAnswer.data, evidence);
    } catch {
      notes.push("The policy retry failed, so the first answer was kept with invalid ids removed.");
    }
  }
  if (!policy.policy.rule_ids.length) throw new Error("The Policy check did not cite a valid rule, so it was not saved. Please run the analysis again.");
  if (policy.problems.some((p) => p.startsWith("Do not predict"))) {
    throw new Error("The Policy check tried to predict PayPal's decision twice, so it was not saved. Please run the analysis again.");
  }

  // 3. Pricing: plain code.
  const options = priceOptions(policy.policy.complaint_type, orderAmount);

  return {
    claims: map.claims,
    links: map.links,
    policy: {
      rule_ids: policy.policy.rule_ids,
      implication: policy.policy.implication.trim(),
      evidence_ids: policy.policy.evidence_ids,
      missing_evidence: policy.policy.missing_evidence,
      summary: policy.policy.summary.trim(),
      options,
      model: policyAnswer.model,
      complaint_type: policy.policy.complaint_type,
      checker: { links_verified: map.links.length, links_removed: removed, retried, notes },
    },
    timings,
  };
}
