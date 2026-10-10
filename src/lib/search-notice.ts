// Klientside læsning af rettelses-info fra GET /api/products?q=…
// (correctedQuery/originalQuery = serveren søgte på den rettede tekst;
// suggestedQuery = kun 1-2 hits, forslag er ikke brugt). `forQuery` er den
// søgetekst svaret hører til, så en forældet linje aldrig vises for ny tekst.
export type SearchCorrection =
  | { kind: "corrected"; forQuery: string; corrected: string; original: string }
  | { kind: "suggested"; forQuery: string; suggested: string };

export function readSearchCorrection(
  data: { correctedQuery?: unknown; originalQuery?: unknown; suggestedQuery?: unknown },
  forQuery: string,
): SearchCorrection | null {
  if (typeof data.correctedQuery === "string" && data.correctedQuery && typeof data.originalQuery === "string") {
    return { kind: "corrected", forQuery, corrected: data.correctedQuery, original: data.originalQuery };
  }
  if (typeof data.suggestedQuery === "string" && data.suggestedQuery) {
    return { kind: "suggested", forQuery, suggested: data.suggestedQuery };
  }
  return null;
}
