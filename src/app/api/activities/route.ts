import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export async function GET() {
  try {
    const user = await getDemoUser();
    const activities = await prisma.activity.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 500,
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Activity list failed", error);
    return NextResponse.json(
      { activities: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

// POST /api/activities — manuel sportsregistrering. Integrationssync
// (src/app/api/integrations/*/sync) opretter rækker direkte via Prisma i
// stedet for at kalde denne route, da den skriver source=FITBIT/GARMIN.
export async function POST(req: Request) {
  const body = await req.json();
  const { sportType, startedAt, durationMinutes, caloriesBurned } = body as {
    sportType?: string;
    startedAt?: string;
    durationMinutes?: number;
    caloriesBurned?: number;
  };

  if (!sportType || !durationMinutes || durationMinutes <= 0 || !caloriesBurned || caloriesBurned <= 0) {
    return NextResponse.json(
      { message: "sportType, durationMinutes og caloriesBurned (> 0) er påkrævet" },
      { status: 400 }
    );
  }

  const parsedStartedAt = startedAt ? new Date(startedAt) : new Date();
  if (Number.isNaN(parsedStartedAt.getTime())) {
    return NextResponse.json({ message: "Ugyldig startedAt" }, { status: 400 });
  }

  try {
    const user = await getDemoUser();
    const activity = await prisma.activity.create({
      data: {
        userId: user.id,
        source: "MANUAL",
        sportType,
        startedAt: parsedStartedAt,
        durationMinutes,
        caloriesBurned,
      },
    });

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Activity create failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
