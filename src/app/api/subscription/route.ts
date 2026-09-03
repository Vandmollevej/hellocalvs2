import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// Udbyder-uafhængig (docs/DECISIONS.md 2026-09-02): viser status og gemte
// betalingsmetoder, men opretter/ændrer intet hos en PSP — der er endnu
// ingen indløsningsaftale.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se din betaling" }, { status: 401 });

  const [subscription, paymentMethods] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: user.id } }),
    prisma.paymentMethod.findMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    subscription: subscription ?? { status: "INACTIVE", freeMonthsRemaining: 0 },
    paymentMethods,
  });
}
