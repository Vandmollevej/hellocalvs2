import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { queueMessage } from "@/lib/messaging";
import {
  DOCTOR_SHARE_INVITATION_VALID_DAYS,
  sanitizeDoctorShareCategories,
  isDoctorShareHistoryRange,
} from "@/lib/doctor-share";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Hello Doc (docs/DECISIONS.md 2026-09-12): "Inviterede brugere" list on
// /settings/hello-doc. Revoked shares are hidden from the normal list —
// they aren't deleted, just excluded here.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se dine Hello Doc-invitationer" }, { status: 401 });

  const shares = await prisma.doctorShare.findMany({
    where: { ownerId: user.id, status: { not: "REVOKED" } },
    orderBy: { sentAt: "desc" },
  });

  return NextResponse.json({ shares });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at invitere en bruger" }, { status: 401 });

  let body: { name?: string; email?: string; categories?: unknown; historyRange?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!name) return NextResponse.json({ message: "Angiv et navn" }, { status: 400 });
  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ message: "Angiv en gyldig e-mailadresse" }, { status: 400 });
  }

  const categories = sanitizeDoctorShareCategories(body.categories);
  const historyRange = isDoctorShareHistoryRange(body.historyRange) ? body.historyRange : "ALL";

  const now = new Date();
  const expiresAt = new Date(now.getTime() + DOCTOR_SHARE_INVITATION_VALID_DAYS * 24 * 60 * 60 * 1000);

  const share = await prisma.doctorShare.create({
    data: { ownerId: user.id, name, email, categories, historyRange, sentAt: now, expiresAt },
  });

  const viewUrl = `${process.env.APP_BASE_URL ?? "https://hellocal.packroff.dk"}/hello-doc/${share.token}`;
  await queueMessage("DOCTOR_SHARE_INVITATION", {
    toEmail: email,
    vars: { ownerName: user.displayName, viewUrl },
  });

  return NextResponse.json({ share });
}
