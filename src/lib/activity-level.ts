// Aktivitetsniveau i 5 trin (docs/DECISIONS.md 2026-09-28). Niveauet
// beskriver hverdagen — arbejde, gang, husarbejde — uden den træning, brugeren
// logger som aktivitet; logget træning lægges oveni i kalenderens estimat, så
// den ikke tælles to gange. Faktoren ganges på hvilestofskiftet (BMR).
export const ACTIVITY_LEVELS = ["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;

export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const ACTIVITY_LEVEL_FACTORS: Record<ActivityLevel, number> = {
  VERY_LOW: 1.2,
  LOW: 1.375,
  MODERATE: 1.55,
  HIGH: 1.725,
  VERY_HIGH: 1.9,
};

export function isActivityLevel(value: unknown): value is ActivityLevel {
  return typeof value === "string" && (ACTIVITY_LEVELS as readonly string[]).includes(value);
}

/** BMR-faktoren for niveauet, eller null når brugeren ikke har valgt et. */
export function activityLevelFactor(level: ActivityLevel | null | undefined): number | null {
  return level ? ACTIVITY_LEVEL_FACTORS[level] : null;
}
