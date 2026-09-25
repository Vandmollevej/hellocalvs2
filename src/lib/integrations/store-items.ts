import { ActivitySource, HealthMetricSource, HealthMetricType, WeightSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Data hentet fra integrationer (Withings, Google Health, Strava, Polar,
// Fitbit, Apple Health/Health Connect) gemmes direkte på brugeren i de
// almindelige tabeller. Gentagne synkroniseringer overlapper; dubletter
// springes over på (kilde, tidspunkt).

export type IntegrationItem = { kind: "weight" | "activity" | "metric" | string; payload: unknown };
type Payload = Record<string, unknown>;

function date(value: unknown): Date | null {
  const d = typeof value === "string" ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function oneOf<T extends string>(values: Record<string, T>, value: unknown): T | null {
  return typeof value === "string" && (Object.values(values) as string[]).includes(value) ? (value as T) : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function storeIntegrationItems(userId: string, items: IntegrationItem[]): Promise<number> {
  let stored = 0;
  const metrics: {
    userId: string;
    source: HealthMetricSource;
    type: HealthMetricType;
    value: number;
    recordedAt: Date;
  }[] = [];

  for (const { kind, payload } of items) {
    const p = (payload ?? {}) as Payload;
    if (kind === "weight") {
      const weighedAt = date(p.weighedAt);
      const weightKg = num(p.weightKg);
      if (!weighedAt || weightKg === null) continue;
      const source = oneOf(WeightSource, p.source);
      if (!source) continue;
      const existing = await prisma.weightEntry.findFirst({ where: { userId, source, weighedAt }, select: { id: true } });
      if (existing) continue;
      await prisma.weightEntry.create({ data: { userId, weightKg, source, weighedAt } });
      stored += 1;
    } else if (kind === "activity") {
      const startedAt = date(p.startedAt);
      if (!startedAt) continue;
      const source = oneOf(ActivitySource, p.source);
      if (!source) continue;
      const existing = await prisma.activity.findFirst({ where: { userId, source, startedAt }, select: { id: true } });
      if (existing) continue;
      await prisma.activity.create({
        data: {
          userId,
          source,
          startedAt,
          sportType: typeof p.sportType === "string" ? p.sportType : "activity",
          durationMinutes: Math.max(0, Math.round(num(p.durationMinutes) ?? 0)),
          caloriesBurned: num(p.caloriesBurned) ?? 0,
        },
      });
      stored += 1;
    } else if (kind === "metric") {
      const recordedAt = date(p.recordedAt);
      const value = num(p.value);
      const source = oneOf(HealthMetricSource, p.source);
      const type = oneOf(HealthMetricType, p.type);
      if (!recordedAt || value === null || !source || !type) continue;
      metrics.push({
        userId,
        source,
        type,
        value,
        recordedAt,
      });
    }
  }

  if (metrics.length > 0) {
    const result = await prisma.healthMetric.createMany({ data: metrics, skipDuplicates: true });
    stored += result.count;
  }
  return stored;
}
