// A small per-visitor speed limit for the public routes, kept in memory.
// Good enough for a single always-on server; it resets when the server restarts.
const hits = new Map<string, { count: number; resetAt: number }>();

export function visitorKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** Returns a 429 response when the visitor is over the limit, otherwise null. */
export function rateLimit(request: Request, bucket: string, perMinute = Number(process.env.RATE_LIMIT_PER_IP || 20)): Response | null {
  const key = `${bucket}:${visitorKey(request)}`;
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + 60_000 });
    return null;
  }
  entry.count++;
  if (entry.count > perMinute) {
    return Response.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  }
  return null;
}
