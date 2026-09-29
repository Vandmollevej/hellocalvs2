import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeAge } from "@/lib/age";
import {
  ACTIVITY_ANSWERS_VERSION,
  STEP_BANDS,
  TRAINING_INTENSITIES,
  TRANSPORT_TYPES,
  WALK_STAND_HOURS,
  WORK_TYPES,
  estimateBasePal,
  estimateDailyEnergy,
  levelForPal,
  representativePal,
  trainingAllowanceKcalPerDay,
  type ActivityAnswers,
  type ActivityLevelKey,
  type DailyEnergyEstimate,
} from "@/lib/pal-model";
import { computeDailyBudget, type DailyBudget, type GoalMode } from "@/lib/energy-budget";
import {
  CALIBRATION_WINDOW_DAYS,
  calibrateMaintenance,
  calibrationDayKey,
  type Calibration,
} from "@/lib/energy-calibration";
import { minimumHealthyKcal } from "@/lib/healthy-intake";
import { computeTrendWeight } from "@/lib/weight-trend";
import {
  childPhysicalActivityLevel,
  deviceDataByDay,
  estimateBmr,
  formulaMaintenanceEstimate,
} from "@/lib/weekly-energy-summary";

// Server-siden af aktivitetsniveauet (docs/ACTIVITY-PAL.md): gemmer svarene
// fra onboarding, den beregnede hverdags-PAL og en snapshot-række, og samler
// regnestykket "hvile + hverdag + motion = energibehov − mål = budget", som
// UI'et viser. Selve tallene regnes i pal-model.ts / energy-budget.ts.

type ProfileFields = Pick<
  User,
  | "weightKg"
  | "heightCm"
  | "birthDate"
  | "sex"
  | "activityLevel"
  | "palBase"
  | "palSource"
  | "palConfidence"
  | "trainingAllowanceKcal"
  | "goalMode"
  | "goalPaceKgPerWeek"
  | "targetWeightKg"
>;

