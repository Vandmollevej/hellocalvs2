import type { AlternativeServing } from "@/lib/product-analysis-types";

// Alternative kalorievisninger (per glas/skive/stk. osv., docs/DECISIONS.md
// 2026-09-19) extracted by /api/ai/extract-nutrition-v2. Below this
// confidence, the value is never shown to an end user as fact — it goes to
// admin as a fejlrapport for a human to confirm against the actual photo
// instead.
export const ALTERNATIVE_SERVING_REVIEW_THRESHOLD = 0.7;

export function cleanAlternativeServings(value: unknown): AlternativeServing[] {
  if (!Array.isArray(value)) return [];
  const out: AlternativeServing[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const label = typeof source.label === "string" ? source.label.trim() : "";
    if (!label) continue;
    const amount = typeof source.amount === "number" && Number.isFinite(source.amount) ? source.amount : null;
    const unit = typeof source.unit === "string" && source.unit.trim() ? source.unit.trim() : null;
    const kcal = typeof source.kcal === "number" && Number.isFinite(source.kcal) ? source.kcal : null;
    const confidence =
      typeof source.confidence === "number" && Number.isFinite(source.confidence)
        ? Math.min(1, Math.max(0, source.confidence))
        : 0;
    out.push({ label, amount, unit, kcal, confidence });
  }
  return out;
}

export function isAlternativeServingConfident(serving: AlternativeServing) {
  return serving.kcal !== null && serving.confidence >= ALTERNATIVE_SERVING_REVIEW_THRESHOLD;
}
