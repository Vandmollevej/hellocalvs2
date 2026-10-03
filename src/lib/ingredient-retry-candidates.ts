// Rækkefølgen af fotos, når ingredienslisten ikke blev fundet ved første
// aflæsning (src/lib/quick-enrichment-jobs.ts, docs/DECISIONS.md 2026-10-02):
// 1. stregkodefotoet — på glas og dåser sidder stregkoden tit ved listen,
// 2. energifotoet, hvis listen blev forsøgt læst på et separat indholdsfoto,
// 3. samme foto som første gang (hjælper, hvis første kald fejlede).
// Ét foto pr. kørsel; samme foto prøves aldrig to gange i træk.

export type IngredientRetryCandidate = { url: string; label: string; ocrText?: string };

export function orderIngredientCandidates(input: {
  barcodePhotoUrl: string | null;
  nutritionPhotoUrl: string | null;
  ingredientsPhotoUrl: string | null;
  nutritionOcrText?: string;
  ingredientsOcrText?: string;
}): IngredientRetryCandidate[] {
  const list: IngredientRetryCandidate[] = [];
  const add = (url: string | null, label: string, ocrText?: string) => {
    if (url && !list.some((item) => item.url === url)) list.push({ url, label, ocrText });
  };
  add(input.barcodePhotoUrl, "stregkodefotoet");
  if (input.ingredientsPhotoUrl) {
    add(input.nutritionPhotoUrl, "energifotoet", input.nutritionOcrText);
    add(input.ingredientsPhotoUrl, "indholdsfotoet", input.ingredientsOcrText);
  } else {
    add(input.nutritionPhotoUrl, "energifotoet", input.nutritionOcrText);
  }
  return list;
}
