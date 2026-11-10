/**
 * Makes demo orders for Meera Handlooms, the fictional shop in Parley's demo.
 * Uses PayPal's official Server SDK (lib/paypal/client.ts).
 *
 *   npm run seed create 6     create 6 orders and print a pay link for each
 *   (the buyer opens each link, logs in, picks Visa and pays)
 *   npm run seed finish       take the payment for every paid order and add tracking numbers
 *   npm run seed list         show every order and its state
 *
 * Orders are remembered in .seed-orders.json (on this computer only).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { existsSync, readFileSync, writeFileSync } from "node:fs";

type Seed = {
  orderId: string;
  item: string;
  amount: string;
  payLink?: string;
  captureId?: string;
  tracking?: string | null;
  state: "created" | "paid" | "failed";
  note?: string;
};

const FILE = ".seed-orders.json";
const load = (): Seed[] => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : []);
const save = (s: Seed[]) => writeFileSync(FILE, JSON.stringify(s, null, 2));

// Item, price, and whether the seller adds a tracking number after payment.
const CATALOG: Array<[string, string, boolean]> = [
  ["Handwoven cotton sari, indigo - Meera Handlooms", "40.00", true],
  ["Block-print cushion covers, set of 2, mustard - Meera Handlooms", "28.00", true],
  ["Handloom table runner, natural linen - Meera Handlooms", "35.00", true],
  ["Kanchi cotton stole, maroon - Meera Handlooms", "22.00", true],
  ["Ikat tote bag, teal - Meera Handlooms", "30.00", false],
  ["Handwoven bedspread, ivory - Meera Handlooms", "64.00", true],
];

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const { createOrder, captureOrder, addTracking } = await import("../lib/paypal/client");
  const seeds = load();

  if (cmd === "create") {
    const n = Math.min(Number(arg) || 6, 20);
    for (let i = 0; i < n; i++) {
      // seeds grows by one each round, so its length alone walks through the catalog in order.
      const [item, amount] = CATALOG[seeds.length % CATALOG.length];
      const { orderId, payLink } = await createOrder({
        amount,
        description: item,
        returnUrl: "https://example.com/paid",
        cancelUrl: "https://example.com/cancelled",
      });
      seeds.push({ orderId, item, amount, payLink, state: "created" });
      save(seeds);
      console.log(`\n${seeds.length}. ${item}  $${amount}\n   PAY LINK: ${payLink}`);
    }
    console.log(`\nCreated ${n} orders. Open each pay link as the buyer, choose Visa, and pay. Then run: npm run seed finish`);
    return;
  }

  if (cmd === "finish") {
    for (const s of seeds.filter((x) => x.state === "created")) {
      try {
        const cap = await captureOrder(s.orderId);
        if (cap.status !== "COMPLETED" || !cap.captureId) throw new Error(`capture status ${cap.status}`);
        s.captureId = cap.captureId;
        s.state = "paid";
        const wantsTracking = CATALOG.find((c) => c[0] === s.item)?.[2] ?? true;
        if (wantsTracking) {
          const number = `EE${String(Date.now()).slice(-9)}IN`;
          try {
            await addTracking(s.orderId, cap.captureId, number);
            s.tracking = number;
          } catch (e) {
            s.tracking = null;
            s.note = `tracking failed: ${(e as Error).message.slice(0, 200)}`;
          }
        } else {
          s.tracking = null;
        }
        console.log(`PAID   ${s.orderId}  ${s.item}  $${s.amount}  tracking: ${s.tracking ?? "none"}${s.note ? `  (${s.note})` : ""}`);
      } catch (e) {
        // The SDK's error often has an empty message; the useful part is in its result or body.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = e as any;
        const issue = err?.result?.details?.[0]?.issue || err?.result?.name || err?.message || `HTTP ${err?.statusCode ?? "?"}`;
        s.note = String(issue).slice(0, 200);
        const why = s.note === "ORDER_NOT_APPROVED" ? "the buyer has not paid this one yet" : s.note;
        console.log(`NOT PAID YET  ${s.orderId}  $${s.amount}  ${s.item}  -  ${why}\n   PAY LINK: ${s.payLink}`);
      }
      save(seeds);
    }
    const paid = seeds.filter((s) => s.state === "paid").length;
    console.log(`\n${paid} of ${seeds.length} orders are paid and ready for the buyer to dispute.`);
    return;
  }

  if (cmd === "list") {
    for (const [i, s] of seeds.entries()) {
      console.log(`${i + 1}. ${s.state.toUpperCase()}  ${s.orderId}  $${s.amount}  ${s.item}  tracking: ${s.tracking ?? "none"}${s.state === "created" ? `\n   PAY LINK: ${s.payLink}` : ""}`);
    }
    if (!seeds.length) console.log("No orders yet. Run: npm run seed create 6");
    return;
  }

  console.log("Commands: create <count> | finish | list");
}

main().catch((e) => {
  console.error("Seed script failed:", (e as Error).message);
  process.exit(1);
});
