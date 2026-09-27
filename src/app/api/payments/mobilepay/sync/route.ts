import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getSubscriptionTier } from "@/lib/subscription";
import { syncUserMobilePay } from "@/lib/payments/mobilepay-subscription";

// Kaldes af /settings/payment/mobilepay, når brugeren kommer tilbage fra
// MobilePay-appen: henter aftalens status med det samme i stedet for at
// vente på webhook/scheduler.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
  await syncUserMobilePay(user.id).catch((error) => console.error("[mobilepay] sync fejlede", error));
  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
  const state = subscription?.pendingAgreementId
    ? "pending"
    : subscription?.provider === "MOBILEPAY_ONLINE" && subscription.providerSubscriptionId
      ? "active"
      : "none";
  return NextResponse.json({ state, tier: getSubscriptionTier(subscription) });
}
