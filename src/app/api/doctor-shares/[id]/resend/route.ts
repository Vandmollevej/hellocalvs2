import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { DOCTOR_SHARE_INVITATION_VALID_DAYS } from "@/lib/doctor-share";
import { SHARE_SELECT } from "@/lib/doctor-share-server";

// POST — forlænger invitationens frist. Selve mailen sender ejeren fra sin
// egen mail-app (docs/PRIVACY.md), så linkets nøgle aldrig passerer serveren.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at gensende denne invitation" }, { status: 401 });
  const { id } = await params;
  const share = await prisma.doctorShare.findFirst({ where: { id, ownerId: user.id }, select: { status: true } });
  if (!share) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  if (share.status !== "PENDING") {
    return NextResponse.json({ message: "Invitationen er allerede accepteret" }, { status: 400 });
  }
  const now = new Date();
  const updated = await prisma.doctorShare.update({
    where: { id },
    data: { sentAt: now, expiresAt: new Date(now.getTime() + DOCTOR_SHARE_INVITATION_VALID_DAYS * 24 * 60 * 60 * 1000) },
    select: SHARE_SELECT,
  });
  return NextResponse.json({ share: updated });
}
