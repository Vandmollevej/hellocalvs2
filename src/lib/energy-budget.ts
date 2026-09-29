// Dagligt kaloriebudget ud fra energibehov og vægtmål (docs/ACTIVITY-PAL.md
// "Kaloriemål"). Sundhedsgrænserne er hårde: brugeren kan ønske mere, men får
// altid det sunde alternativ med en begrundelse (`adjustments`).

export const GOAL_MODES = ["MAINTAIN", "LOSE", "GAIN"] as const;
export type GoalMode = (typeof GOAL_MODES)[number];

// ~7.700 kcal pr. kg er en grov tilnærmelse (samme som weekly-energy-summary).
export const KCAL_PER_KG = 7700;

// Absolutte gulve uden lægelig opfølgning (Harvard Health), samme som
// healthy-intake.ts; ukendt køn får det laveste, så vi aldrig advarer forkert.
export const FLOOR_KCAL_FEMALE = 1200;
export const FLOOR_KCAL_MALE = 1500;

export const MAX_DEFICIT_SHARE = 0.2;
export const MAX_LOSS_KG_PER_WEEK = 0.5;
export const MAX_LOSS_KG_PER_WEEK_OBESE = 0.75;
export const OBESE_BMI = 30;
export const MAX_LOSS_SHARE_OF_WEIGHT_PER_WEEK = 0.01;
export const SLOW_LOSS_KG_PER_WEEK = 0.25;
export const NORMAL_WEIGHT_BMI = 25;
export const MAX_GAIN_KG_PER_WEEK = 0.25;
export const MIN_TARGET_BMI = 20;
export const UNDERWEIGHT_BMI = 18.5;
export const ADULT_AGE = 18;

export const LOSS_PACES_KG_PER_WEEK = [0.25, 0.5, 0.75] as const;
export const GAIN_PACES_KG_PER_WEEK = [0.1, 0.25] as const;

export type BudgetAdjustment =
  | "CHILD_NO_DEFICIT"
  | "UNDERWEIGHT_NO_LOSS"
  | "TARGET_RAISED_TO_MIN_BMI"
  | "PACE_CAPPED"
  | "PACE_SLOW_NORMAL_WEIGHT"
  | "DEFICIT_CAPPED_SHARE"
  | "FLOOR_APPLIED"
  | "BMR_FLOOR_APPLIED"
  | "GAIN_PACE_CAPPED";

export type BudgetInput = {
  /** Estimeret dagligt energibehov (estimateDailyEnergy().kcal). */
  tdeeKcal: number;
  bmrKcal: number | null;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: "MALE" | "FEMALE" | null;
  mode: GoalMode;
  targetWeightKg?: number | null;
  paceKgPerWeek?: number | null;
};

export type DailyBudget = {
  budgetKcal: number;
  /** Negativ = underskud. */
  deltaKcal: number;
  paceKgPerWeek: number;
  targetWeightKg: number | null;
  /** Uger til mål ved det anvendte tempo; null uden mål eller ved vedligehold. */
  weeksToTarget: number | null;
  adjustments: BudgetAdjustment[];
};

export function bmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

function weightForBmi(targetBmi: number, heightCm: number) {
  const m = heightCm / 100;
  return targetBmi * m * m;
}

function round10(value: number) {
  return Math.round(value / 10) * 10;
}

export function floorKcal(sex: BudgetInput["sex"], bmrKcal: number | null): number {
  const sexFloor = sex === "MALE" ? FLOOR_KCAL_MALE : FLOOR_KCAL_FEMALE;
  return Math.max(sexFloor, bmrKcal ?? 0);
}

