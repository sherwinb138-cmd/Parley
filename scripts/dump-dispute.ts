/**
 * Prints everything PayPal knows about one dispute: the dispute itself, the payment (capture)
 * behind it, and the order behind that. Used to see the exact field names before writing import code.
 * Sandbox data only; prints no keys.
 *
 * Run it with:  npx tsx scripts/dump-dispute.ts PP-R-XXX-00000000
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const id = process.argv[2];
  if (!id) return console.log("Usage: npx tsx scripts/dump-dispute.ts <disputeId>");
  const { paypalFetch } = await import("../lib/paypal/token");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispute: any = await paypalFetch("GET", `/v1/customer/disputes/${id}`);
  console.log("=== DISPUTE ===\n" + JSON.stringify(dispute, null, 2));

  const tx = dispute.disputed_transactions?.[0];
  for (const captureId of [tx?.seller_transaction_id, tx?.buyer_transaction_id].filter(Boolean)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const capture: any = await paypalFetch("GET", `/v2/payments/captures/${captureId}`);
      console.log(`=== CAPTURE ${captureId} ===\n` + JSON.stringify(capture, null, 2));
      const orderId = capture.supplementary_data?.related_ids?.order_id;
      if (orderId) {
        const order = await paypalFetch("GET", `/v2/checkout/orders/${orderId}`);
        console.log(`=== ORDER ${orderId} ===\n` + JSON.stringify(order, null, 2));
      }
      break;
    } catch (e) {
      console.log(`=== CAPTURE ${captureId} FAILED === ${(e as Error).message}`);
    }
  }
}

main();
