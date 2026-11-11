/**
 * Saves finished PayPal disputes as "replay" cases, so the demo never depends on a live AI call.
 * Run it on the laptop (it needs PayPal, the database and the AI model):
 *
 *   npm run demo:save PP-R-AAA-11111111 PP-R-BBB-22222222 PP-R-CCC-33333333
 *
 * For each case ID it: brings the case up to date with PayPal, runs the AI analysis if none is saved
 * for the current case file, and marks the case as a replay. A replay is read-only: its buttons are off.
 * To run the AI again even if an analysis is saved:   npm run demo:save fresh PP-R-AAA-11111111
 * To turn a replay back into a normal case:        npm run demo:save undo PP-R-AAA-11111111
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const args = process.argv.slice(2);
  const undo = args[0] === "undo";
  const fresh = args[0] === "fresh";
  const ids = (undo || fresh ? args.slice(1) : args).map((a) => a.trim().toUpperCase());
  if (!ids.length) return console.log("Give one or more PayPal case IDs, for example: npm run demo:save PP-R-ABC-12345678");

  const { syncCaseFromPayPal } = await import("../lib/case/import");
  const { analyzeCase } = await import("../lib/case/analyze");
  const { updateCase, getPolicyCheck } = await import("../lib/db/cases");

  for (const id of ids) {
    try {
      const { caseRow } = await syncCaseFromPayPal(id);
      if (undo) {
        await updateCase(caseRow.id, { is_replay: false });
        console.log(`OK    ${id}  is a normal case again`);
        continue;
      }
      if (caseRow.paypal_status !== "RESOLVED") {
        console.log(`SKIP  ${id}  is not resolved on PayPal yet (status: ${caseRow.paypal_status}). Only finished cases become replays.`);
        continue;
      }
      const run = await analyzeCase(caseRow.id, { force: fresh });
      const policy = await getPolicyCheck(caseRow.id);
      await updateCase(caseRow.id, { is_replay: true });
      console.log(`OK    ${id}  ${caseRow.item_name}  -  analysis ${run.reused ? "already saved" : "run and saved"} (${policy?.model}), marked as replay`);
    } catch (e) {
      console.log(`FAIL  ${id}  ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error("Crashed:", e);
  process.exit(1);
});
