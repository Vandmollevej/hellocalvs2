import { NextResponse } from "next/server";
import { verifyStripeSignature, type StripeEvent } from "@/lib/payments/stripe-client";
import { handleStripeEvent, stripeWebhookSecrets } from "@/lib/payments/stripe-subscription";

// Webhook fra Stripe. Signaturen verificeres mod hemmeligheden fra registreringen
// (eller STRIPE_WEBHOOK_SECRET); status hentes derefter direkte fra Stripe.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const secrets = await stripeWebhookSecrets();
  if (secrets.length === 0) return NextResponse.json({ message: "Webhook ikke registreret" }, { status: 503 });

  const header = req.headers.get("stripe-signature");
  if (!secrets.some((secret) => verifyStripeSignature(rawBody, header, secret))) {
    return NextResponse.json({ message: "Ugyldig signatur" }, { status: 401 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ message: "Ugyldigt indhold" }, { status: 400 });
  }
  try {
    await handleStripeEvent(event);
  } catch (error) {
    // 500 får Stripe til at prøve igen.
    console.error("[stripe] webhook-behandling fejlede", event.type, error);
    return NextResponse.json({ message: "Fejl" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
