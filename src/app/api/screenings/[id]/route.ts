import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { toScreeningDto } from "@/lib/screenings-server";
import { parseScreeningBody } from "@/lib/screenings-body";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = parseScreeningBody(await req.json().catch(() => null), false);
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const existing = await prisma.screening.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ message: "Screeningen findes ikke" }, { status: 404 });
    const row = await prisma.screening.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ screening: toScreeningDto(row) });
  } catch (error) {
    console.error("Screening update failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

// Sletter screeningen og alle dens målinger (ScreeningEntry cascader).
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const result = await prisma.screening.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) return NextResponse.json({ message: "Screeningen findes ikke" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Screening delete failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
