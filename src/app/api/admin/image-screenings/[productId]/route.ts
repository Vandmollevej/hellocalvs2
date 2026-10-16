import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// Admin afviser en markering fra nat-jobbet "image-screen-local"
// (docs/DECISIONS.md 2026-10-16). Rører aldrig varen eller billedet.
export async function PATCH(_req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { productId } = await params;
  await prisma.productImageScreening.update({ where: { productId }, data: { reviewedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
