import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { toScreeningDto } from "@/lib/screenings-server";
import { parseScreeningBody } from "@/lib/screenings-body";

// Screeninger (docs/DECISIONS.md 2026-10-09).
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const rows = await prisma.screening.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ seeded: user.screeningsSeeded, screenings: rows.map(toScreeningDto) });
  } catch (error) {
    console.error("Screenings list failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const parsed = parseScreeningBody(await req.json().catch(() => null), true);
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const last = await prisma.screening.findFirst({
      where: { userId: user.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const row = await prisma.screening.create({
      data: {
        ...parsed.data,
        name: parsed.data.name ?? "",
        questions: parsed.data.questions ?? [],
        userId: user.id,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json({ screening: toScreeningDto(row) });
  } catch (error) {
    console.error("Screening create failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
