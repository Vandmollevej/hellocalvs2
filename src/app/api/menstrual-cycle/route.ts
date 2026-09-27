import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";

// docs/DECISIONS.md 2026-09-19. Same session-user pattern as the other
// personal-tracking routes (water-entries, weight-entries) — no real
// per-request session on these yet, see docs/STATUS.md "Next work".
export async function GET() {
  try {
    const user = await getProfileUser("menstrualCycle", "VIEWED");

    if (!user) return unauthorized();
    const entries = await prisma.menstrualCycleEntry.findMany({
      where: { userId: user.id },
      orderBy: { startDate: "desc" },
      take: 24,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Menstrual cycle entry list failed", error);
    return NextResponse.json({ entries: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { startDate, endDate } = body as { startDate?: string; endDate?: string | null };

  if (!startDate) {
    return NextResponse.json({ message: "startDate er påkrævet" }, { status: 400 });
  }
  const parsedStart = new Date(startDate);
  if (Number.isNaN(parsedStart.getTime())) {
    return NextResponse.json({ message: "startDate er ugyldig" }, { status: 400 });
  }
  const parsedEnd = endDate ? new Date(endDate) : undefined;
  if (parsedEnd && Number.isNaN(parsedEnd.getTime())) {
    return NextResponse.json({ message: "endDate er ugyldig" }, { status: 400 });
  }

  try {
    const user = await getProfileUser("menstrualCycle", "CREATED");

    if (!user) return unauthorized();
    const entry = await prisma.menstrualCycleEntry.create({
      data: {
        userId: user.id,
        startDate: parsedStart,
        ...(parsedEnd ? { endDate: parsedEnd } : {}),
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Menstrual cycle entry create failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
