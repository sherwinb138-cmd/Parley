// The checker. Plain code, no AI. It verifies the model's answers before anything is saved or shown:
//   - a link to an evidence ID that does not exist in this case is dropped
//   - a quote that does not appear word for word in a text evidence item is dropped
//   - quotes from photo descriptions are not word-checked (the description is itself the model's
//     reading of the image); they are labelled "AI description of photo" instead
//   - a rule ID that is not in the rules brief is dropped
//   - wording that predicts PayPal's decision is flagged
// The pipeline retries the model at most once when the checker dropped something.
import type { ClaimLinkRow, ClaimRow, EvidenceRow } from "@/lib/case/types";
import { PHOTO_MARK } from "./evidence-text";
import type { RawMap } from "./mapper";
import type { RawPolicy } from "./policy";
import { RULE_IDS } from "./rules";

/** Compare text loosely on spacing, quote marks and capitals, but strictly on the words. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^["'\s.…]+|["'\s.…]+$/g, "")
    .trim();
}

export function quoteIsInEvidence(quote: string, body: string | null): boolean {
  const q = normalise(quote);
  return q.length >= 3 && normalise(body || "").includes(q);
}

export type MapCheck = {
  claims: Array<Omit<ClaimRow, "case_id">>;
  links: Array<Omit<ClaimLinkRow, "case_id">>;
  problems: string[];
};

export function validateMap(raw: RawMap, evidence: EvidenceRow[]): MapCheck {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const claims: MapCheck["claims"] = [];
  const links: MapCheck["links"] = [];
  const problems: string[] = [];

  raw.claims.slice(0, 10).forEach((c, i) => {
    const text = c.text.trim();
    if (!text) return;
    const claimId = `C${claims.length + 1}`;
    claims.push({ id: claimId, party: c.party, body: text });
    const seen = new Set<string>();

    for (const link of c.links || []) {
      const id = link.evidence_id.trim().toUpperCase();
      const item = byId.get(id);
      if (!item) {
        problems.push(`Claim ${i + 1} cites ${link.evidence_id}, which is not an evidence id in this case.`);
        continue;
      }
      if (seen.has(id)) continue;

      const quote = link.quote.trim().slice(0, 300);
      if (item.kind === "photo" && quoteIsInEvidence(quote, item.body?.split(PHOTO_MARK)[1] || "")) {
        // Quote taken from the model's own description of the photo: labelled, not treated as verified text.
        links.push({ claim_id: claimId, evidence_id: id, relation: link.relation, quote, quote_kind: "photo_description" });
        seen.add(id);
      } else if (quoteIsInEvidence(quote, item.body)) {
        links.push({ claim_id: claimId, evidence_id: id, relation: link.relation, quote, quote_kind: "text" });
        seen.add(id);
      } else {
        problems.push(`Claim ${i + 1}: the quote "${quote.slice(0, 80)}" does not appear word for word in ${id}. Copy an exact quote or remove the link.`);
      }
    }
  });

  return { claims, links, problems };
}

const PREDICTION = /\bpaypal (will|would|is going to|is likely to|should)\b|\b(will|would) (win|lose|be refunded|rule)\b|\byou will (win|lose)\b/i;

export type PolicyCheck = { policy: RawPolicy; problems: string[] };

export function validatePolicy(raw: RawPolicy, evidence: EvidenceRow[]): PolicyCheck {
  const ids = new Set(evidence.map((e) => e.id));
  const problems: string[] = [];

  const rule_ids = [...new Set(raw.rule_ids.map((r) => r.trim().toUpperCase()))].filter((r) => {
    const ok = RULE_IDS.includes(r);
    if (!ok) problems.push(`${r} is not a rule id in the rules brief.`);
    return ok;
  });
  if (!rule_ids.length) problems.push("Cite at least one rule id from the rules brief.");

  const evidence_ids = [...new Set(raw.evidence_ids.map((e) => e.trim().toUpperCase()))].filter((e) => {
    const ok = ids.has(e);
    if (!ok) problems.push(`${e} is not an evidence id in this case.`);
    return ok;
  });
  if (!evidence_ids.length) problems.push("List at least one evidence id the implication relies on.");

  if (PREDICTION.test(raw.implication) || PREDICTION.test(raw.summary) || PREDICTION.test(raw.in_short || "")) {
    problems.push("Do not predict PayPal's decision. Say what the rule implies for cases like this instead.");
  }

  // Evidence ids mentioned in the summary in brackets must exist too.
  // Handles one id per bracket, [E3], and several, [E4, E5]. Unknown ids are removed; an emptied bracket disappears.
  const summary = raw.summary
    .replace(/\[\s*(E\d+(?:\s*(?:,|and|&)\s*E\d+)*)\s*\]/gi, (_m, inner: string) => {
      const kept = (inner.match(/E\d+/gi) || []).map((id) => id.toUpperCase()).filter((id) => ids.has(id));
      return kept.length ? `[${kept.join(", ")}]` : "";
    })
    .replace(/\s+([.,;])/g, "$1")
    .replace(/ {2,}/g, " ");

  return {
    policy: {
      ...raw,
      rule_ids,
      evidence_ids,
      summary,
      // One line only, and no ids: it is the sentence people read first.
      in_short: (raw.in_short || "").replace(/\s+/g, " ").replace(/\[[^\]]*\]/g, "").trim().slice(0, 240),
      missing_evidence: raw.missing_evidence.slice(0, 4),
    },
    problems,
  };
}
