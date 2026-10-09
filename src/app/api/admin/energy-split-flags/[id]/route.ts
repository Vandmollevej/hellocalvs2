import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFullAdminUser } from "@/lib/require-admin";

// Admin "Usikkerheder" → Energi-afvigelser (docs/DECISIONS.md 2026-10-07):
// markér et flag som undersøgt. Varen røres ikke.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await prisma.productEnergySplitFlag.updateMany({ where: { id }, data: { reviewedAt: new Date() } });
  if (!result.count) return NextResponse.json({ message: "Ukendt flag" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
