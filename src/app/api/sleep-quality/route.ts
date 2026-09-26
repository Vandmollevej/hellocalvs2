import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { isValidSleepQualityRating } from "@/lib/sleep-quality";

// Oplevelse af søvn (docs/DECISIONS.md 2026-09-26). Dates are "YYYY-MM-DD".
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toEntry(entry: { date: Date; rating: number }) {
  return { date: entry.date.toISOString().slice(0, 10), rating: entry.rating };
}

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (both inclusive; to defaults to from).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to") ?? from;
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ message: "Ugyldig dato" }, { status: 400 });
  }

  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const entries = await prisma.sleepQualityEntry.findMany({
      where: { userId: user.id, date: { gte: new Date(from), lte: new Date(to) } },
      orderBy: { date: "asc" },
    });
    return NextResponse.json({ entries: entries.map(toEntry) });
  } catch (error) {
    console.error("Sleep quality fetch failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

// PUT { date, rating } — one rating per day; a new tap replaces it.
export async function PUT(req: Request) {
  const { date, rating } = (await req.json()) as { date?: string; rating?: unknown };
  if (!date || !DATE_RE.test(date) || !isValidSleepQualityRating(rating)) {
    return NextResponse.json({ message: "Ugyldig vurdering" }, { status: 400 });
  }

  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const entry = await prisma.sleepQualityEntry.upsert({
      where: { userId_date: { userId: user.id, date: new Date(date) } },
      update: { rating },
      create: { userId: user.id, date: new Date(date), rating },
    });
    return NextResponse.json({ entry: toEntry(entry) });
  } catch (error) {
    console.error("Sleep quality save failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
