import { ActivitySource, HealthMetricSource, HealthMetricType, WeightSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSportType } from "@/lib/sport-icons";

// Data hentet fra integrationer (Withings, Google Health, Strava, Polar,
// Fitbit, Apple Health/Health Connect) gemmes direkte på brugeren i de
// almindelige tabeller. Gentagne synkroniseringer overlapper; dubletter
// springes over på (kilde, tidspunkt); dagssummer (målinger) opdateres.
//
// - Vægt: hver måling bliver en ny vejning med målingens eget tidspunkt
//   (weighedAt = vægtens/Googles målingstidspunkt, ikke synkroniseringens).
//   Start-vægten (User.weightKg) overskrives aldrig; er den tom, bliver den
//   ældste synkroniserede vejning start-vægt (samme regel som manuel vejning).
// - Samme vejning/træning set via to kilder (fx Withings direkte og via
//   Google Health) gemmes kun én gang.
// - Sportstyper normaliseres (src/lib/sport-icons.ts), så fx Strava "Ride" og
//   Google "BIKING" lander i samme "Cykling"-kort.
// - Målinger (skridt, puls, søvn, mineraler …) gemmes kun med en gyldig
//   HealthMetricType, så de altid rammer det tilsvarende Statistik-kort.

export type IntegrationItem = { kind: "weight" | "activity" | "metric" | string; payload: unknown };
type Payload = Record<string, unknown>;

const SAME_WEIGHING_MS = 2 * 60 * 1000;
const SAME_WEIGHING_KG = 0.05;
const SAME_ACTIVITY_MS = 5 * 60 * 1000;

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

const around = (at: Date, ms: number) => ({ gte: new Date(at.getTime() - ms), lte: new Date(at.getTime() + ms) });

export async function storeIntegrationItems(userId: string, items: IntegrationItem[]): Promise<number> {
  let stored = 0;
  let earliestWeight: { weightKg: number; weighedAt: Date } | null = null;
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
      if (!weighedAt || weightKg === null || weightKg <= 0 || weightKg > 500) continue;
      const source = oneOf(WeightSource, p.source);
      if (!source) continue;
      const existing = await prisma.weightEntry.findFirst({
        where: {
          userId,
          OR: [
            { source, weighedAt },
            {
              weighedAt: around(weighedAt, SAME_WEIGHING_MS),
              weightKg: { gte: weightKg - SAME_WEIGHING_KG, lte: weightKg + SAME_WEIGHING_KG },
            },
          ],
        },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.weightEntry.create({ data: { userId, weightKg, source, weighedAt } });
      if (!earliestWeight || weighedAt < earliestWeight.weighedAt) earliestWeight = { weightKg, weighedAt };
      stored += 1;
    } else if (kind === "activity") {
      const startedAt = date(p.startedAt);
      if (!startedAt) continue;
      const source = oneOf(ActivitySource, p.source);
      if (!source) continue;
      const sportType = normalizeSportType(typeof p.sportType === "string" ? p.sportType : "");
      const existing = await prisma.activity.findFirst({
        where: {
          userId,
          OR: [{ source, startedAt }, { sportType, startedAt: around(startedAt, SAME_ACTIVITY_MS) }],
        },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.activity.create({
        data: {
          userId,
          source,
          startedAt,
          sportType,
          durationMinutes: Math.max(0, Math.round(num(p.durationMinutes) ?? 0)),
          caloriesBurned: Math.max(0, num(p.caloriesBurned) ?? 0),
        },
      });
      stored += 1;
    } else if (kind === "metric") {
      const recordedAt = date(p.recordedAt);
      const value = num(p.value);
      const source = oneOf(HealthMetricSource, p.source);
      const type = oneOf(HealthMetricType, p.type);
      if (!recordedAt || value === null || !source || !type) continue;
      metrics.push({ userId, source, type, value, recordedAt });
    }
  }

  // Kun hvis start-vægten er tom — en integration overskriver den aldrig.
  if (earliestWeight) {
    await prisma.user.updateMany({
      where: { id: userId, weightKg: null },
      data: { weightKg: earliestWeight.weightKg, startWeightUpdatedAt: earliestWeight.weighedAt },
    });
  }

  // Upsert: en dagssum (fx dagens skridt) hentes delvist og vokser ved næste
  // synkronisering, så en eksisterende række skal opdateres, ikke springes over.
  for (const m of metrics) {
    const key = { userId: m.userId, source: m.source, type: m.type, recordedAt: m.recordedAt };
    const existing = await prisma.healthMetric.findUnique({
      where: { userId_source_type_recordedAt: key },
      select: { id: true, value: true },
    });
    if (!existing) {
      await prisma.healthMetric.create({ data: m });
      stored += 1;
    } else if (existing.value !== m.value) {
      await prisma.healthMetric.update({ where: { id: existing.id }, data: { value: m.value } });
    }
  }
  return stored;
}
