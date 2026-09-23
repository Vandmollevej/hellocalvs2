import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getSubscriptionTier } from "@/lib/subscription";
import {
  DOCTOR_SHARE_INVITATION_VALID_DAYS,
  sanitizeDoctorShareCategories,
  isDoctorShareHistoryRange,
} from "@/lib/doctor-share";
import { SHARE_SELECT } from "@/lib/doctor-share-server";

// Hello Doc (docs/DECISIONS.md 2026-09-12), omlagt efter docs/PRIVACY.md:
// modtagerens navn og e-mail og rapportens nøgle ligger i ejerens boks.
// Serveren kender kun delingens status, kategorier og periode samt den
// krypterede rapport. Invitationen sender ejeren selv fra sin mail-app, så
// linkets nøgle aldrig passerer serveren.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se dine Hello Doc-invitationer" }, { status: 401 });
  const shares = await prisma.doctorShare.findMany({
    where: { ownerId: user.id, status: { not: "REVOKED" } },
    orderBy: { sentAt: "desc" },
    select: SHARE_SELECT,
  });
  return NextResponse.json({ shares });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at invitere en bruger" }, { status: 401 });
  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (getSubscriptionTier(subscription) !== "SERIOUS") {
    return NextResponse.json({ message: "Hello Doc kræver abonnementet Seriøs" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { categories?: unknown; historyRange?: unknown } | null;
  const now = new Date();
  const share = await prisma.doctorShare.create({
    data: {
      ownerId: user.id,
      categories: sanitizeDoctorShareCategories(body?.categories),
      historyRange: isDoctorShareHistoryRange(body?.historyRange) ? body.historyRange : "ALL",
      sentAt: now,
      expiresAt: new Date(now.getTime() + DOCTOR_SHARE_INVITATION_VALID_DAYS * 24 * 60 * 60 * 1000),
    },
    select: SHARE_SELECT,
  });
  return NextResponse.json({ share });
}
