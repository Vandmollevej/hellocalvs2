import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se dine invitationer" }, { status: 401 });

  const referrals = await prisma.referral.findMany({
    where: { referrerId: user.id },
    include: { referredUser: { select: { displayName: true } } },
    orderBy: { referredRegisteredAt: "desc" },
  });

  return NextResponse.json({ referralCode: user.referralCode, referrals });
}