function oneOf<T extends string>(values: readonly T[], value: unknown): T | null {
  return typeof value === "string" && (values as readonly string[]).includes(value) ? (value as T) : null;
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Rens svar fra klienten, så kun kendte værdier gemmes. */
export function parseActivityAnswers(input: unknown): ActivityAnswers {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const training = raw.training && typeof raw.training === "object" ? (raw.training as Record<string, unknown>) : null;
  const sessionsPerWeek = training ? clampInt(training.sessionsPerWeek, 0, 14) : 0;
  return {
    version: ACTIVITY_ANSWERS_VERSION,
    work: oneOf(WORK_TYPES, raw.work),
    walkStand: oneOf(WALK_STAND_HOURS, raw.walkStand),
    transport: oneOf(TRANSPORT_TYPES, raw.transport),
    steps: oneOf(STEP_BANDS, raw.steps),
    stepsMeasured: raw.stepsMeasured === true,
    training:
      training && sessionsPerWeek > 0
        ? {
            sessionsPerWeek,
            sessionMinutes: clampInt(training.sessionMinutes, 0, 240),
            intensity: oneOf(TRAINING_INTENSITIES, training.intensity),
          }
        : null,
  };
}

export type EnergySummary = {
  bmr: number | null;
  age: number | null;
  pal: number | null;
  palSource: User["palSource"];
  palUncertainty: number;
  level: ActivityLevelKey | null;
  trainingAllowanceKcal: number;
  daily: DailyEnergyEstimate | null;
  /** Løbende kalibrering mod vægt (docs/ACTIVITY-PAL.md); null når den ikke er kørt. */
  calibration: Calibration | null;
  /** Energibehovet budgettet bygger på: kalibreret når muligt, ellers dagsestimatet. */
  needKcal: number | null;
  budget: DailyBudget | null;
  /** Felter der mangler for at kunne regne (vises som opfordring i UI). */
  missing: ("weightKg" | "heightCm" | "birthDate" | "sex")[];
};

/** Regnestykket for en profil. Alt er "ca."; null hvor grundlaget mangler. */
export function energySummaryFor(user: ProfileFields, calibration: Calibration | null = null): EnergySummary {
  const age = computeAge(user.birthDate);
  const bmr = estimateBmr({ weightKg: user.weightKg, heightCm: user.heightCm, age, sex: user.sex });
  const missing: EnergySummary["missing"] = [];
  if (!user.weightKg) missing.push("weightKg");
  if (!user.heightCm) missing.push("heightCm");
  if (age === null) missing.push("birthDate");
  if (!user.sex) missing.push("sex");

  // Børn: EFSA's aldersværdier frem for spørgeskemaet (docs/FAMILY.md).
  const childPal = childPhysicalActivityLevel(age);
  const pal = childPal ?? user.palBase ?? (user.activityLevel ? representativePal(user.activityLevel) : null);
  const palUncertainty = user.palConfidence ?? (user.palSource === "MANUAL" ? 0.2 : 0.15);
  const trainingAllowanceKcal = user.trainingAllowanceKcal ?? 0;
  const daily = bmr !== null && pal !== null ? estimateDailyEnergy({ bmr, pal, palUncertainty, trainingAllowanceKcal }) : null;
  const calibrated = calibration && calibration.reason === "OK" && calibration.weight > 0 ? Math.round(calibration.usedKcal / 10) * 10 : null;
  const needKcal = calibrated ?? daily?.kcal ?? null;
  const budget = daily && needKcal !== null
    ? computeDailyBudget({
        tdeeKcal: needKcal,
        bmrKcal: bmr,
        weightKg: user.weightKg,
        heightCm: user.heightCm,
        age,
        sex: user.sex,
        mode: (user.goalMode ?? "MAINTAIN") as GoalMode,
        targetWeightKg: user.targetWeightKg,
        paceKgPerWeek: user.goalPaceKgPerWeek,
      })
    : null;

  return {
    bmr,
    age,
    pal,
    palSource: user.palSource,
    palUncertainty,
    level: pal !== null ? levelForPal(pal) : null,
    trainingAllowanceKcal,
    daily,
    calibration,
    needKcal,
    budget,
    missing,
  };
}

// Kalibreringen skriver højst én ny PAL i døgnet, og kun når den flytter sig.
const CALIBRATION_PERSIST_MIN_HOURS = 24;
const CALIBRATION_PERSIST_MIN_PAL_DELTA = 0.02;

/**
 * Løbende kalibrering (docs/ACTIVITY-PAL.md): lærer vedligeholdet af de
 * sidste 56 dages indtag og trendvægt, blander det med formlen og — når
 * blandingen flytter PAL — gemmer den nye hverdags-PAL med kilde CALIBRATED
 * (og en snapshot). Returnerer kalibreringen og den (evt. opdaterede) bruger.
 */
export async function calibrateUser(user: ProfileFields & { id: string; activityProfileUpdatedAt: Date | null }) {
  const age = computeAge(user.birthDate);
  const bmr = estimateBmr({ weightKg: user.weightKg, heightCm: user.heightCm, age, sex: user.sex });
  if (bmr === null || childPhysicalActivityLevel(age) !== null) return { calibration: null, user };
  const palBase = user.palBase ?? (user.activityLevel ? representativePal(user.activityLevel) : null);
  if (palBase === null) return { calibration: null, user };

  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - CALIBRATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [registrations, weighIns, activities, metrics] = await Promise.all([
    prisma.registration.findMany({ where: { userId: user.id, createdAt: { gte: start } }, select: { createdAt: true, kcalSnapshot: true } }),
    prisma.weightEntry.findMany({ where: { userId: user.id, weighedAt: { gte: start } }, select: { weightKg: true, weighedAt: true, timeOfDay: true } }),
    prisma.activity.findMany({ where: { userId: user.id, startedAt: { gte: start } }, select: { startedAt: true, caloriesBurned: true } }),
    prisma.healthMetric.findMany({
      where: { userId: user.id, recordedAt: { gte: start }, type: { in: ["ACTIVE_ENERGY_KCAL", "STEPS"] } },
      select: { type: true, source: true, value: true, recordedAt: true },
    }),
  ]);

  const intakeByDay = new Map<string, number>();
  for (const row of registrations) {
    const key = calibrationDayKey(row.createdAt);
    intakeByDay.set(key, (intakeByDay.get(key) ?? 0) + row.kcalSnapshot);
  }
  const profile = { activityLevel: user.activityLevel, palBase, trainingAllowanceKcal: user.trainingAllowanceKcal };
  const device = deviceDataByDay(metrics.map((m) => ({ ...m, recordedAt: m.recordedAt.toISOString() })));
  const formulaKcal = formulaMaintenanceEstimate(
    bmr,
    activities.map((a) => ({ startedAt: a.startedAt.toISOString(), caloriesBurned: a.caloriesBurned })),
    profile,
    device,
    CALIBRATION_WINDOW_DAYS,
  );
  if (formulaKcal === null) return { calibration: null, user };
  const trend =
    computeTrendWeight(
      weighIns.map((w) => ({ weightKg: w.weightKg, weighedAt: w.weighedAt.toISOString(), timeOfDay: w.timeOfDay })),
      registrations.map((r) => ({ createdAt: r.createdAt.toISOString() })),
    ) ?? [];
  const calibration = calibrateMaintenance({
    formulaKcal,
    intakeByDay,
    trend,
    endExclusive: end,
    minimumKcal: minimumHealthyKcal({ weightKg: user.weightKg, heightCm: user.heightCm, age, sex: user.sex }),
  });

  // Skalér hverdags-PAL med forholdet brugt/formel, så hele regnestykket
  // følger med — og gem kun, når det flytter sig og højst én gang i døgnet.
  if (calibration.reason === "OK" && calibration.weight > 0) {
    const scaled = Math.round(Math.min(2.4, Math.max(1.1, palBase * (calibration.usedKcal / formulaKcal))) * 100) / 100;
    const staleEnough =
      !user.activityProfileUpdatedAt || Date.now() - user.activityProfileUpdatedAt.getTime() >= CALIBRATION_PERSIST_MIN_HOURS * 3600 * 1000;
    if (Math.abs(scaled - palBase) >= CALIBRATION_PERSIST_MIN_PAL_DELTA && staleEnough) {
      const palConfidence = Math.round((0.15 * (1 - calibration.weight) + 0.05) * 100) / 100;
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { palBase: scaled, palSource: "CALIBRATED", palConfidence, activityProfileUpdatedAt: new Date() },
      });
      await prisma.activityProfileSnapshot.create({
        data: { userId: user.id, palBase: scaled, palConfidence, source: "CALIBRATED", trainingAllowanceKcal: user.trainingAllowanceKcal },
      });
      return { calibration, user: updated };
    }
  }
  return { calibration, user };
}

