import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { toEntryDto, toScreeningDto } from "@/lib/screenings-server";
import { averageAnswer, cleanAnswers } from "@/lib/screenings";

type Ctx = { params: Promise<{ id: string }> };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Alle målinger for én screening (rapporten), nyeste først.
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const screening = await prisma.screening.findFirst({ where: { id, userId: user.id } });
    if (!screening) return NextResponse.json({ message: "Screeningen findes ikke" }, { status: 404 });
    const entries = await prisma.screeningEntry.findMany({
      where: { screeningId: id, userId: user.id },
      orderBy: { date: "desc" },
      take: 1000,
    });
    return NextResponse.json({ screening: toScreeningDto(screening), entries: entries.map(toEntryDto) });
  } catch (error) {
    console.error("Screening entries failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

// PUT { date, answers, note } — én måling pr. dag; en ny erstatter den gamle.
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { date?: string; answers?: unknown; note?: unknown } | null;
  if (!body?.date || !DATE_RE.test(body.date)) {
    return NextResponse.json({ message: "Ugyldig dato" }, { status: 400 });
  }
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const row = await prisma.screening.findFirst({ where: { id, userId: user.id } });
    if (!row) return NextResponse.json({ message: "Screeningen findes ikke" }, { status: 404 });
    const screening = toScreeningDto(row);
    const answers = cleanAnswers(body.answers, screening.questions, screening.scale);
    if (Object.keys(answers).length === 0) {
      return NextResponse.json({ message: "Besvar mindst ét spørgsmål" }, { status: 400 });
    }
    const note = screening.notesEnabled && typeof body.note === "string" ? body.note.trim().slice(0, 1000) || null : null;
    const data = { answers, value: averageAnswer(answers), note };
    const entry = await prisma.screeningEntry.upsert({
      where: { screeningId_date: { screeningId: id, date: new Date(body.date) } },
      update: data,
      create: { ...data, screeningId: id, userId: user.id, date: new Date(body.date) },
    });
    return NextResponse.json({ entry: toEntryDto(entry) });
  } catch (error) {
    console.error("Screening entry save failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const date = new URL(req.url).searchParams.get("date");
  if (!date || !DATE_RE.test(date)) return NextResponse.json({ message: "Ugyldig dato" }, { status: 400 });
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    await prisma.screeningEntry.deleteMany({ where: { screeningId: id, userId: user.id, date: new Date(date) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Screening entry delete failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
