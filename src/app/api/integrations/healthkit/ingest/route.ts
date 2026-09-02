import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashDeviceToken } from "@/lib/device-tokens";
import type { HealthMetricType } from "@prisma/client";

// POST /api/integrations/healthkit/ingest — receives data from a future
// native companion app (iOS/HealthKit or Android/Health Connect), see
// docs/HEALTHKIT_COMPANION.md. Authenticated with a DeviceToken as
// "Authorization: Bearer <token>", not cookies/OAuth — the app has no user
// account of its own to log into yet (see docs/STATUS.md "Next work" #4).
type IngestBody = {
  source?: "APPLE_HEALTH" | "GOOGLE_HEALTH";
  metrics?: { type?: HealthMetricType; value?: number; recordedAt?: string }[];
  weights?: { weightKg?: number; weighedAt?: string }[];
  activities?: {
    sportType?: string;
    startedAt?: string;
    durationMinutes?: number;
    caloriesBurned?: number;
  }[];
};

async function authenticate(req: Request) {
  const auth = req.headers.get("authorization");
  const raw = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!raw) return null;

  const token = await prisma.deviceToken.findUnique({ where: { tokenHash: hashDeviceToken(raw) } });
  if (!token) return null;

  await prisma.deviceToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  return token.userId;
}

export async function POST(req: Request) {
  const userId = await authenticate(req);
  if (!userId) {
    return NextResponse.json({ message: "Ugyldigt eller manglende enhedstoken" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as IngestBody;
  if (body.source !== "APPLE_HEALTH" && body.source !== "GOOGLE_HEALTH") {
    return NextResponse.json({ message: "source skal være APPLE_HEALTH eller GOOGLE_HEALTH" }, { status: 400 });
  }

  try {
    let metricsCreated = 0;
    if (body.metrics?.length) {
      const rows = body.metrics
        .filter((m) => m.type && typeof m.value === "number" && m.recordedAt)
        .map((m) => ({
          userId,
          source: body.source!,
          type: m.type!,
          value: m.value!,
          recordedAt: new Date(m.recordedAt!),
        }));
      const result = await prisma.healthMetric.createMany({ data: rows, skipDuplicates: true });
      metricsCreated = result.count;
    }

    let weightsCreated = 0;
    for (const weight of body.weights ?? []) {
      if (!weight.weightKg || !weight.weighedAt) continue;
      const weighedAt = new Date(weight.weighedAt);
      const existing = await prisma.weightEntry.findFirst({ where: { userId, source: body.source, weighedAt } });
      if (existing) continue;
      await prisma.weightEntry.create({
        data: { userId, weightKg: weight.weightKg, source: body.source, weighedAt },
      });
      weightsCreated += 1;
    }

    let activitiesCreated = 0;
    for (const activity of body.activities ?? []) {
      if (!activity.sportType || !activity.startedAt || !activity.durationMinutes || !activity.caloriesBurned) continue;
      const startedAt = new Date(activity.startedAt);
      const existing = await prisma.activity.findFirst({ where: { userId, source: body.source, startedAt } });
      if (existing) continue;
      await prisma.activity.create({
        data: {
          userId,
          source: body.source,
          sportType: activity.sportType,
          startedAt,
          durationMinutes: activity.durationMinutes,
          caloriesBurned: activity.caloriesBurned,
        },
      });
      activitiesCreated += 1;
    }

    return NextResponse.json({ ok: true, metricsCreated, weightsCreated, activitiesCreated });
  } catch (error) {
    console.error("HealthKit ingest failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
