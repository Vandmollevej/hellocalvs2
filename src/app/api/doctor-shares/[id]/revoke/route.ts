import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { SHARE_SELECT } from "@/lib/doctor-share-server";

// POST — tilbagekalder adgangen og sletter den krypterede rapport.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at fjerne denne adgang" }, { status: 401 });
  const { id } = await params;
  const share = await prisma.doctorShare.findFirst({ where: { id, ownerId: user.id }, select: { id: true } });
  if (!share) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  const updated = await prisma.doctorShare.update({
    where: { id },
    data: { status: "REVOKED", revokedAt: new Date(), snapshotIv: null, snapshotCiphertext: null },
    select: SHARE_SELECT,
  });
  return NextResponse.json({ share: updated });
}
