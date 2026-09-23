// Shared normalization for the searchable product values in
// ProductNutritionFeatures (docs/DECISIONS.md 2026-09-23). Client-safe.

export type NutritionBasis = "100g" | "100ml" | "portion" | "unknown";

// Percentages are stored as 0–100 with two decimals. Anything outside that
// range, or not a finite number, is unknown (null) — never 0.
export function normalizePercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0 || value > 100) return null;
  return Math.round(value * 100) / 100;
}

// Grams per 100 g/ml, same validity rules as a percent (can't exceed 100 g).
export function normalizePer100(value: number | null | undefined): number | null {
  return normalizePercent(value);
}

// Mass percent from a per-100 value. Only valid for a 100 g basis:
// 5 g fiber / 100 g = 5 %. For 100 ml it would need the density, so null.
export function derivePercentFromPer100g(basis: NutritionBasis | null, per100g: number | null): number | null {
  if (basis !== "100g") return null;
  return normalizePercent(per100g);
}

export const deriveFiberPercent = derivePercentFromPer100g;

// Liquid products are declared per 100 ml. Used only where the source doesn't
// say which basis it used (retailer imports): a package size in ml/cl/l means
// liquid, anything else is assumed per 100 g.
export function inferBasisFromPackageText(...texts: (string | null | undefined)[]): "100g" | "100ml" {
  const joined = texts.filter(Boolean).join(" ").toLowerCase().replace(/(\d),(\d)/g, "$1.$2");
  return /\d\s*(ml|cl|dl|l|liter|litre)\b/.test(joined) ? "100ml" : "100g";
}
