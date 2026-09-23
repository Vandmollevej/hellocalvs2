import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isBase64Url } from "@/lib/vault/server";

// PUT { iv, ciphertext } — ejerens enhed lægger en ny krypteret rapport
// (docs/PRIVACY.md). Serveren kan ikke læse den.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { iv?: unknown; ciphertext?: unknown } | null;
  if (!isBase64Url(body?.iv, 32) || !isBase64Url(body?.ciphertext, 4 * 1024 * 1024)) {
    return NextResponse.json({ message: "Ugyldig rapport" }, { status: 400 });
  }
  const result = await prisma.doctorShare.updateMany({
    where: { id, ownerId: user.id, status: { in: ["PENDING", "ACTIVE"] } },
    data: { snapshotIv: body!.iv as string, snapshotCiphertext: body!.ciphertext as string, snapshotUpdatedAt: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
