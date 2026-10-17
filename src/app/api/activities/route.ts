import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { estimateActivityKcal, isTrainingIntensity } from "@/lib/activity-met";
import { parseTrainingEntries } from "@/lib/training-exercises";
import { parseSessionItems, sessionStarts } from "@/lib/training-session";
import { randomUUID } from "node:crypto";

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
  if (body && typeof body === "object" && "session" in body) return createSession(body.session);
  const { sportType, startedAt, durationMinutes, caloriesBurned, intensity, distanceKm, exercises } = body as {
    sportType?: string;
    startedAt?: string;
    durationMinutes?: number;
    caloriesBurned?: number;
    intensity?: unknown;
    distanceKm?: number | null;
    exercises?: unknown;
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
  // Træningspas: øvelser med sæt (src/lib/training-exercises.ts).
  const trainingEntries = parseTrainingEntries(exercises);

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
        ...(trainingEntries ? { exercises: trainingEntries } : {}),
      },
    });

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Activity create failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

// Træningspas: flere øvelser i én træning (src/lib/training-session.ts).
// Body: { session: { startedAt, intensity, items: [{ sportType, durationMinutes }] } }.
// Kalorierne anslås pr. øvelse fra MET; alle rækker deler ét sessionId.
async function createSession(raw: unknown) {
  const session = (raw ?? {}) as { startedAt?: unknown; intensity?: unknown; items?: unknown };
  const items = parseSessionItems(session.items);
  if (!items) {
    return NextResponse.json({ message: "items skal være 1-30 øvelser med sportType og durationMinutes > 0" }, { status: 400 });
  }
  const start = typeof session.startedAt === "string" ? new Date(session.startedAt) : new Date();
  if (Number.isNaN(start.getTime())) return NextResponse.json({ message: "Ugyldig startedAt" }, { status: 400 });
  const perceivedEffort = isTrainingIntensity(session.intensity) ? session.intensity : null;

  try {
    const user = await getProfileUser("activities", "CREATED");
    if (!user) return unauthorized();
    const sessionId = randomUUID();
    const starts = sessionStarts(start, items);
    const rows = items.map((item, index) => {
      const estimate = estimateActivityKcal({
        sportType: item.sportType,
        minutes: item.durationMinutes,
        weightKg: user.weightKg,
        intensity: perceivedEffort,
        distanceKm: null,
      });
      return { item, index, estimate };
    });
    if (rows.some((row) => row.estimate.kcal === null)) {
      return NextResponse.json({ message: "Angiv vægt på profilen — kalorierne kan ikke anslås uden" }, { status: 400 });
    }
    const activities = await prisma.$transaction(
      rows.map(({ item, index, estimate }) =>
        prisma.activity.create({
          data: {
            userId: user.id,
            source: "MANUAL",
            sportType: item.sportType,
            startedAt: starts[index],
            durationMinutes: item.durationMinutes,
            caloriesBurned: estimate.kcal as number,
            met: estimate.met,
            perceivedEffort,
            energySource: "ESTIMATED_MET",
            sessionId,
          },
        }),
      ),
    );
    return NextResponse.json({ sessionId, activities });
  } catch (error) {
    console.error("Activity session create failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
