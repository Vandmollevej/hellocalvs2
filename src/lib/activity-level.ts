// Aktivitetsniveau i 5 trin (docs/DECISIONS.md 2026-09-29, docs/ACTIVITY-PAL.md).
// Niveauet beskriver hverdagen — arbejde, gang, husarbejde — uden motion.
// Motion lægges oveni som fast tillæg eller som logget/målt aktivitet
// (src/lib/pal-model.ts), så den ikke tælles to gange. Faktoren er niveauets
// repræsentative PAL og ganges på hvilestofskiftet (BMR). Har brugeren en
// beregnet `User.palBase`, bruges den frem for niveauets faktor.
import { ACTIVITY_LEVEL_KEYS, PAL_LEVELS, representativePal, type ActivityLevelKey } from "@/lib/pal-model";

export const ACTIVITY_LEVELS = ACTIVITY_LEVEL_KEYS;

export type ActivityLevel = ActivityLevelKey;

export const ACTIVITY_LEVEL_FACTORS: Record<ActivityLevel, number> = Object.fromEntries(
  PAL_LEVELS.map((level) => [level.key, level.representative]),
) as Record<ActivityLevel, number>;

export function isActivityLevel(value: unknown): value is ActivityLevel {
  return typeof value === "string" && (ACTIVITY_LEVELS as readonly string[]).includes(value);
}

/** BMR-faktoren for niveauet, eller null når brugeren ikke har valgt et. */
export function activityLevelFactor(level: ActivityLevel | null | undefined): number | null {
  return level ? representativePal(level) : null;
}
