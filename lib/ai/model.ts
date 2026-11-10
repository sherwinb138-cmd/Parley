// The one place that picks the AI model. Everything else calls askModel() and never names a provider.
//
//   AI_PROVIDER=google  -> Gemini (hosted demo). Tries MODEL_SMART, then MODEL_FALLBACK if it is busy.
//   AI_PROVIDER=ollama  -> a model running on this computer through Ollama (for local development).
//
// Every call must return data in a fixed shape (a zod schema), so plain code can check the answer.
// No model is ever given a tool: it cannot call PayPal, the database, or anything else.
import { generateText, Output, type LanguageModel, type ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { createOllama } from "ai-sdk-ollama";
import type { z } from "zod";

export type ImagePart = { data: Buffer; mediaType: string };

type Candidate = { name: string; model: LanguageModel };

function candidates(): Candidate[] {
  if ((process.env.AI_PROVIDER || "google") === "ollama") {
    const name = process.env.OLLAMA_MODEL || "qwen3.5:4b";
    const ollama = createOllama({ baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434" });
    return [{ name: `ollama/${name}`, model: ollama(name, { think: false }) }];
  }
  const smart = process.env.MODEL_SMART || "gemini-3.6-flash";
  const fallback = process.env.MODEL_FALLBACK || "gemini-3.5-flash-lite";
  return [
    { name: smart, model: google(smart) },
    { name: fallback, model: google(fallback) },
  ];
}

export type ModelAnswer<T> = { data: T; model: string; ms: number };

/** Ask the model one question and get back data in the given shape. Falls back to the next model on failure. */
export async function askModel<T>(opts: {
  label: string;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  images?: ImagePart[];
  timeoutMs?: number;
}): Promise<ModelAnswer<T>> {
  const content: Array<{ type: "text"; text: string } | { type: "file"; mediaType: string; data: Buffer }> = [{ type: "text", text: opts.prompt }];
  for (const img of opts.images || []) content.push({ type: "file", mediaType: img.mediaType, data: img.data });
  const messages: ModelMessage[] = [{ role: "user", content }];

  let lastError: unknown;
  for (const c of candidates()) {
    const started = Date.now();
    try {
      const result = await generateText({
        model: c.model,
        system: opts.system,
        messages,
        output: Output.object({ schema: opts.schema }),
        temperature: 0,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
      });
      const ms = Date.now() - started;
      console.log(`[ai] ${opts.label} answered by ${c.name} in ${ms} ms`);
      return { data: result.output as T, model: c.name, ms };
    } catch (e) {
      lastError = e;
      console.error(`[ai] ${opts.label} failed on ${c.name} after ${Date.now() - started} ms: ${(e as Error).message.slice(0, 200)}`);
    }
  }
  throw new Error(`The AI model could not answer (${opts.label}): ${(lastError as Error)?.message?.slice(0, 200) || "unknown error"}`);
}