/** Det højeste tempo (kg/uge), der er sundt for denne person. */
export function maxLossPace(input: Pick<BudgetInput, "weightKg" | "heightCm">): number {
  const currentBmi = bmi(input.weightKg, input.heightCm);
  let cap = currentBmi !== null && currentBmi >= OBESE_BMI ? MAX_LOSS_KG_PER_WEEK_OBESE : MAX_LOSS_KG_PER_WEEK;
  if (currentBmi !== null && currentBmi < NORMAL_WEIGHT_BMI) cap = Math.min(cap, SLOW_LOSS_KG_PER_WEEK);
  if (input.weightKg) cap = Math.min(cap, input.weightKg * MAX_LOSS_SHARE_OF_WEIGHT_PER_WEEK);
  return cap;
}

export function computeDailyBudget(input: BudgetInput): DailyBudget {
  const adjustments: BudgetAdjustment[] = [];
  const currentBmi = bmi(input.weightKg, input.heightCm);
  const isChild = input.age !== null && input.age < ADULT_AGE;
  let mode = input.mode;
  let target = input.targetWeightKg ?? null;
  let pace = input.paceKgPerWeek ?? 0;

  if (mode === "LOSE") {
    if (isChild) {
      mode = "MAINTAIN";
      adjustments.push("CHILD_NO_DEFICIT");
    } else if (currentBmi !== null && currentBmi < UNDERWEIGHT_BMI) {
      mode = "MAINTAIN";
      adjustments.push("UNDERWEIGHT_NO_LOSS");
    }
  }

  if (mode === "LOSE") {
    if (target !== null && input.heightCm) {
      const minTarget = weightForBmi(MIN_TARGET_BMI, input.heightCm);
      if (target < minTarget) {
        target = Math.round(minTarget * 10) / 10;
        adjustments.push("TARGET_RAISED_TO_MIN_BMI");
      }
    }
    const cap = maxLossPace(input);
    if (pace <= 0) pace = Math.min(SLOW_LOSS_KG_PER_WEEK, cap);
    if (pace > cap) {
      adjustments.push(currentBmi !== null && currentBmi < NORMAL_WEIGHT_BMI ? "PACE_SLOW_NORMAL_WEIGHT" : "PACE_CAPPED");
      pace = cap;
    }
  } else if (mode === "GAIN") {
    if (pace <= 0) pace = 0.1;
    if (pace > MAX_GAIN_KG_PER_WEEK) {
      pace = MAX_GAIN_KG_PER_WEEK;
      adjustments.push("GAIN_PACE_CAPPED");
    }
  } else {
    pace = 0;
  }

  let delta = mode === "LOSE" ? -(pace * KCAL_PER_KG) / 7 : mode === "GAIN" ? (pace * KCAL_PER_KG) / 7 : 0;

  if (mode === "LOSE") {
    const maxDeficit = input.tdeeKcal * MAX_DEFICIT_SHARE;
    if (-delta > maxDeficit) {
      delta = -maxDeficit;
      adjustments.push("DEFICIT_CAPPED_SHARE");
    }
    const floor = isChild ? input.bmrKcal ?? 0 : floorKcal(input.sex, input.bmrKcal);
    if (input.tdeeKcal + delta < floor) {
      delta = Math.min(0, floor - input.tdeeKcal);
      adjustments.push(input.bmrKcal !== null && floor === input.bmrKcal && floor > (input.sex === "MALE" ? FLOOR_KCAL_MALE : FLOOR_KCAL_FEMALE) ? "BMR_FLOOR_APPLIED" : "FLOOR_APPLIED");
    }
    // Tempoet, der faktisk gælder efter begrænsningerne.
    pace = Math.round(((-delta * 7) / KCAL_PER_KG) * 100) / 100;
  }

  const budgetKcal = round10(input.tdeeKcal + delta);
  const weeksToTarget =
    target !== null && input.weightKg && pace > 0 && mode !== "MAINTAIN"
      ? Math.max(0, Math.ceil(Math.abs(input.weightKg - target) / pace))
      : null;

  return {
    budgetKcal,
    deltaKcal: Math.round(delta),
    paceKgPerWeek: pace,
    targetWeightKg: target,
    weeksToTarget,
    adjustments,
  };
}
