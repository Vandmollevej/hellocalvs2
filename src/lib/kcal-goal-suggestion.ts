import {
  estimateAdaptiveMaintenance,
  estimateBmr,
  formulaMaintenanceEstimate,
  weightAt,
  type ActivityBurn,
  type EnergyProfile,
  type WeighIn,
} from "@/lib/weekly-energy-summary";

// Forslag til ny daglig kaloriegrænse, når appen har lært brugerens rigtige
// forbrug af indtag vs. vægttrend (estimateAdaptiveMaintenance). Kun rene
// funktioner her; API'et (/api/profile/kcal-goal) henter data.

export const SUGGESTION_WINDOW_WEEKS = 4;
const WINDOW_DAYS = SUGGESTION_WINDOW_WEEKS * 7;
// "Alle kalorier logget": næsten alle dage i vinduet skal have registreringer.
const MIN_LOGGED_DAYS = WINDOW_DAYS - 3;
// Ingen popup for små afvigelser.
export const MIN_DIFFERENCE_KCAL = 100;
export const SNOOZE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type KcalGoalSuggestion = {
  weeks: number;
  currentKcal: number;
  suggestedKcal: number;
};

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * The learned maintenance replaces the formula estimate, so the suggested
 * limit is the current limit shifted by the same amount. That keeps the user's
 * own deficit/surplus intact instead of guessing a new one.
 */
export function suggestDailyKcalGoal({
  currentKcal,
  dailyTotals,
  weighIns,
  activities,
  profile,
  today,
}: {
  currentKcal: number;
  /** Keyed like `${year}-${monthIndex}-${day}` (same as the calendar). */
  dailyTotals: Map<string, number>;
  weighIns: WeighIn[];
  activities: ActivityBurn[];
  profile: EnergyProfile;
  today: Date;
}): KcalGoalSuggestion | null {
  const endExclusive = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(endExclusive.getTime() - WINDOW_DAYS * DAY_MS);

  let loggedDays = 0;
  for (let offset = 0; offset < WINDOW_DAYS; offset += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    if ((dailyTotals.get(dayKey(date)) ?? 0) > 0) loggedDays += 1;
  }
  if (loggedDays < MIN_LOGGED_DAYS) return null;

  const bmr = estimateBmr({ ...profile, weightKg: weightAt(weighIns, endExclusive, profile.weightKg) });
  const formula = formulaMaintenanceEstimate(bmr, activities, profile.activityLevel, WINDOW_DAYS);
  if (formula === null) return null;
  const learned = estimateAdaptiveMaintenance({ dailyTotals, weighIns, endExclusive, formulaMaintenance: formula });
  if (learned === null) return null;

  const suggestedKcal = Math.round((currentKcal + (learned - formula)) / 50) * 50;
  if (suggestedKcal <= 0 || Math.abs(suggestedKcal - currentKcal) < MIN_DIFFERENCE_KCAL) return null;
  return { weeks: SUGGESTION_WINDOW_WEEKS, currentKcal, suggestedKcal };
}
