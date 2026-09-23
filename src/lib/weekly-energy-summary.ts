// Weekly calorie-balance footer under the calendar's week/list rows.
// Originally built hidden because the web/PWA layout is short on vertical room
// while the browser URL bar takes the bottom of the screen; the user chose on
// 2026-09-23 to show it right away. Flip back to false (or replace with a
// native-app/viewport check) to hide it again — see docs/DECISIONS.md
// "Kalender — ugentlig kaloriebalance".
export const ENABLE_WEEKLY_ENERGY_SUMMARY = true;

// ~7,700 kcal per kg is a rough energy-to-body-fat approximation only. It is NOT
// a prediction of the change on the bathroom scale: water, glycogen, salt and
// gut content can move short-term weight far more than one week's energy
// balance. The UI must therefore always label the result "Estimeret", and it
// is kept strictly apart from measured weight and trend weight (weight-trend.ts).
// Swap the maintenance model below for a better one without touching the calendar.
const KCAL_PER_KG_ESTIMATE = 7700;

// Sedentary multiplier on BMR (everyday movement that isn't a logged activity).
// Logged Activity.caloriesBurned is added on top per day, so this must stay at
// the "sedentary" level to avoid counting training twice.
const SEDENTARY_FACTOR = 1.2;

// Fewer completed, logged days than this in the week → no weight estimate.
export const MIN_ESTIMATE_DAYS = 3;

// Adaptive maintenance: learned from logged intake vs. the actual weight trend.
const ADAPTIVE_WINDOW_DAYS = 28;
const ADAPTIVE_MIN_LOGGED_DAYS = 14;
const ADAPTIVE_MIN_WEIGH_INS = 3;
const ADAPTIVE_MIN_WEIGHT_SPAN_DAYS = 14;
// Reject a learned value this far from the formula — usually under-logging or
// a scale/water outlier rather than a real metabolism.
const ADAPTIVE_MIN_RATIO_TO_FORMULA = 0.7;
const ADAPTIVE_MAX_RATIO_TO_FORMULA = 1.4;

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export type WeeklyEnergySummary = {
  /** Sum of (eaten − reference) over counted days. Negative = deficit. */
  balanceKcal: number;
  countedDays: number;
};

/**
 * Only days up to and including today that actually have registrations count.
 * A day with nothing logged is missing data, not a full-day deficit — counting
 * it would show e.g. −23,000 kcal for an untouched week.
 */
export function computeWeeklyEnergySummary(
  days: Date[],
  today: Date,
  dailyTotals: Map<string, number>,
  referenceKcal: number,
): WeeklyEnergySummary | null {
  const todayStart = startOfDay(today).getTime();
  let balanceKcal = 0;
  let countedDays = 0;
  for (const date of days) {
    if (startOfDay(date).getTime() > todayStart) continue;
    const kcal = dailyTotals.get(dayKey(date)) ?? 0;
    if (kcal <= 0) continue;
    balanceKcal += kcal - referenceKcal;
    countedDays += 1;
  }
  return countedDays > 0 ? { balanceKcal, countedDays } : null;
}

export type EnergyProfile = {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: "MALE" | "FEMALE" | null;
};

export type WeighIn = { weightKg: number; weighedAt: string };

export type ActivityBurn = { startedAt: string; caloriesBurned: number };

/** Mifflin-St Jeor resting metabolic rate, or null when a field is missing. */
export function estimateBmr({ weightKg, heightCm, age, sex }: EnergyProfile): number | null {
  if (!weightKg || !heightCm || age === null || !sex) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "MALE" ? base + 5 : base - 161;
}

/** Latest weigh-in on or before `onOrBefore`, falling back to the profile weight. */
export function weightAt(weighIns: WeighIn[], onOrBefore: Date, fallbackKg: number | null): number | null {
  const limit = onOrBefore.getTime();
  let best: WeighIn | null = null;
  for (const entry of weighIns) {
    const time = new Date(entry.weighedAt).getTime();
    if (time > limit) continue;
    if (!best || time > new Date(best.weighedAt).getTime()) best = entry;
  }
  return best?.weightKg ?? fallbackKg;
}

export function activityKcalByDay(activities: ActivityBurn[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const activity of activities) {
    const key = dayKey(new Date(activity.startedAt));
    map.set(key, (map.get(key) ?? 0) + activity.caloriesBurned);
  }
  return map;
}

/**
 * Learns the user's real daily maintenance from the last 28 completed days:
 * average logged intake minus the energy equivalent of the weight trend
 * (least-squares slope over the weigh-ins). Null until there's enough data,
 * or when the result is implausibly far from the formula estimate.
 */
