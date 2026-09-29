// Kropssammensætning i en målsætning (docs/DECISIONS.md 2026-09-29): fedtprocent
// og muskelmasse, som smartvægte måler. Værdierne ligger ikke på BodyMeasurement
// men i HealthMetric (metricType), så alle integrationer skriver til samme
// felt. Klientsikker (ingen Prisma).
export const COMPOSITION_GOAL_FIELDS = [
  { field: "bodyFatPercent", unit: "%", nameKey: "goals.composition.bodyFatPercent", metricType: "BODY_FAT_PERCENT" },
  { field: "muscleMassKg", unit: "kg", nameKey: "goals.composition.muscleMassKg", metricType: "MUSCLE_MASS_KG" },
] as const;

export type CompositionGoalField = (typeof COMPOSITION_GOAL_FIELDS)[number]["field"];

export function isCompositionGoalField(value: string): value is CompositionGoalField {
  return COMPOSITION_GOAL_FIELDS.some(({ field }) => field === value);
}

export function emptyCompositionGoalValues(): Record<CompositionGoalField, string> {
  return Object.fromEntries(COMPOSITION_GOAL_FIELDS.map(({ field }) => [field, ""])) as Record<CompositionGoalField, string>;
}
