import type { IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveSyncSettings } from "@/lib/integrations/sync-settings";

// Hello Cal-data, der sendes til en integration (push, docs/DECISIONS.md
// 2026-09-26). Kun data, brugeren selv har lavet i Hello Cal — aldrig data,
// der er hentet fra en integration — så intet sendes i ring mellem apps.
// Kun datatyper, brugeren har slået til under "Send til <app>", er med.

export type PushData = {
  nutrition: { id: string; title: string; loggedAt: string; kcal: number; proteinG: number; carbsG: number; fatG: number }[];
  water: { id: string; ml: number; loggedAt: string }[];
  weights: { id: string; weightKg: number; weighedAt: string }[];
  activities: { id: string; sportType: string; startedAt: string; durationMinutes: number; caloriesBurned: number }[];
};

export const EMPTY_PUSH: PushData = { nutrition: [], water: [], weights: [], activities: [] };

// Højst så mange poster pr. type pr. kørsel (resten tages næste gang).
const MAX_PER_TYPE = 200;

export async function collectPushData(
  userId: string,
  provider: IntegrationProvider,
  storedSettings: unknown,
  since: Date,
  until: Date = new Date()
): Promise<{ data: PushData; nextMark: Date }> {
  const { write } = resolveSyncSettings(provider, storedSettings);
  const window = { gt: since, lte: until };

  const [nutrition, water, weights, activities] = await Promise.all([
    write.nutrition
      ? prisma.registration.findMany({
          where: { userId, createdAt: window },
          orderBy: { createdAt: "asc" },
          take: MAX_PER_TYPE,
          select: { id: true, titleSnapshot: true, createdAt: true, kcalSnapshot: true, proteinSnapshot: true, carbsSnapshot: true, fatSnapshot: true },
        })
      : [],
    write.water
      ? prisma.waterEntry.findMany({ where: { userId, loggedAt: window }, orderBy: { loggedAt: "asc" }, take: MAX_PER_TYPE })
      : [],
    write.weight
      ? prisma.weightEntry.findMany({
          where: { userId, source: "MANUAL", weighedAt: window },
          orderBy: { weighedAt: "asc" },
          take: MAX_PER_TYPE,
          select: { id: true, weightKg: true, weighedAt: true },
        })
      : [],
    write.activities
      ? prisma.activity.findMany({
          where: { userId, source: "MANUAL", createdAt: window },
          orderBy: { createdAt: "asc" },
          take: MAX_PER_TYPE,
        })
      : [],
  ]);

  // Blev en liste afkortet, fortsætter næste kørsel fra dens sidste post,
  // så intet springes over.
  const marks = [
    nutrition.length >= MAX_PER_TYPE ? nutrition.at(-1)?.createdAt : null,
    water.length >= MAX_PER_TYPE ? water.at(-1)?.loggedAt : null,
    weights.length >= MAX_PER_TYPE ? weights.at(-1)?.weighedAt : null,
    activities.length >= MAX_PER_TYPE ? activities.at(-1)?.createdAt : null,
  ].filter((d): d is Date => d instanceof Date);
  const nextMark = marks.length ? new Date(Math.min(...marks.map((d) => d.getTime()))) : until;

  const data: PushData = {
    nutrition: nutrition.map((r) => ({
      id: r.id,
      title: r.titleSnapshot,
      loggedAt: r.createdAt.toISOString(),
      kcal: Math.round(r.kcalSnapshot),
      proteinG: round1(r.proteinSnapshot),
      carbsG: round1(r.carbsSnapshot),
      fatG: round1(r.fatSnapshot),
    })),
    water: water.map((w) => ({ id: w.id, ml: Math.round(w.amountMl), loggedAt: w.loggedAt.toISOString() })),
    weights: weights.map((w) => ({ id: w.id, weightKg: w.weightKg, weighedAt: w.weighedAt.toISOString() })),
    activities: activities.map((a) => ({
      id: a.id,
      sportType: a.sportType,
      startedAt: a.startedAt.toISOString(),
      durationMinutes: a.durationMinutes,
      caloriesBurned: Math.round(a.caloriesBurned),
    })),
  };
  return { data, nextMark };
}

export function pushCount(data: PushData) {
  return data.nutrition.length + data.water.length + data.weights.length + data.activities.length;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
