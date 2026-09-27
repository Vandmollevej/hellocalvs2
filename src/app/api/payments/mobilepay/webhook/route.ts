import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/mobilepay-client";
import {
  handleMobilePayWebhook,
  mobilePayWebhookSecret,
  mobilePayWebhookUrl,
} from "@/lib/payments/mobilepay-subscription";

// Webhook fra Vipps MobilePay. Signaturen verificeres mod hemmeligheden fra
// registreringen; selve indholdet bruges kun til at finde aftalen, hvis
// status derefter hentes direkte fra MobilePay.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = await mobilePayWebhookSecret();
  if (!secret) return NextResponse.json({ message: "Webhook ikke registreret" }, { status: 503 });

  // Signaturen er lavet over den adresse, webhooken er registreret med —
  // ikke den interne adresse bag reverse-proxyen.
  const registered = new URL(mobilePayWebhookUrl());
  const valid = verifyWebhookSignature({
    secret,
    pathAndQuery: `${registered.pathname}${new URL(req.url).search}`,
    host: registered.host,
    rawBody,
    date: req.headers.get("x-ms-date"),
    contentSha256: req.headers.get("x-ms-content-sha256"),
    authorization: req.headers.get("authorization"),
  });
  if (!valid) return NextResponse.json({ message: "Ugyldig signatur" }, { status: 401 });

  let payload: { agreementId?: string; chargeId?: string } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Ugyldigt indhold" }, { status: 400 });
  }
  await handleMobilePayWebhook(payload).catch((error) => console.error("[mobilepay] webhook-behandling fejlede", error));
  return NextResponse.json({ ok: true });
}
