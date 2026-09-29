import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { StripeError } from "@/lib/payments/stripe-client";
import { cancelStripe, StripeUnavailableError } from "@/lib/payments/stripe-subscription";

// Opsiger brugerens Stripe-abonnement ved periodens udløb. Seriøs løber perioden ud.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
  try {
    await cancelStripe(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StripeUnavailableError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error("[stripe] opsigelse fejlede", error instanceof StripeError ? error.body : error);
    return NextResponse.json({ message: "Betalingen svarer ikke lige nu. Prøv igen om lidt." }, { status: 502 });
  }
}
