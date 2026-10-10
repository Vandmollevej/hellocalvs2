import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { toEntryDto } from "@/lib/screenings-server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD[&calendar=1] — målinger på tværs af
// screeninger (graferne; med calendar=1 kun dem, der skal vises i kalenderen).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to") ?? from;
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ message: "Ugyldig dato" }, { status: 400 });
  }
  const calendarOnly = url.searchParams.get("calendar") === "1";
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const entries = await prisma.screeningEntry.findMany({
      where: {
        userId: user.id,
        date: { gte: new Date(from), lte: new Date(to) },
        screening: calendarOnly ? { showInCalendar: true, active: true } : {},
      },
      orderBy: { date: "asc" },
    });
    return NextResponse.json({ entries: entries.map(toEntryDto) });
  } catch (error) {
    console.error("Screening entries range failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
