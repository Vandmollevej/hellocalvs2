// Hvorfor kom varen frem? (Admin → Analyse → Søgning → Tale, docs/DECISIONS.md
// 2026-10-16). Søgningens rangering er point: tekstmatch × 100 plus hvert
// sekundært signal × dets vægt fra Søgealgoritmer. Her bliver pointene til
// en læsbar begrundelse. Pure and import-free so `npm test` can load it.

export type ExplainBreakdown = Record<string, number>;
export type ExplainWeights = Record<string, number>;
export type ReasonPoints = Record<string, number>;

// Brand/subbrand-signalet er allerede ganget med NAMED_BRAND_POINTS i
// breakdown; det ganges kun med vægten her.
export function rankingPoints(breakdown: ExplainBreakdown, weights: ExplainWeights): ReasonPoints {
  const points: ReasonPoints = {};
  for (const [key, value] of Object.entries(breakdown)) {
    const weight = key === "similarity" ? 100 : (weights[key] ?? 0);
    const result = Math.round(value * weight);
    if (result !== 0) points[key] = result;
  }
  return points;
}

export const REASON_LABELS: Record<string, string> = {
  similarity: "Tekstmatch",
  regionalPopularity: "Populær i dit land",
  timeOfDay: "Søges ofte på dette tidspunkt",
  regionEan: "Stregkode fra dit land",
  verification: "Verificeret vare",
  regionBrand: "Mærke kendt i dit land",
  personalHistory: "Du har valgt den før",
  genericVsProduct: "Ingrediens/vare",
  genericBroadSearch: "Generisk vare (intet brand nævnt)",
  brandInQuery: "Brand nævnt",
  subbrandInQuery: "Subbrand nævnt",
};

export function reasonList(points: ReasonPoints): Array<{ key: string; label: string; points: number }> {
  return Object.entries(points)
    .map(([key, value]) => ({ key, label: REASON_LABELS[key] ?? key, points: value }))
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
}

// Tekstmatchet i ord: 100 = navnet er præcis det sagte.
export function matchWord(points: number | undefined): string {
  const value = points ?? 0;
  if (value >= 95) return "præcist navn";
  if (value >= 80) return "ord i navnet";
  if (value >= 55) return "ligner (stavetolerance)";
  return "svagt match";
}
