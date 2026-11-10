// AI job 2: the claim-to-evidence map. ONE model call that
//   - lists what the buyer claims and what the seller claims, and
//   - links each claim to the evidence that supports or contradicts it, with an exact quote.
// The model's answer is not trusted as it is: lib/ai/validate.ts checks every link afterwards.
import { z } from "zod";
import type { EvidenceRow } from "@/lib/case/types";
import { askModel } from "./model";
import { evidenceBlock, UNTRUSTED_NOTE } from "./evidence-text";

export const mapSchema = z.object({
  claims: z
    .array(
      z.object({
        party: z.enum(["buyer", "seller"]),
        text: z.string().describe("One factual claim in one plain sentence, in the third person, e.g. 'The buyer says the parcel never arrived.'"),
        links: z.array(
          z.object({
            evidence_id: z.string().describe("The id of one evidence item, e.g. E3"),
            relation: z.enum(["supports", "contradicts"]),
            quote: z.string().describe("A short exact quote copied character for character from that evidence item, at most 200 characters."),
          })
        ),
      })
    )
    .describe("Between 2 and 8 claims in total."),
});

export type RawMap = z.infer<typeof mapSchema>;

const SYSTEM = `You organise the facts of a dispute between a buyer and a seller about an online order paid with PayPal.
You are neutral. You do not decide who is right and you do not recommend an outcome.

Your task:
1. List the factual claims each party makes. Take the buyer's claims from the buyer's messages, statements and uploads, and the seller's claims from the seller's. Only include claims a party actually made; do not invent claims for a party who has said nothing.
2. For each claim, link the evidence items that support it or contradict it. PayPal records often support or contradict a claim; link them when they do.
3. For each link, copy a short exact quote from that evidence item. The quote must appear in the item word for word. Never paraphrase inside a quote.
4. If no evidence supports or contradicts a claim, return the claim with an empty links list.

Use only the evidence provided. Use only evidence ids that appear in the evidence. ${UNTRUSTED_NOTE}`;

export async function mapClaims(evidence: EvidenceRow[], feedback?: string) {
  return askModel({
    label: feedback ? "mapper (retry)" : "mapper",
    schema: mapSchema,
    system: SYSTEM,
    prompt: `${evidenceBlock(evidence)}\n\nBuild the claim-to-evidence map.${feedback ? `\n\nYour previous answer had problems. Fix them:\n${feedback}` : ""}`,
  });
}
