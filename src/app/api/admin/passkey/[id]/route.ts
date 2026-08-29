import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const passkey = await prisma.passkey.findUnique({ where: { id } });
  if (!passkey || passkey.userId !== admin.id) {
    return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  }
  await prisma.passkey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
