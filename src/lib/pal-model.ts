// Aktivitetsniveau og energibehov (docs/ACTIVITY-PAL.md, DECISIONS 2026-09-29).
//
// Tre begreber, der ikke må blandes sammen:
// - Hverdags-PAL: hverdagen uden motion (arbejde, gang, stående, transport).
//   Ganges på hvilestofskiftet (BMR). Kilde: DGE's PAL-referencer.
// - Træningstillæg: brugerens typiske motion fra onboarding, som fast
//   dagstillæg regnet netto (MET − 1), så hvilestofskiftet i træningstimen
//   ikke tælles med igen. Kilde: Compendium of Physical Activities.
// - Logget/målt aktivitet: erstatter tillægget på den dag, den findes.
//
// Ren beregning uden Prisma eller React, så den kan testes med `npm test`.

export const WORK_TYPES = ["SITTING", "MOSTLY_SITTING", "MIXED", "MOSTLY_STANDING", "PHYSICAL"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WALK_STAND_HOURS = ["UNDER_1", "H1_2", "H2_4", "H4_6", "OVER_6"] as const;
export type WalkStandHours = (typeof WALK_STAND_HOURS)[number];

export const TRANSPORT_TYPES = ["MOTORIZED", "LITTLE_WALKING", "SOME_WALKING", "REGULAR_ACTIVE", "DAILY_ACTIVE"] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

export const STEP_BANDS = ["UNDER_3K", "K3_5", "K5_7_5", "K7_5_10", "K10_15", "OVER_15K"] as const;
export type StepBand = (typeof STEP_BANDS)[number];

// Taletesten (Sundhedsstyrelsen): moderat = let forpustet, kan tale; høj =
// svært at føre en samtale.
export const TRAINING_INTENSITIES = ["LIGHT", "MODERATE", "VIGOROUS", "VERY_VIGOROUS"] as const;
export type TrainingIntensity = (typeof TRAINING_INTENSITIES)[number];

export const ACTIVITY_ANSWERS_VERSION = 1;

export type ActivityAnswers = {
  version: number;
  work: WorkType | null;
  walkStand: WalkStandHours | null;
  transport: TransportType | null;
  /** Null = "Ved ikke". */
  steps: StepBand | null;
  /** Skridtene kommer fra en integration, ikke brugerens gæt. */
  stepsMeasured?: boolean;
  training: {
    sessionsPerWeek: number;
    sessionMinutes: number;
    intensity: TrainingIntensity | null;
  } | null;
};

// Tabellerne er valgt, så eksempelprofilerne i docs/ACTIVITY-PAL.md rammer
// niveauernes intervaller (se pal-model.test.mjs).
const QUESTIONNAIRE_BASE = 1.4;
const WORK_ADD: Record<WorkType, number> = {
  SITTING: 0,
  MOSTLY_SITTING: 0.04,
  MIXED: 0.09,
  MOSTLY_STANDING: 0.22,
  PHYSICAL: 0.32,
};
const WALK_STAND_ADD: Record<WalkStandHours, number> = {
  UNDER_1: 0,
  H1_2: 0.03,
  H2_4: 0.06,
  H4_6: 0.1,
  OVER_6: 0.14,
};
const TRANSPORT_ADD: Record<TransportType, number> = {
  MOTORIZED: 0,
  LITTLE_WALKING: 0.02,
  SOME_WALKING: 0.04,
  REGULAR_ACTIVE: 0.06,
  DAILY_ACTIVE: 0.09,
};
// Skridt er en indikator, ikke en kalorieformel: tempo, terræn, vægt og
// skridtlængde kendes ikke.
const STEP_PAL: Record<StepBand, number> = {
  UNDER_3K: 1.3,
  K3_5: 1.4,
  K5_7_5: 1.5,
  K7_5_10: 1.6,
  K10_15: 1.75,
  OVER_15K: 1.9,
};

export const PAL_MIN = 1.2;
export const PAL_MAX = 2.0;

const STEP_WEIGHT_SELF_REPORTED = 0.3;
const STEP_WEIGHT_MEASURED = 0.5;

function clampPal(pal: number) {
  return Math.min(PAL_MAX, Math.max(PAL_MIN, pal));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** Hverdags-PAL alene fra spørgeskemaet (uden skridt). Null, hvis intet er svaret. */
export function questionnairePal(answers: Pick<ActivityAnswers, "work" | "walkStand" | "transport">): number | null {
  if (!answers.work && !answers.walkStand && !answers.transport) return null;
  const sum =
    QUESTIONNAIRE_BASE +
    (answers.work ? WORK_ADD[answers.work] : 0) +
    (answers.walkStand ? WALK_STAND_ADD[answers.walkStand] : 0) +
    (answers.transport ? TRANSPORT_ADD[answers.transport] : 0);
  return round2(clampPal(sum));
}

export function stepsPal(band: StepBand | null | undefined): number | null {
  return band ? STEP_PAL[band] : null;
}

export type PalEstimate = {
  pal: number;
  /** ± i PAL-enheder; bruges til intervallet omkring energibehovet. */
  uncertainty: number;
  level: ActivityLevelKey;
};

/**
 * Hverdags-PAL fra alle svar: 70 % spørgeskema + 30 % skridt (50/50 ved
 * målte skridt). Kendes skridt ikke, bruges spørgeskemaet alene med større
 * usikkerhed. Null, når intet er svaret.
 */
export function estimateBasePal(answers: ActivityAnswers): PalEstimate | null {
  const fromQuestions = questionnairePal(answers);
  const fromSteps = stepsPal(answers.steps);
  if (fromQuestions === null && fromSteps === null) return null;

  const complete = Boolean(answers.work && answers.walkStand && answers.transport);
  let pal: number;
  let uncertainty: number;
  if (fromQuestions !== null && fromSteps !== null) {
    const w = answers.stepsMeasured ? STEP_WEIGHT_MEASURED : STEP_WEIGHT_SELF_REPORTED;
    pal = fromQuestions * (1 - w) + fromSteps * w;
    uncertainty = complete ? 0.1 : 0.15;
  } else if (fromQuestions !== null) {
    pal = fromQuestions;
    uncertainty = complete ? 0.15 : 0.2;
  } else {
    pal = fromSteps!;
    uncertainty = 0.2;
  }
  pal = round2(clampPal(pal));
  return { pal, uncertainty, level: levelForPal(pal) };
}

// Fem brugerforståelige niveauer oven på PAL. Grænserne ligger midt i
// hullerne mellem kildernes intervaller (1,2–1,4 · 1,4–1,5 · 1,6–1,7 ·
// 1,8–1,9 · 2,0–2,4). Nøglerne matcher Prisma-enum'et ActivityLevel.
export const ACTIVITY_LEVEL_KEYS = ["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;
export type ActivityLevelKey = (typeof ACTIVITY_LEVEL_KEYS)[number];

export type PalLevel = {
  key: ActivityLevelKey;
  /** Nedre grænse (inklusive); øvre er næste niveaus nedre grænse. */
  from: number;
  /** PAL, der bruges når brugeren vælger niveauet manuelt. */
  representative: number;
};

export const PAL_LEVELS: readonly PalLevel[] = [
  { key: "VERY_LOW", from: PAL_MIN, representative: 1.3 },
  { key: "LOW", from: 1.4, representative: 1.45 },
  { key: "MODERATE", from: 1.55, representative: 1.65 },
  { key: "HIGH", from: 1.75, representative: 1.85 },
  // Kun tungt fysisk hverdagsarbejde (byggeri, landbrug, skov). Stor
  // træningsmængde hører under træningstillægget, ikke her.
  { key: "VERY_HIGH", from: 1.95, representative: 2.0 },
];

export function levelForPal(pal: number): ActivityLevelKey {
  let level: ActivityLevelKey = PAL_LEVELS[0].key;
  for (const candidate of PAL_LEVELS) if (pal >= candidate.from) level = candidate.key;
  return level;
}

export function representativePal(level: ActivityLevelKey): number {
  return PAL_LEVELS.find((candidate) => candidate.key === level)!.representative;
}

/** Antal niveauer mellem to niveauer; bruges til advarslen ved manuel rettelse. */
export function levelDistance(a: ActivityLevelKey, b: ActivityLevelKey): number {
  return Math.abs(ACTIVITY_LEVEL_KEYS.indexOf(a) - ACTIVITY_LEVEL_KEYS.indexOf(b));
}

// Brutto-MET pr. intensitetsklasse fra taletesten. Netto = MET − 1, fordi
// 1 MET (hvile) allerede ligger i BMR × PAL.
export const TRAINING_MET: Record<TrainingIntensity, number> = {
  LIGHT: 3,
  MODERATE: 4.5,
  VIGOROUS: 7,
  VERY_VIGOROUS: 9,
};

/** Netto-kcal for en konkret aktivitet: (MET − 1) × kg × timer. */
export function netActivityKcal(met: number, weightKg: number, minutes: number): number {
  if (!(met > 1) || !(weightKg > 0) || !(minutes > 0)) return 0;
  return (met - 1) * weightKg * (minutes / 60);
}

/**
 * Fast dagstillæg for brugerens typiske motion: ugens netto-kcal delt på 7.
 * 0 uden motion eller uden vægt (kan ikke regnes uden kg).
 */
export function trainingAllowanceKcalPerDay(training: ActivityAnswers["training"], weightKg: number | null): number {
  if (!training || !weightKg || training.sessionsPerWeek <= 0 || training.sessionMinutes <= 0) return 0;
  const met = TRAINING_MET[training.intensity ?? "MODERATE"];
  const perSession = netActivityKcal(met, weightKg, training.sessionMinutes);
  return Math.round((perSession * training.sessionsPerWeek) / 7);
}

// Mifflin-St Jeor's egen spredning omkring ±10 % for voksne.
const BMR_RELATIVE_UNCERTAINTY = 0.1;

export type DailyEnergyMethod = "MEASURED" | "LOGGED" | "ALLOWANCE" | "BASELINE";

export type DailyEnergyEstimate = {
  /** Afrundet til nærmeste 10 — vises altid som "ca.". */
  kcal: number;
  low: number;
  high: number;
  bmr: number;
  pal: number;
  baselineKcal: number;
  activityKcal: number;
  method: DailyEnergyMethod;
};

export type DailyEnergyInput = {
  bmr: number;
  pal: number;
  palUncertainty?: number;
  trainingAllowanceKcal?: number;
  /** Netto-kcal fra loggede aktiviteter den dag (Activity.caloriesBurned). */
  loggedActivityKcal?: number;
  /** Enhedens målte aktive energi for dagen — erstatter både PAL-delen og tillægget. */
  measuredActiveKcal?: number | null;
};

function round10(value: number) {
  return Math.round(value / 10) * 10;
}

/**
 * Dagens energibehov. Prioritet: målt aktiv energi (BMR + målt) → logget
 * aktivitet (erstatter tillægget) → fast træningstillæg → ren baseline.
 */
export function estimateDailyEnergy(input: DailyEnergyInput): DailyEnergyEstimate {
  const { bmr, pal } = input;
  const palUncertainty = input.palUncertainty ?? 0.15;
  const measured = input.measuredActiveKcal;
  const logged = input.loggedActivityKcal ?? 0;
  const allowance = input.trainingAllowanceKcal ?? 0;

  if (measured !== null && measured !== undefined && measured > 0) {
    const kcal = bmr + measured;
    const spread = bmr * BMR_RELATIVE_UNCERTAINTY;
    return {
      kcal: round10(kcal),
      low: round10(kcal - spread),
      high: round10(kcal + spread),
      bmr,
      pal: 1,
      baselineKcal: bmr,
      activityKcal: measured,
      method: "MEASURED",
    };
  }

  const baselineKcal = bmr * pal;
  let activityKcal: number;
  let method: DailyEnergyMethod;
  if (logged > 0) {
    activityKcal = logged;
    method = "LOGGED";
  } else if (allowance > 0) {
    activityKcal = allowance;
    method = "ALLOWANCE";
  } else {
    activityKcal = 0;
    method = "BASELINE";
  }
  const kcal = baselineKcal + activityKcal;
  const spread = bmr * BMR_RELATIVE_UNCERTAINTY * pal + bmr * palUncertainty;
  return {
    kcal: round10(kcal),
    low: round10(kcal - spread),
    high: round10(kcal + spread),
    bmr,
    pal,
    baselineKcal,
    activityKcal,
    method,
  };
}
