import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  isSubscriptionPeriod,
  isSubscriptionPlan,
  SUBSCRIPTION_PRICES_DKK,
} from "@/lib/subscription-plans";
import { MobilePayError } from "@/lib/payments/mobilepay-client";
import { MobilePayUnavailableError, startMobilePayAgreement } from "@/lib/payments/mobilepay-subscription";

const PLAN_NAMES = { serious: "Hello Cal Seriøs", family: "Hello Cal Seriøs Familie" } as const;

// Starter en MobilePay-aftale for den valgte plan og periode. Prisen slås
// altid op her på serveren — klienten sender kun plan + periode.
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
    const { confirmationUrl } = await startMobilePayAgreement(user.id, {
      amountOre: SUBSCRIPTION_PRICES_DKK[plan][months] * 100,
      intervalMonths: months,
      productName: PLAN_NAMES[plan],
    });
    return NextResponse.json({ confirmationUrl });
  } catch (error) {
    if (error instanceof MobilePayUnavailableError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error("[mobilepay] aftale kunne ikke oprettes", error instanceof MobilePayError ? error.body : error);
    return NextResponse.json({ message: "MobilePay svarer ikke lige nu. Prøv igen om lidt." }, { status: 502 });
  }
}
