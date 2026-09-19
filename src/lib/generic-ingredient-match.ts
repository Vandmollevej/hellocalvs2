import { textSimilarity } from "@/lib/text-similarity";

// Matches a manually-typed generic-ingredient name (e.g. "Æble") against
// Frida's (DTU Fødevareinstituttet) imported reference products, since a
// loose fruit/vegetable/meat item has no packaging/energideklaration of its
// own to read (see docs/DECISIONS.md 2026-09-19, and the 2026-08-27 Frida
// import entry). Frida names are verbose ("Æble, med skræl, rå"), so this is
// deliberately looser than the ≥90% guided-flow text match (docs/DECISIONS.md
// 2026-09-02) — it only needs to pick the closest reference product, not
// confirm an exact identity.
const MIN_MATCH_SCORE = 0.4;

export type FridaCandidate = {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

export function matchFridaProduct(
  query: string,
  candidates: FridaCandidate[]
): FridaCandidate | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  let best: { candidate: FridaCandidate; score: number } | null = null;
  for (const candidate of candidates) {
    const candidateFirstSegment = candidate.name.split(",")[0]?.trim() ?? candidate.name;
    // Prefer matching just the first comma-separated segment ("Æble" vs.
    // "Æble, med skræl, rå") since that's the part a Frida name shares with a
    // plain ingredient name — falls back to the full name otherwise.
    const score = Math.max(
      textSimilarity(normalizedQuery, candidateFirstSegment),
      textSimilarity(normalizedQuery, candidate.name)
    );
    if (!best || score > best.score) best = { candidate, score };
  }

  return best && best.score >= MIN_MATCH_SCORE ? best.candidate : null;
}
