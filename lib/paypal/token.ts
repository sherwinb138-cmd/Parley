// OAuth token for raw REST calls (the Disputes API is not in the Server SDK).
// The token is cached in memory until shortly before it expires.

export const PAYPAL_BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

let cached: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing");

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal token request failed: ${res.status} ${JSON.stringify(data)}`);

  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 };
  return cached.token;
}

export class PayPalError extends Error {
  constructor(
    public status: number,
    public issue: string,
    public debugId: string | null,
    public body: unknown
  ) {
    super(`PayPal ${status}: ${issue}${debugId ? ` (debug_id ${debugId})` : ""}`);
  }
}

/** One raw REST call. Throws PayPalError with the issue code and debug_id on failure. */
export async function paypalFetch<T = unknown>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const issue = data?.details?.[0]?.issue || data?.name || data?.error || "UNKNOWN";
    const debugId = data?.debug_id || res.headers.get("paypal-debug-id");
    console.error("[paypal]", method, path, res.status, issue, debugId);
    throw new PayPalError(res.status, issue, debugId, data);
  }
  return data as T;
}
