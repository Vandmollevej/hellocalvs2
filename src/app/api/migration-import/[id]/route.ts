import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// Én import med alle aflæste rækker (til gennemsyn før import).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const found = await prisma.migrationImport.findFirst({
    where: { id, userId: user.id },
    include: { rows: { orderBy: [{ date: "asc" }, { meal: "asc" }, { createdAt: "asc" }] } },
  });
  if (!found) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  return NextResponse.json({ import: found });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const result = await prisma.migrationImport.deleteMany({ where: { id, userId: user.id } });
  if (!result.count) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
