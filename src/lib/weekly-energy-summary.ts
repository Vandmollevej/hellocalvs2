// Weekly calorie-balance footer under the calendar's week/list rows.
// Built but hidden: the current web/PWA layout has no vertical room for it
// while the browser URL bar takes the bottom of the screen. Flip this flag
// (or replace it with a native-app/viewport check) to show it — see
// docs/DECISIONS.md "Kalender — ugentlig kaloriebalance".
export const ENABLE_WEEKLY_ENERGY_SUMMARY = false;

// ~7,700 kcal per kg is a rough energy-to-body-fat approximation only. It is NOT
// a prediction of the change on the bathroom scale: water, glycogen, salt and
// gut content can move short-term weight far more than one week's energy
// balance. The UI must therefore always label the result "Estimeret", and it
// is kept strictly apart from measured weight and trend weight (weight-trend.ts).
// Swap this function for a better (dynamic) model without touching the calendar.
const KCAL_PER_KG_ESTIMATE = 7700;

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

/**
 * Energy-based weight estimate in grams, or null when it can't be made
 * credibly. Requires the user's maintenance calories — the daily kcal *goal*
 * is not a substitute (a weight-loss goal already has a deficit built in).
 * No maintenance figure exists in the app yet, so callers pass null and the
 * estimate stays hidden until one does.
 */
export function estimateWeightChangeGrams(
  consumedKcal: number,
  countedDays: number,
  maintenanceKcalPerDay: number | null,
): number | null {
  if (maintenanceKcalPerDay === null || !Number.isFinite(maintenanceKcalPerDay) || countedDays <= 0) {
    return null;
  }
  const balance = consumedKcal - maintenanceKcalPerDay * countedDays;
  return (balance / KCAL_PER_KG_ESTIMATE) * 1000;
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
