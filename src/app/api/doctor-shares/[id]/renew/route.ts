import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { queueMessage } from "@/lib/messaging";

// "Forny adgang" for en udløbet eller fjernet adgang. Har modtageren allerede
// accepteret, åbnes adgangen igen direkte; ellers sendes invitationen igen
// uden udløbsdato (ejeren kan vælge en ny dato bagefter).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at forny denne adgang" }, { status: 401 });

  const { id } = await params;
  const share = await prisma.doctorShare.findFirst({ where: { id, ownerId: user.id } });
  if (!share) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });

  if (share.acceptedAt) {
    const updated = await prisma.doctorShare.update({
      where: { id },
      data: { status: "ACTIVE", revokedAt: null, expiresAt: null },
    });
    return NextResponse.json({ share: updated });
  }

  const now = new Date();
  const updated = await prisma.doctorShare.update({
    where: { id },
    data: { status: "PENDING", revokedAt: null, sentAt: now, expiresAt: null },
  });

  const viewUrl = `${process.env.APP_BASE_URL ?? "https://hellocal.io"}/hello-doc/${updated.token}`;
  await queueMessage("DOCTOR_SHARE_INVITATION", {
    toEmail: updated.email,
    vars: { ownerName: user.displayName, viewUrl },
  });

  return NextResponse.json({ share: updated });
}
