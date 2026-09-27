import type { AiAnalysisKind } from "@prisma/client";
import { isValidGtin } from "@/lib/uncertainties";

// Samlet sikkerhed (0–100 %) for et produkt på admin "Nye produkter". Samme
// kilder som "Uncertainties": AI'ens aflæsninger (confidence 0–1) og
// billedrobottens match-tjek (confidence 0–100). Produktet er aldrig mere
// sikkert end sin mindst sikre aflæsning, så vi tager minimum. En EAN med
// forkert kontrolciffer er med sikkerhed fejllæst → 0 %. Null = ingen
// målinger (fx manuelt oprettet uden AI).
export function productConfidencePercent(
  analyses: { kind: AiAnalysisKind; confidence: number | null; prediction: unknown }[],
  matchChecks: { confidence: number | null }[],
): number | null {
  const values: number[] = [];
  for (const analysis of analyses) {
    if (analysis.kind === "BARCODE") {
      const barcode = String((analysis.prediction as { barcode?: unknown } | null)?.barcode ?? "");
      if (barcode && !isValidGtin(barcode)) {
        values.push(0);
        continue;
      }
    }
    if (analysis.confidence !== null) values.push(analysis.confidence * 100);
  }
  for (const check of matchChecks) {
    if (check.confidence !== null) values.push(check.confidence);
  }
  if (values.length === 0) return null;
  return Math.round(Math.min(100, Math.max(0, Math.min(...values))));
}
