// Shared data-fetch behind Hello Doc's two data views (docs/DECISIONS.md
// 2026-09-12): the signed-in owner's own "Sådan ser det ud" preview
// (/api/doctor-shares/preview) and the real token-authenticated external
// view a doctor/dietitian opens (/api/hello-doc/[token]). Both need the same
// shape of data for a given user + history range — this is that one place,
// so the two don't drift apart.

import { prisma } from "@/lib/prisma";
import { groupByDay } from "@/lib/daily-totals";
import { historyRangeToDays, type DoctorShareHistoryRange } from "@/lib/doctor-share";

export type DoctorShareOwnerData = {
  profile: { displayName: string; email: string; sex: "MALE" | "FEMALE" | null };
  // User.weightKg/targetWeightKg have no own "entered at" timestamp —
  // User.createdAt is the closest proxy (account creation/onboarding).
  startWeightKg: number | null;
  startWeightRecordedAt: string;
  targetWeightKg: number | null;
  sleep: { defaultBedtime: string | null; defaultWakeTime: string | null };
  weightHistory: { date: string; weightKg: number }[];
  fluidHistory: { date: string; valueMl: number }[];
  dailyNutrition: {
    dateKey: string;
    kcal: number;
    vitaminA: number;
    vitaminC: number;
    calcium: number;
    iron: number;
    potassium: number;
  }[];
};

export async function fetchDoctorShareOwnerData(
  ownerId: string,
  range: DoctorShareHistoryRange
): Promise<DoctorShareOwnerData | null> {
  const user = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!user) return null;

  const days = historyRangeToDays(range);
  const cutoff = days === null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [registrations, weightEntries, waterMetrics] = await Promise.all([
    prisma.registration.findMany({
      where: { userId: ownerId, ...(cutoff ? { createdAt: { gte: cutoff } } : {}) },
      orderBy: { createdAt: "asc" },
    }),
    prisma.weightEntry.findMany({
      where: { userId: ownerId, ...(cutoff ? { weighedAt: { gte: cutoff } } : {}) },
      orderBy: { weighedAt: "asc" },
    }),
    prisma.healthMetric.findMany({
      where: {
        userId: ownerId,
        type: "WATER_ML",
        ...(cutoff ? { recordedAt: { gte: cutoff } } : {}),
      },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  const dailyNutrition = groupByDay(
    registrations.map((r) => ({
      kcalSnapshot: r.kcalSnapshot,
      proteinSnapshot: r.proteinSnapshot,
      carbsSnapshot: r.carbsSnapshot,
      fatSnapshot: r.fatSnapshot,
      sugarSnapshot: r.sugarSnapshot,
      fiberSnapshot: r.fiberSnapshot,
      saltSnapshot: r.saltSnapshot,
      potassiumSnapshot: r.potassiumSnapshot,
      calciumSnapshot: r.calciumSnapshot,
      ironSnapshot: r.ironSnapshot,
      vitaminASnapshot: r.vitaminASnapshot,
      vitaminCSnapshot: r.vitaminCSnapshot,
      createdAt: r.createdAt.toISOString(),
    }))
  );

  return {
    profile: {
      displayName: user.displayName,
      email: user.email,
      sex: user.sex,
    },
    startWeightKg: user.weightKg,
    startWeightRecordedAt: user.createdAt.toISOString(),
    targetWeightKg: user.targetWeightKg,
    sleep: {
      defaultBedtime: user.defaultBedtime,
      defaultWakeTime: user.defaultWakeTime,
    },
    weightHistory: weightEntries.map((entry) => ({
      date: entry.weighedAt.toISOString(),
      weightKg: entry.weightKg,
    })),
    fluidHistory: waterMetrics.map((metric) => ({
      date: metric.recordedAt.toISOString(),
      valueMl: metric.value,
    })),
    dailyNutrition: dailyNutrition.map((day) => ({
      dateKey: day.dateKey,
      kcal: day.kcal,
      vitaminA: day.vitaminA,
      vitaminC: day.vitaminC,
      calcium: day.calcium,
      iron: day.iron,
      potassium: day.potassium,
    })),
  };
}
