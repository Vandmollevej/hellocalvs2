import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { queueMessage } from "@/lib/messaging";

const INVITATION_VALID_DAYS = 7;

type RouteContext = { params: Promise<{ id: string }> };

// Gensend en allerede sendt invitation: bumper sentAt/expiresAt på den
// eksisterende række i stedet for at oprette en ny (fejl #12D).
export async function POST(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at gensende en invitation" }, { status: 401 });

  const existing = await prisma.sentInvitation.findFirst({ where: { id, inviterId: user.id } });
  if (!existing) return NextResponse.json({ message: "Invitationen findes ikke" }, { status: 404 });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_VALID_DAYS * 24 * 60 * 60 * 1000);
  const invitation = await prisma.sentInvitation.update({
    where: { id },
    data: { sentAt: now, expiresAt },
  });

  const inviteUrl = `${process.env.APP_BASE_URL ?? "https://hellocal.packroff.dk"}/signup?ref=${user.referralCode}`;
  await queueMessage("FRIEND_INVITATION", {
    toEmail: existing.email,
    vars: { inviterName: user.displayName, inviteUrl },
  });

  return NextResponse.json({ invitation });
}
