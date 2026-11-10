// Health check. Runs a real SELECT so the keep-alive cron counts as database activity
// (free Supabase projects pause after 7 days without it).
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { count, error } = await db().from("cases").select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return Response.json({ ok: true, cases: count ?? 0, time: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 503 });
  }
}
