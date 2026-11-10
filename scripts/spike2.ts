/**
 * Level 2, second route: the buyer opens the dispute in PayPal's own sandbox
 * website (as in production), and Parley drives the seller side through the API.
 *
 * Commands:
 *   npx tsx scripts/spike2.ts order               create an order, print the buyer's pay link
 *   npx tsx scripts/spike2.ts capture <orderId>   take the payment after the buyer approved
 *   npx tsx scripts/spike2.ts disputes            list disputes, show the newest in full
 *   npx tsx scripts/spike2.ts offer <disputeId>   send a message + a partial refund offer
 *   npx tsx scripts/spike2.ts status <disputeId>  show the dispute's status and allowed actions
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;

function log(step: string, data: unknown) {
  console.log(`\n=== ${step} ===`);
  console.log(JSON.stringify(data, null, 2));
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
  const data: any = await res.json();
  if (!res.ok) {
    log("Token error", data);
    process.exit(1);
  }
  return data.access_token;
}

async function call(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(method === "POST" ? { "PayPal-Request-Id": `parley-${Date.now()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, debug_id: res.headers.get("paypal-debug-id"), data };
}

function allowedActions(dispute: any): string[] {
  return (dispute.links || []).map((l: any) => l.rel);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const token = await getToken();

  if (cmd === "order") {
    const r = await call(token, "POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: "40.00" },
          description: "Handwoven cotton sari - Meera Handlooms",
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "PAY_NOW",
            return_url: "https://example.com/paid",
            cancel_url: "https://example.com/cancelled",
          },
        },
      },
    });
    if (r.status >= 300) return log("Create order FAILED", r);
    const link = r.data.links?.find((l: any) => l.rel === "payer-action" || l.rel === "approve")?.href;
    console.log(`\nORDER ID: ${r.data.id}`);
    console.log(`\nBUYER PAY LINK (open in your browser):\n${link}\n`);
    return;
  }

  if (cmd === "capture") {
    if (!arg) return console.log("Usage: capture <orderId>");
    const r = await call(token, "POST", `/v2/checkout/orders/${arg}/capture`);
    const cap = r.data.purchase_units?.[0]?.payments?.captures?.[0];
    log("Capture", {
      status: r.status,
      debug_id: r.debug_id,
      order_status: r.data.status,
      capture_id: cap?.id,
      capture_status: cap?.status,
      seller_protection: cap?.seller_protection,
      payer_email: r.data.payer?.email_address,
      error: r.status >= 300 ? r.data : undefined,
    });
    return;
  }

  if (cmd === "disputes") {
    const list = await call(token, "GET", "/v1/customer/disputes?page_size=10");
    if (list.status >= 300) return log("List disputes FAILED", list);
    const items = list.data.items || [];
    log(
      "Disputes on this seller account",
      items.map((d: any) => ({
        id: d.dispute_id,
        reason: d.reason,
        status: d.status,
        stage: d.dispute_life_cycle_stage,
        amount: d.dispute_amount,
        created: d.create_time,
      }))
    );
    if (!items.length) return console.log("\nNo disputes yet. It can take a minute or two after the buyer files one.");
    const newest = items.sort((a: any, b: any) => (a.create_time < b.create_time ? 1 : -1))[0];
    const full = await call(token, "GET", `/v1/customer/disputes/${newest.dispute_id}`);
    log(`Newest dispute in full (${newest.dispute_id})`, full.data);
    console.log(`\nALLOWED ACTIONS: ${allowedActions(full.data).join(", ")}`);
    console.log(`\nNEWEST DISPUTE ID: ${newest.dispute_id}`);
    return;
  }

  if (cmd === "offer") {
    if (!arg) return console.log("Usage: offer <disputeId>");
    const before = await call(token, "GET", `/v1/customer/disputes/${arg}`);
    console.log(`\nStatus before: ${before.data.status} | allowed: ${allowedActions(before.data).join(", ")}`);

    const msg = await call(token, "POST", `/v1/customer/disputes/${arg}/send-message`, {
      message: "Hello, this is Meera Handlooms. We are looking into your order and will propose a fair resolution.",
    });
    log("send-message", msg);

    const offer = await call(token, "POST", `/v1/customer/disputes/${arg}/make-offer`, {
      note: "We are sorry about the delay. We would like to offer a partial refund.",
      offer_amount: { currency_code: "USD", value: "15.00" },
      offer_type: "REFUND",
    });
    log("make-offer (partial REFUND $15)", offer);

    const after = await call(token, "GET", `/v1/customer/disputes/${arg}`);
    console.log(`\nStatus after: ${after.data.status} | allowed: ${allowedActions(after.data).join(", ")}`);
    log("Offer on the dispute", after.data.offer);
    return;
  }

  if (cmd === "status") {
    if (!arg) return console.log("Usage: status <disputeId>");
    const r = await call(token, "GET", `/v1/customer/disputes/${arg}`);
    log("Dispute", {
      http: r.status,
      status: r.data.status,
      stage: r.data.dispute_life_cycle_stage,
      outcome: r.data.dispute_outcome,
      offer: r.data.offer,
      refund_details: r.data.refund_details,
      allowed: allowedActions(r.data),
      messages: r.data.messages,
    });
    return;
  }

  console.log("Commands: order | capture <orderId> | disputes | offer <disputeId> | status <disputeId>");
}

main().catch((e) => {
  console.error("Crashed:", e);
  process.exit(1);
});
