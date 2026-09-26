import { estimateBmr, type EnergyProfile } from "@/lib/weekly-energy-summary";

// Absolute daily floors for eating without medical supervision, commonly cited
// by Harvard Health Publishing ("Calorie counting made easy"): women should not
// go below 1,200 kcal/day and men not below 1,500 kcal/day. Used when the sex
// is unknown too (the lower value, so we never warn wrongly).
const FLOOR_FEMALE_KCAL = 1200;
const FLOOR_MALE_KCAL = 1500;

/**
 * Lowest daily intake we consider healthy for this person: the higher of the
 * resting metabolic rate (Mifflin-St Jeor, from weight/height/age/sex) and the
 * sex-based floor above. Rounded up to the nearest 10 kcal.
 */
export function minimumHealthyKcal(profile: EnergyProfile | null): number {
  const floor = profile?.sex === "MALE" ? FLOOR_MALE_KCAL : FLOOR_FEMALE_KCAL;
  const bmr = profile ? estimateBmr(profile) : null;
  return Math.ceil(Math.max(floor, bmr ?? 0) / 10) * 10;
}

/**
 * A finished day with entries whose total is below the healthy minimum. Today
 * and future days are never flagged (the day isn't over), and neither are
 * days without entries.
 */
export function isIntakeTooLow(kcal: number, minimumKcal: number, isPastDay: boolean): boolean {
  return isPastDay && kcal > 0 && kcal < minimumKcal;
}
