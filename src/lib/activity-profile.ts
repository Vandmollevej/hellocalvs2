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
import { childPhysicalActivityLevel, estimateBmr } from "@/lib/weekly-energy-summary";

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
  budget: DailyBudget | null;
  /** Felter der mangler for at kunne regne (vises som opfordring i UI). */
  missing: ("weightKg" | "heightCm" | "birthDate" | "sex")[];
};

/** Regnestykket for en profil. Alt er "ca."; null hvor grundlaget mangler. */
export function energySummaryFor(user: ProfileFields): EnergySummary {
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
  const budget = daily
    ? computeDailyBudget({
        tdeeKcal: daily.kcal,
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
    budget,
    missing,
  };
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
