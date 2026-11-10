// Server-side Supabase client. Uses the service-role key, so never import this in client components.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export const EVIDENCE_BUCKET = "evidence";