export function estimateAdaptiveMaintenance({
  dailyTotals,
  weighIns,
  endExclusive,
  formulaMaintenance,
}: {
  dailyTotals: Map<string, number>;
  weighIns: WeighIn[];
  endExclusive: Date;
  formulaMaintenance: number | null;
}): number | null {
  const end = startOfDay(endExclusive);
  const start = new Date(end.getTime() - ADAPTIVE_WINDOW_DAYS * DAY_MS);

  let intakeSum = 0;
  let loggedDays = 0;
  for (let offset = 0; offset < ADAPTIVE_WINDOW_DAYS; offset += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    const kcal = dailyTotals.get(dayKey(date)) ?? 0;
    if (kcal <= 0) continue;
    intakeSum += kcal;
    loggedDays += 1;
  }
  if (loggedDays < ADAPTIVE_MIN_LOGGED_DAYS) return null;

  const points = weighIns
    .map((entry) => ({ x: (new Date(entry.weighedAt).getTime() - start.getTime()) / DAY_MS, y: entry.weightKg }))
    .filter((point) => point.x >= 0 && point.x < ADAPTIVE_WINDOW_DAYS);
  if (points.length < ADAPTIVE_MIN_WEIGH_INS) return null;
  const xs = points.map((point) => point.x);
  if (Math.max(...xs) - Math.min(...xs) < ADAPTIVE_MIN_WEIGHT_SPAN_DAYS) return null;

  const meanX = xs.reduce((sum, x) => sum + x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let covariance = 0;
  let variance = 0;
  for (const point of points) {
    covariance += (point.x - meanX) * (point.y - meanY);
    variance += (point.x - meanX) ** 2;
  }
  if (variance === 0) return null;
  const slopeKgPerDay = covariance / variance;

  const maintenance = intakeSum / loggedDays - slopeKgPerDay * KCAL_PER_KG_ESTIMATE;
  if (!Number.isFinite(maintenance) || maintenance <= 0) return null;
  if (formulaMaintenance !== null) {
    const ratio = maintenance / formulaMaintenance;
    if (ratio < ADAPTIVE_MIN_RATIO_TO_FORMULA || ratio > ADAPTIVE_MAX_RATIO_TO_FORMULA) return null;
  }
  return maintenance;
}

export type WeightChangeEstimate = {
  grams: number;
  method: "adaptive" | "formula";
  countedDays: number;
};

/**
 * Energy-based weight estimate for the week, or null when it can't be made
 * credibly. The daily kcal *goal* is never used as maintenance (a weight-loss
 * goal already has a deficit built in). Only completed days (before today)
 * with registrations count — today is still in progress.
 */
export function estimateWeeklyWeightChange({
  days,
  today,
  dailyTotals,
  activityByDay,
  bmr,
  adaptiveMaintenance,
}: {
  days: Date[];
  today: Date;
  dailyTotals: Map<string, number>;
  activityByDay: Map<string, number>;
  bmr: number | null;
  adaptiveMaintenance: number | null;
}): WeightChangeEstimate | null {
  if (adaptiveMaintenance === null && bmr === null) return null;
  const todayStart = startOfDay(today).getTime();
  let balance = 0;
  let countedDays = 0;
  for (const date of days) {
    if (startOfDay(date).getTime() >= todayStart) continue;
    const key = dayKey(date);
    const kcal = dailyTotals.get(key) ?? 0;
    if (kcal <= 0) continue;
    // Adaptive maintenance already contains the user's average activity.
    const maintenance = adaptiveMaintenance ?? bmr! * SEDENTARY_FACTOR + (activityByDay.get(key) ?? 0);
    balance += kcal - maintenance;
    countedDays += 1;
  }
  if (countedDays < MIN_ESTIMATE_DAYS) return null;
  return {
    grams: (balance / KCAL_PER_KG_ESTIMATE) * 1000,
    method: adaptiveMaintenance !== null ? "adaptive" : "formula",
    countedDays,
  };
}

/** Average formula maintenance (BMR × sedentary + mean logged activity), for sanity-checking. */
export function formulaMaintenanceEstimate(bmr: number | null, activities: ActivityBurn[], windowDays = ADAPTIVE_WINDOW_DAYS) {
  if (bmr === null) return null;
  const cutoff = Date.now() - windowDays * DAY_MS;
  const burned = activities
    .filter((activity) => new Date(activity.startedAt).getTime() >= cutoff)
    .reduce((sum, activity) => sum + activity.caloriesBurned, 0);
  return bmr * SEDENTARY_FACTOR + burned / windowDays;
}

export function formatSignedKcal(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}${Math.abs(rounded).toLocaleString("da-DK")} kcal`;
}

export function formatEstimatedWeight(grams: number) {
  const rounded = Math.round(grams / 10) * 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  if (Math.abs(rounded) >= 1000) {
    return `${sign}${(Math.abs(rounded) / 1000).toLocaleString("da-DK", { maximumFractionDigits: 2 })} kg`;
  }
  return `${sign}${Math.abs(rounded).toLocaleString("da-DK")} g`;
}
