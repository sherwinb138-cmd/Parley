// AI job 3: the Policy check and the neutral summary, in one model call.
// It says which published PayPal rule applies (by rule ID from lib/ai/rules.ts), what that rule
// implies for cases like this one, and what evidence is missing. It never predicts PayPal's decision.
import { z } from "zod";
import type { ClaimRow, EvidenceRow } from "@/lib/case/types";
import { askModel } from "./model";
import { evidenceBlock, UNTRUSTED_NOTE } from "./evidence-text";
import { rulesBrief } from "./rules";

export const COMPLAINT_TYPES = ["item_not_received", "not_as_described", "changed_mind", "other"] as const;
export type ComplaintType = (typeof COMPLAINT_TYPES)[number];

export const policySchema = z.object({
  complaint_type: z.enum(COMPLAINT_TYPES).describe("What the buyer's complaint is actually about, judged from the buyer's own words."),
  rule_ids: z.array(z.string()).describe("One to three rule ids from the rules brief that apply, most relevant first, e.g. ['R2','R1']."),
  implication: z
    .string()
    .describe("Two or three plain sentences on what those rules imply for cases like this one, given the evidence on file. Never state or predict what PayPal will decide."),
  evidence_ids: z.array(z.string()).describe("The evidence ids the implication relies on."),
  missing_evidence: z.array(z.string()).describe("Up to four specific pieces of evidence that are not on file and would change the picture."),
  in_short: z
    .string()
    .describe("One plain sentence of at most 25 words that a first-time reader understands at once: what the applicable rule asks for and whether that is on file. No rule ids, no evidence ids, no prediction of PayPal's decision."),
  summary: z.string().describe("A neutral summary of the case for both parties, three or four plain sentences, mentioning evidence ids in brackets like [E3]."),
});

export type RawPolicy = z.infer<typeof policySchema>;

const SYSTEM = `You write a "Policy check" for a dispute between a buyer and a seller about an online order paid with PayPal.
You are neutral and you address both parties.

Hard rules:
- Cite only rule ids from the rules brief below. Do not cite or invent any other rule.
- Explain what the cited rules imply "for cases like this". Never say or suggest what PayPal will decide, and never use phrases like "PayPal will", "PayPal would rule" or "you will win".
- Rely only on the evidence provided, and list the evidence ids you relied on.
- Be specific about what is missing, e.g. "a carrier page showing 'delivered' status and the delivery date".
- Plain English. No legal jargon. No advice to either side about what they should accept.

Rules brief (from PayPal's published Purchase Protection and Seller Protection pages):
${rulesBrief()}

${UNTRUSTED_NOTE}`;

export async function checkPolicy(evidence: EvidenceRow[], claims: Array<Pick<ClaimRow, "id" | "party" | "body">>, feedback?: string) {
  const claimText = claims.map((c) => `${c.id} (${c.party}): ${c.body}`).join("\n") || "(no claims were extracted)";
  return askModel({
    label: feedback ? "policy (retry)" : "policy",
    schema: policySchema,
    system: SYSTEM,
    prompt: `${evidenceBlock(evidence)}\n\nClaims already extracted:\n${claimText}\n\nWrite the Policy check.${feedback ? `\n\nYour previous answer had problems. Fix them:\n${feedback}` : ""}`,
  });
}
