/**
 * Level 2 — the spike test.
 *
 * Goal: find out, in real life, what PayPal's sandbox actually lets us do.
 * 1. Get an OAuth token.
 * 2. Create + capture an order paid by card (buyer -> seller).
 * 3. Open a dispute on that order (sandbox-only, buyer-side).
 * 4. Try to resolve it: seller makes a partial refund offer, buyer accepts.
 * 5. Poll until the dispute shows RESOLVED, or until we know it won't.
 *
 * Every step logs its raw response and any debug_id, so failures are readable.
 * Nothing here touches real money — sandbox only.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
const CLIENT_ID = requireEnv("PAYPAL_CLIENT_ID");
const CLIENT_SECRET = requireEnv("PAYPAL_CLIENT_SECRET");
const BUYER_EMAIL = requireEnv("PAYPAL_BUYER_EMAIL");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return v;
}

function log(step: string, data: unknown) {
  console.log(`\n=== ${step} ===`);
  console.log(JSON.stringify(data, null, 2));
}

function b64url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  log("1. OAuth token", { status: res.status, has_token: !!data.access_token, expires_in: data.expires_in });
  if (!res.ok) throw new Error("Failed to get token");
  return data.access_token;
}

async function createAndCaptureOrder(token: string): Promise<{ orderId: string; captureId: string }> {
  // Create order
  const createRes = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: "40.00" },
          description: "Parley spike test - handwoven scarf",
        },
      ],
    }),
  });
  const order = await createRes.json();
  log("2a. Create order", { status: createRes.status, id: order.id, debug_id: order.debug_id });
  if (!createRes.ok) throw new Error("Failed to create order");

  // NOTE: In real checkout, the buyer approves via redirect/card fields.
  // For the spike we need a captured, card-paid order. This requires either:
  //  (a) a client-side card-fields approval flow, or
  //  (b) using a sandbox test card via the orders API 'payment_source.card' field.
  // We try (b) here for an automatable, scriptable test.
  const confirmRes = await fetch(`${BASE}/v2/checkout/orders/${order.id}/confirm-payment-source`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payment_source: {
        card: {
          number: "4032039194315308", // PayPal sandbox test Visa
          expiry: "2027-12",
          security_code: "123",
          name: "Test Buyer",
        },
      },
    }),
  });
  const confirm = await confirmRes.json();
  log("2b. Confirm payment source (card)", { status: confirmRes.status, status_field: confirm.status, debug_id: confirm.debug_id });

  const captureRes = await fetch(`${BASE}/v2/checkout/orders/${order.id}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const capture = await captureRes.json();
  log("2c. Capture order", {
    status: captureRes.status,
    order_status: capture.status,
    debug_id: capture.debug_id,
    purchase_units: capture.purchase_units,
  });
  if (!captureRes.ok) throw new Error("Failed to capture order");

  const captureId =
    capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;

  return { orderId: order.id, captureId };
}

function buildAuthAssertion(): string {
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: CLIENT_ID, email: BUYER_EMAIL }));
  return `${header}.${payload}.`;
}

async function createDispute(
  token: string,
  captureId: string
): Promise<string | null> {
  const assertion = buildAuthAssertion();
  const body = {
    disputed_transactions: [{ buyer_transaction_id: captureId }],
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    dispute_amount: { currency_code: "USD", value: "40.00" },
  };

  const res = await fetch(`${BASE}/v1/customer/disputes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "PayPal-Auth-Assertion": assertion,
      "Content-Type": "multipart/form-data; boundary=parleyboundary",
    },
    body: `--parleyboundary\r\nContent-Disposition: form-data; name="input"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(
      body
    )}\r\n--parleyboundary--`,
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // some success responses are 201 with empty body + Location header
  }
  const location = res.headers.get("paypal-debug-id") || res.headers.get("Location");
  log("3. Create dispute", { status: res.status, body: data, location });

  if (res.status === 201) {
    // dispute id usually comes back in the Location header or links
    const loc = res.headers.get("Location");
    const id = loc?.split("/").pop();
    return id || data.dispute_id || null;
  }
  return null;
}

async function getDispute(token: string, disputeId: string) {
  const res = await fetch(`${BASE}/v1/customer/disputes/${disputeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function makeOffer(token: string, disputeId: string) {
  const res = await fetch(
    `${BASE}/v1/customer/disputes/${disputeId}/make-offer`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        note: "We're offering a partial refund for the inconvenience.",
        offer_type: "REFUND",
        offer_amount: { currency_code: "USD", value: "15.00" },
      }),
    }
  );
  let data: any = {};
  try {
    data = await res.json();
  } catch {}
  log("5. make-offer (seller)", { status: res.status, body: data });
  return res.status;
}

async function acceptOffer(token: string, disputeId: string, withAssertion: boolean) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (withAssertion) headers["PayPal-Auth-Assertion"] = buildAuthAssertion();

  const res = await fetch(
    `${BASE}/v1/customer/disputes/${disputeId}/accept-offer`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ note: "Accepting the offer, thank you." }),
    }
  );
  let data: any = {};
  try {
    data = await res.json();
  } catch {}
  log(`6. accept-offer (buyer, withAssertion=${withAssertion})`, {
    status: res.status,
    body: data,
  });
  return res.status;
}

async function main() {
  console.log("Parley spike test starting...\n");

  const token = await getToken();
  const { orderId, captureId } = await createAndCaptureOrder(token);

  if (!captureId) {
    console.log("\n❌ No capture ID — cannot proceed to dispute creation. TIER 3.");
    return;
  }

  const disputeId = await createDispute(token, captureId);

  if (!disputeId) {
    console.log(
      "\n❌ Dispute creation failed or returned no ID. Check the log above for the exact error. Likely TIER 3 — check buyer_transaction_id format and card-payment requirement."
    );
    return;
  }

  console.log(`\n✅ Dispute created: ${disputeId}`);

  const before = await getDispute(token, disputeId);
  log("4. Dispute status + links", before.data);

  const offerStatus = await makeOffer(token, disputeId);
  if (offerStatus >= 300) {
    console.log("\n⚠️  make-offer failed. Check links/status above — may need a different dispute state. Likely TIER 3.");
    return;
  }

  console.log("\n✅ make-offer succeeded (Tier 2 confirmed at minimum)");

  let acceptStatus = await acceptOffer(token, disputeId, true);
  if (acceptStatus >= 300) {
    console.log("\naccept-offer with assertion failed, trying without...");
    acceptStatus = await acceptOffer(token, disputeId, false);
  }

  if (acceptStatus < 300) {
    console.log("\n✅✅ accept-offer succeeded! Polling for RESOLVED...");
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const poll = await getDispute(token, disputeId);
      console.log(`Poll ${i + 1}: status = ${poll.data.status}`);
      if (poll.data.status === "RESOLVED") {
        console.log("\n🎉 TIER 1 CONFIRMED: full API lifecycle works end-to-end.");
        return;
      }
    }
    console.log("\n⚠️  Offer accepted via API but never reached RESOLVED in time. Treat as Tier 1 with slow settlement — check final status manually.");
  } else {
    console.log(
      "\n⚠️  accept-offer failed via API both with and without assertion. TIER 2: make-offer works, buyer must accept in the sandbox Resolution Center UI (film this for the demo)."
    );
  }
}

main().catch((err) => {
  console.error("\n💥 Spike test crashed:", err);
  process.exit(1);
});
