import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { queueMessage } from "@/lib/messaging";

// Fejlretninger/FEJLLISTE.md #12D: sendte invitationer (adskilt fra
// Referral, som kun findes efter modtageren rent faktisk opretter en
// konto). En invitation er gyldig 1 uge.
const INVITATION_VALID_DAYS = 7;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se dine invitationer" }, { status: 401 });

  const invitations = await prisma.sentInvitation.findMany({
    where: { inviterId: user.id },
    orderBy: { sentAt: "desc" },
  });

  return NextResponse.json({ invitations });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at sende en invitation" }, { status: 401 });

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ message: "Angiv en gyldig e-mailadresse" }, { status: 400 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_VALID_DAYS * 24 * 60 * 60 * 1000);
  const invitation = await prisma.sentInvitation.create({
    data: { inviterId: user.id, email, sentAt: now, expiresAt },
  });

  const inviteUrl = `${process.env.APP_BASE_URL ?? "https://hellocal.packroff.dk"}/signup?ref=${user.referralCode}`;
  await queueMessage("FRIEND_INVITATION", {
    toEmail: email,
    vars: { inviterName: user.displayName, inviteUrl },
  });

  return NextResponse.json({ invitation });
}
