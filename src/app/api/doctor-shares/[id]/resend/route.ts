import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { queueMessage } from "@/lib/messaging";
import { DOCTOR_SHARE_INVITATION_VALID_DAYS } from "@/lib/doctor-share";

// Same "bump sentAt/expiresAt and requeue" pattern as
// /api/invitations/[id]/resend — only meaningful while the invitation is
// still PENDING (an accepted/ACTIVE share doesn't need re-sending).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at gensende denne invitation" }, { status: 401 });

  const { id } = await params;
  const share = await prisma.doctorShare.findFirst({ where: { id, ownerId: user.id } });
  if (!share) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  if (share.status !== "PENDING") {
    return NextResponse.json({ message: "Invitationen er allerede accepteret" }, { status: 400 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + DOCTOR_SHARE_INVITATION_VALID_DAYS * 24 * 60 * 60 * 1000);
  const updated = await prisma.doctorShare.update({
    where: { id },
    data: { sentAt: now, expiresAt },
  });

  const viewUrl = `${process.env.APP_BASE_URL ?? "https://hellocal.packroff.dk"}/hello-doc/${updated.token}`;
  await queueMessage("DOCTOR_SHARE_INVITATION", {
    toEmail: updated.email,
    vars: { ownerName: user.displayName, viewUrl },
  });

  return NextResponse.json({ share: updated });
}
