import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { MobilePayError } from "@/lib/payments/mobilepay-client";
import { cancelMobilePay, MobilePayUnavailableError } from "@/lib/payments/mobilepay-subscription";

// Stopper brugerens MobilePay-aftale. Seriøs løber den betalte periode ud.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
  try {
    await cancelMobilePay(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MobilePayUnavailableError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error("[mobilepay] opsigelse fejlede", error instanceof MobilePayError ? error.body : error);
    return NextResponse.json({ message: "MobilePay svarer ikke lige nu. Prøv igen om lidt." }, { status: 502 });
  }
}
