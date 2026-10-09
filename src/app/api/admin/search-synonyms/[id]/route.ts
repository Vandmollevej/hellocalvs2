import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/search-synonyms/:id — { similarity } (0–100)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const n = Number(body?.similarity);
  const similarity = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 100;
  const synonym = await prisma.searchSynonym.update({ where: { id }, data: { similarity } }).catch(() => null);
  if (!synonym) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  return NextResponse.json({ synonym });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.searchSynonym.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
