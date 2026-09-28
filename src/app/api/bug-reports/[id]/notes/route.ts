import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

const MAX_NOTE_LENGTH = 1000;

// Notesystem på "Indberet fejl": brugeren kan tilføje noter til sin egen
// indberetning, så længe den afventer gennemgang. Noterne supplerer den
// oprindelige beskrivelse og vises for admin på /admin/bug-reports.
async function loadOwnReport(id: string, userId: string) {
  const report = await prisma.bugReport.findUnique({ where: { id }, select: { userId: true, status: true } });
  return report && report.userId === userId ? report : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Log ind for at se noter" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await loadOwnReport(id, user.id))) {
    return NextResponse.json({ message: "Indberetningen findes ikke" }, { status: 404 });
  }

  const notes = await prisma.bugReportNote.findMany({
    where: { bugReportId: id },
    select: { id: true, text: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ notes });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Log ind for at skrive en note" }, { status: 401 });
  }

  const { id } = await params;
  const report = await loadOwnReport(id, user.id);
  if (!report) {
    return NextResponse.json({ message: "Indberetningen findes ikke" }, { status: 404 });
  }
  if (report.status !== "PENDING") {
    return NextResponse.json({ message: "Denne indberetning er allerede behandlet" }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ message: "Skriv en note" }, { status: 400 });
  }
  if (text.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ message: `Noten må højst være ${MAX_NOTE_LENGTH} tegn` }, { status: 400 });
  }

  const note = await prisma.bugReportNote.create({
    data: { bugReportId: id, userId: user.id, text },
    select: { id: true, text: true, createdAt: true },
  });

  return NextResponse.json({ note }, { status: 201 });
}
