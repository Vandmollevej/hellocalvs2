import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { estimateActivityKcal, isTrainingIntensity } from "@/lib/activity-met";

export async function GET() {
  try {
    const user = await getProfileUser("activities", "VIEWED");

    if (!user) return unauthorized();
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

// POST /api/activities — manual sport registration. Integration sync
// (src/app/api/integrations/*/sync) creates rows directly via Prisma
// instead of calling this route, since it writes source=FITBIT/GARMIN.
export async function POST(req: Request) {
  const body = await req.json();
  const { sportType, startedAt, durationMinutes, caloriesBurned, intensity, distanceKm } = body as {
    sportType?: string;
    startedAt?: string;
    durationMinutes?: number;
    caloriesBurned?: number;
    intensity?: unknown;
    distanceKm?: number | null;
  };

  // Kalorier må udelades: så anslås de fra MET (docs/ACTIVITY-PAL.md F3) ud
  // fra sport, intensitet (taletest), evt. distance og brugerens vægt.
  if (!sportType || !durationMinutes || durationMinutes <= 0 || (caloriesBurned !== undefined && caloriesBurned <= 0)) {
    return NextResponse.json(
      { message: "sportType og durationMinutes (> 0) er påkrævet; caloriesBurned skal være > 0, hvis angivet" },
      { status: 400 }
    );
  }
  const perceivedEffort = isTrainingIntensity(intensity) ? intensity : null;
  const distance = typeof distanceKm === "number" && distanceKm > 0 ? distanceKm : null;

  const parsedStartedAt = startedAt ? new Date(startedAt) : new Date();
  if (Number.isNaN(parsedStartedAt.getTime())) {
    return NextResponse.json({ message: "Ugyldig startedAt" }, { status: 400 });
  }

  try {
    const user = await getProfileUser("activities", "CREATED");

    if (!user) return unauthorized();
    const estimate = estimateActivityKcal({ sportType, minutes: durationMinutes, weightKg: user.weightKg, intensity: perceivedEffort, distanceKm: distance });
    const kcal = caloriesBurned ?? estimate.kcal;
    if (kcal === null) {
      return NextResponse.json({ message: "Angiv kalorier — vægt mangler, så de kan ikke anslås" }, { status: 400 });
    }
    const activity = await prisma.activity.create({
      data: {
        userId: user.id,
        source: "MANUAL",
        sportType,
        startedAt: parsedStartedAt,
        durationMinutes,
        caloriesBurned: kcal,
        met: estimate.met,
        distanceKm: distance,
        perceivedEffort,
        energySource: caloriesBurned === undefined ? "ESTIMATED_MET" : "USER",
      },
    });

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Activity create failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
