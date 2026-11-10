/**
 * One command that checks every outside service the app depends on:
 *   1. PayPal   - can the app log in and read disputes?
 *   2. Database - are the tables and the evidence bucket there?
 *   3. AI       - does the Gemini key work, and which models can it use?
 *
 * Run it with:  npm run check
 * It never prints secret values.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -  ${detail}`);
}

async function checkEnv() {
  const needed = [
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
  ];
  const missing = needed.filter((k) => !process.env[k]?.trim());
  record("Keys in .env.local", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : "all 5 present");
}

async function checkPayPal() {
  try {
    const { listDisputes } = await import("../lib/paypal/disputes");
    const disputes = await listDisputes();
    record("PayPal login + read disputes", true, `${disputes.length} dispute(s): ${disputes.map((d) => `${d.dispute_id}=${d.status}`).join(", ") || "none"}`);
  } catch (e) {
    record("PayPal login + read disputes", false, (e as Error).message);
  }
}

async function checkDatabase() {
  try {
    const { db, EVIDENCE_BUCKET } = await import("../lib/db/client");
    for (const table of ["cases", "evidence", "claims", "claim_links", "policy_checks"]) {
      const { error } = await db().from(table).select("*", { count: "exact", head: true });
      if (error) throw new Error(`table "${table}": ${error.message}`);
    }
    record("Database tables", true, "all 5 tables found");
    const { data, error } = await db().storage.getBucket(EVIDENCE_BUCKET);
    record("Evidence bucket", !error && !!data, error ? error.message : `bucket "${EVIDENCE_BUCKET}" found`);
  } catch (e) {
    record("Database tables", false, (e as Error).message);
  }
}

async function checkAI() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) return record("AI (Gemini)", false, "GOOGLE_GENERATIVE_AI_API_KEY is missing");
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      headers: { "x-goog-api-key": key },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${data?.error?.message || ""}`);
    const flash = (data.models || [])
      .map((m: { name: string }) => m.name.replace("models/", ""))
      .filter((n: string) => n.includes("flash") && !n.includes("image") && !n.includes("tts") && !n.includes("live"));
    record("Gemini key + model list", true, `flash models: ${flash.join(", ")}`);
  } catch (e) {
    return record("Gemini key + model list", false, (e as Error).message);
  }
  for (const envName of ["MODEL_SMART", "MODEL_FALLBACK"]) {
    const modelId = process.env[envName] || (envName === "MODEL_SMART" ? "gemini-flash-latest" : "gemini-flash-lite-latest");
    try {
      const { generateText } = await import("ai");
      const { google } = await import("@ai-sdk/google");
      const started = Date.now();
      const { text } = await generateText({ model: google(modelId), prompt: "Reply with the single word: ready" });
      record(`AI answer from ${envName} (${modelId})`, /ready/i.test(text), `"${text.trim().slice(0, 40)}" in ${Date.now() - started} ms`);
    } catch (e) {
      record(`AI answer from ${envName} (${modelId})`, false, (e as Error).message.slice(0, 300));
    }
  }
}

async function main() {
  console.log("Parley service check\n");
  await checkEnv();
  await checkPayPal();
  await checkDatabase();
  await checkAI();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
  if (failed.length) process.exitCode = 1;
}

main();
