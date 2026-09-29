import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isSubscriptionPeriod, isSubscriptionPlan } from "@/lib/subscription-plans";
import { StripeError } from "@/lib/payments/stripe-client";
import { startStripeCheckout, StripeUnavailableError } from "@/lib/payments/stripe-subscription";

// Starter Stripe Checkout for den valgte plan og periode. Prisen og betalings-
// metoden (MobilePay i DK, kort/EC i DE) vælges her på serveren ud fra
// brugerens land — klienten sender kun plan + periode.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at købe et abonnement" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { plan?: string; months?: number; withdrawalAck?: boolean };
  const plan = body.plan ?? "serious";
  const months = Number(body.months ?? 1);
  if (!isSubscriptionPlan(plan) || !isSubscriptionPeriod(months)) {
    return NextResponse.json({ message: "Ukendt abonnement" }, { status: 400 });
  }
  // Straks-levering og fortrydelsesret skal være bekræftet (forbrugeraftaleloven).
  if (body.withdrawalAck !== true) {
    return NextResponse.json({ message: "Bekræft betingelserne for at fortsætte" }, { status: 400 });
  }

  try {
    const { url } = await startStripeCheckout(user, plan, months);
    return NextResponse.json({ confirmationUrl: url });
  } catch (error) {
    if (error instanceof StripeUnavailableError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error("[stripe] checkout kunne ikke oprettes", error instanceof StripeError ? error.body : error);
    return NextResponse.json({ message: "Betalingen svarer ikke lige nu. Prøv igen om lidt." }, { status: 502 });
  }
}
