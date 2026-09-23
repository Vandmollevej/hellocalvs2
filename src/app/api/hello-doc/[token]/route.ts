import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDoctorSharePendingExpired } from "@/lib/doctor-share";

// Hello Doc — lægens visning (docs/DECISIONS.md 2026-09-12). Rapporten er
// krypteret på ejerens enhed (docs/PRIVACY.md); nøglen står kun i lægens
// link (#k=…) og dekrypteres i lægens browser. Serveren udleverer kun
// status og ciphertext.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await prisma.doctorShare.findUnique({ where: { token } });
  if (!share) return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });

  let status = share.status;
  if (isDoctorSharePendingExpired(share)) {
    status = "EXPIRED";
    await prisma.doctorShare.update({ where: { id: share.id }, data: { status: "EXPIRED" } });
  }
  if (status === "REVOKED" || status === "EXPIRED") return NextResponse.json({ status });

  return NextResponse.json({
    status,
    expiresAt: share.expiresAt,
    snapshot:
      share.snapshotIv && share.snapshotCiphertext
        ? { iv: share.snapshotIv, ciphertext: share.snapshotCiphertext, updatedAt: share.snapshotUpdatedAt }
        : null,
  });
}

// POST — lægen accepterer invitationen.
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await prisma.doctorShare.findUnique({ where: { token } });
  if (!share) return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });
  if (share.status !== "PENDING") return NextResponse.json({ status: share.status });
  if (isDoctorSharePendingExpired(share)) {
    await prisma.doctorShare.update({ where: { id: share.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ status: "EXPIRED" });
  }
  const updated = await prisma.doctorShare.update({
    where: { id: share.id },
    data: { status: "ACTIVE", acceptedAt: new Date() },
  });
  return NextResponse.json({ status: updated.status });
}
