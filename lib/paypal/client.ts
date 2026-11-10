// PayPal orders and payments through the official Server SDK (@paypal/paypal-server-sdk).
// Disputes are not in the SDK; they live in ./disputes.ts as raw REST.
import {
  CheckoutPaymentIntent,
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  PaypalExperienceUserAction,
  ShipmentCarrier,
} from "@paypal/paypal-server-sdk";

let client: Client | null = null;

function sdk(): Client {
  if (client) return client;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing");
  client = new Client({
    clientCredentialsAuthCredentials: { oAuthClientId: id, oAuthClientSecret: secret },
    environment: Environment.Sandbox, // Parley is sandbox-only
    timeout: 20000,
  });
  return client;
}

/** Create an order the buyer approves while logged in to PayPal. Returns the order ID and the pay link. */
export async function createOrder(input: { amount: string; description: string; returnUrl: string; cancelUrl: string }) {
  const { result } = await new OrdersController(sdk()).createOrder({
    paypalRequestId: `parley-order-${Date.now()}`,
    prefer: "return=representation",
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          amount: { currencyCode: "USD", value: input.amount },
          description: input.description,
        },
      ],
      paymentSource: {
        paypal: {
          experienceContext: {
            userAction: PaypalExperienceUserAction.PayNow,
            returnUrl: input.returnUrl,
            cancelUrl: input.cancelUrl,
          },
        },
      },
    },
  });
  const payLink = result.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  return { orderId: result.id!, payLink };
}

/** Capture an approved order. Returns the capture ID and PayPal's seller-protection status. */
export async function captureOrder(orderId: string) {
  const { result } = await new OrdersController(sdk()).captureOrder({ id: orderId, prefer: "return=representation" });
  const capture = result.purchaseUnits?.[0]?.payments?.captures?.[0];
  return {
    status: result.status,
    captureId: capture?.id,
    sellerProtection: capture?.sellerProtection?.status,
    payerEmail: result.payer?.emailAddress,
  };
}

export async function getOrder(orderId: string) {
  const { result } = await new OrdersController(sdk()).getOrder({ id: orderId });
  return result;
}

export async function getCapture(captureId: string) {
  const { result } = await new PaymentsController(sdk()).getCapturedPayment({ captureId });
  return result;
}

/** Add a tracking number to an order. This is the seller's proof of shipment. */
export async function addTracking(orderId: string, captureId: string, trackingNumber: string, carrierName = "India Post") {
  const { result } = await new OrdersController(sdk()).createOrderTracking({
    id: orderId,
    body: {
      captureId,
      trackingNumber,
      carrier: ShipmentCarrier.Other,
      carrierNameOther: carrierName,
      notifyPayer: false,
    },
  });
  return result;
}
