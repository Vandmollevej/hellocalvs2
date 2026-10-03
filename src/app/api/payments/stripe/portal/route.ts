import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { StripeError } from "@/lib/payments/stripe-client";
import { startStripePaymentMethodUpdate, StripeUnavailableError } from "@/lib/payments/stripe-subscription";

// "Skift betalingsmetode" på /settings/payment: åbner Stripes kundeportal i
// kort-skift-flowet. Kortdata indtastes hos Stripe; vi henter kun det nye
// korts mærke/sidste 4/wallet, når brugeren vender tilbage.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
  try {
    const { url } = await startStripePaymentMethodUpdate(user);
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof StripeUnavailableError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error("[stripe] kundeportal kunne ikke åbnes", error instanceof StripeError ? error.body : error);
    return NextResponse.json({ message: "Betalingen svarer ikke lige nu. Prøv igen om lidt." }, { status: 502 });
  }
}