/** Gem onboarding-svar: beregn PAL + tillæg, opdatér brugeren og skriv en snapshot. */
export async function applyActivityAnswers(user: ProfileFields & { id: string }, answers: ActivityAnswers) {
  const estimate = estimateBasePal(answers);
  const trainingAllowanceKcal = trainingAllowanceKcalPerDay(answers.training, user.weightKg);
  const data: Prisma.UserUpdateInput = {
    activityAnswers: answers as unknown as Prisma.InputJsonValue,
    activityProfileUpdatedAt: new Date(),
    trainingAllowanceKcal,
  };
  if (estimate) {
    data.palBase = estimate.pal;
    data.palConfidence = estimate.uncertainty;
    data.palSource = answers.steps && answers.stepsMeasured ? "STEPS" : "QUESTIONNAIRE";
    data.activityLevel = estimate.level;
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data });
  if (estimate) {
    await prisma.activityProfileSnapshot.create({
      data: {
        userId: user.id,
        palBase: estimate.pal,
        palConfidence: estimate.uncertainty,
        source: data.palSource as "STEPS" | "QUESTIONNAIRE",
        answers: answers as unknown as Prisma.InputJsonValue,
        trainingAllowanceKcal,
      },
    });
  }
  return updated;
}

/** Brugeren retter niveauet selv: repræsentativ PAL, kilde MANUAL, større usikkerhed. */
export async function applyManualLevel(userId: string, level: ActivityLevelKey) {
  const palBase = representativePal(level);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { activityLevel: level, palBase, palSource: "MANUAL", palConfidence: 0.2, activityProfileUpdatedAt: new Date() },
  });
  await prisma.activityProfileSnapshot.create({
    data: { userId, palBase, palConfidence: 0.2, source: "MANUAL", trainingAllowanceKcal: updated.trainingAllowanceKcal },
  });
  return updated;
}
