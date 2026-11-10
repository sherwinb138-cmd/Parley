/**
 * Times each candidate Gemini model on two small jobs, so the fastest reliable one can be picked:
 *   1. a one-word text answer
 *   2. a structured answer (the form-with-boxes style the app uses everywhere)
 * No retries and a 45-second limit, so slow or rate-limited models show up clearly.
 *
 * Run it with:  npm run models
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const candidates = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
];

const schema = z.object({
  claims: z.array(z.object({ party: z.enum(["buyer", "seller"]), text: z.string(), evidence_id: z.string() })),
});

const prompt = `Evidence E1 (buyer message): "The parcel never arrived. I waited two weeks."
Evidence E2 (seller tracking record): "Shipped 28 Oct via India Post. No delivery scan."
List each party's claims. Each claim must cite one evidence id.`;

function short(e: unknown) {
  return (e as Error).message.replace(/\s+/g, " ").slice(0, 160);
}

async function main() {
  console.log("model | text answer | structured answer");
  for (const id of candidates) {
    let text = "";
    let structured = "";
    let t = Date.now();
    try {
      await generateText({ model: google(id), prompt: "Reply with the single word: ready", maxRetries: 0, abortSignal: AbortSignal.timeout(45000) });
      text = `ok ${Date.now() - t} ms`;
    } catch (e) {
      text = `FAIL after ${Date.now() - t} ms: ${short(e)}`;
    }
    t = Date.now();
    try {
      const { object } = await generateObject({ model: google(id), schema, prompt, maxRetries: 0, abortSignal: AbortSignal.timeout(45000) });
      structured = `ok ${Date.now() - t} ms, ${object.claims.length} claims`;
    } catch (e) {
      structured = `FAIL after ${Date.now() - t} ms: ${short(e)}`;
    }
    console.log(`${id} | ${text} | ${structured}`);
  }
}

main();
