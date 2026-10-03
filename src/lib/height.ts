// Højde (User.heightCm) er låst ligesom start-vægten (docs/DECISIONS.md
// 2026-10-03): brugeren sætter den én gang på Profil, og derefter opdateres
// den kun af en integration, der måler højde (Withings, Apple Health,
// Health Connect …).

export const MIN_HEIGHT_CM = 50;
export const MAX_HEIGHT_CM = 250;

export function isValidHeightCm(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_HEIGHT_CM && value <= MAX_HEIGHT_CM;
}
