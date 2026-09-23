// Regler for den låste start-vægt (docs/DECISIONS.md 2026-09-22). Rene
// funktioner, som både klient og server kan bruge.
export const MIN_START_WEIGHT_KG = 25;
export const MAX_START_WEIGHT_KG = 400;

export function isValidStartWeight(weightKg: number) {
  return Number.isFinite(weightKg) && weightKg >= MIN_START_WEIGHT_KG && weightKg <= MAX_START_WEIGHT_KG;
}

export function parseWeightInput(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value.trim().replace(",", "."));
  return Number.NaN;
}
