/**
 * Tests the checker and the pricing with made-up AI answers. No AI, no network.
 * It proves that plain code removes evidence IDs and quotes the AI invented.
 *
 * Run it with:  npm run test:checker
 */
import { validateMap, validatePolicy } from "../lib/ai/validate";
import { priceOptions } from "../lib/settle/price";
import { SAMPLE_EVIDENCE } from "./fixtures";

let failed = 0;
function expect(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -  ${detail}` : ""}`);
  if (!ok) failed++;
}

const map = validateMap(
  {
    claims: [
      {
        party: "buyer",
        text: "The buyer says the parcel never arrived.",
        links: [
          { evidence_id: "E5", relation: "supports", quote: "nothing has arrived" }, // real quote
          { evidence_id: "E3", relation: "supports", quote: "No delivery confirmation is recorded in PayPal" }, // real quote
          { evidence_id: "E99", relation: "supports", quote: "the parcel was lost" }, // fake evidence id
          { evidence_id: "E2", relation: "contradicts", quote: "The parcel was delivered on 5 November" }, // invented quote
        ],
      },
      { party: "seller", text: "The seller says the parcel was shipped on 28 October.", links: [{ evidence_id: "e6", relation: "supports", quote: "We handed the parcel to India  Post on 28 October" }] }, // lower-case id, double space
      { party: "seller", text: "The seller says delays are normal.", links: [] }, // unsupported claim
    ],
  },
  SAMPLE_EVIDENCE
);
expect("keeps real quotes", map.links.filter((l) => l.claim_id === "C1").length === 2, `${map.links.filter((l) => l.claim_id === "C1").length} links kept on C1`);
expect("drops a link to a fake evidence id (E99)", !map.links.some((l) => l.evidence_id === "E99"));
expect("drops an invented quote", !map.links.some((l) => l.evidence_id === "E2"));
expect("reports both problems for the retry", map.problems.length === 2, map.problems.join(" | "));
expect("accepts a quote that differs only in spacing and capitals", map.links.some((l) => l.claim_id === "C2" && l.evidence_id === "E6"));
expect("keeps a claim with no evidence as unsupported", map.claims.length === 3 && !map.links.some((l) => l.claim_id === "C3"));

const policy = validatePolicy(
  {
    complaint_type: "item_not_received",
    rule_ids: ["R2", "R42"],
    implication: "For cases like this, R2 asks the seller for proof of delivery.",
    evidence_ids: ["E3", "E77"],
    missing_evidence: ["A carrier page showing delivered status"],
    summary: "The buyer reports no delivery [E5]. Tracking shows shipped only [E3] [E88].",
  },
  SAMPLE_EVIDENCE
);
expect("drops a rule id that is not in the rules brief (R42)", policy.policy.rule_ids.join() === "R2");
expect("drops a fake evidence id from the policy check (E77)", policy.policy.evidence_ids.join() === "E3");
expect("removes a fake evidence id from the summary (E88)", !policy.policy.summary.includes("E88") && policy.policy.summary.includes("[E3]"));

const predicting = validatePolicy(
  { complaint_type: "item_not_received", rule_ids: ["R2"], implication: "PayPal will rule for the buyer.", evidence_ids: ["E3"], missing_evidence: [], summary: "Summary [E3]." },
  SAMPLE_EVIDENCE
);
expect("flags a prediction of PayPal's decision", predicting.problems.some((p) => p.startsWith("Do not predict")));

const opts = priceOptions("item_not_received", 40);
expect("pricing always includes a full refund", opts[0].id === "full" && opts[0].amount === 40 && opts[0].path === "accept_claim");
expect("pricing adds a partial option set by code", opts.some((o) => o.path === "make_offer" && o.amount === 20), opts.map((o) => `${o.id}=$${o.amount}`).join(", "));
expect("pricing respects the offer cap", priceOptions("other", 1000, 200).every((o) => o.path !== "make_offer"));

console.log(`\n${failed ? `${failed} check(s) FAILED` : "All checker tests passed."}`);
process.exitCode = failed ? 1 : 0;
