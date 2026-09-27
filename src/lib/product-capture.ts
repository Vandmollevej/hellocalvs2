import { findIngredientsSection, parseNutritionText, type ParsedNutrition } from "@/lib/product-ocr";
import { extractTextPrioritized, usableOcrText } from "@/lib/product-ocr-prioritized";

// Klientlogik for kameraflowet under Tilføj (docs/DECISIONS.md 2026-09-27):
// stregkode → forside → energi → indhold. Hvert foto læses kun med lokal OCR
// (hurtigt); OpenAI kører bagefter på serveren, når varen er oprettet
// (POST /api/products/quick).

export type CaptureStep = "barcode" | "front" | "nutrition" | "ingredients";

export const CAPTURE_STEPS: CaptureStep[] = ["barcode", "front", "nutrition", "ingredients"];

export type CaptureData = {
  barcode?: string;
  barcodeAnalysisId?: string;
  frontPhoto?: string;
  nutritionPhoto?: string;
  nutritionOcrText?: string;
  localNutrition?: ParsedNutrition | null;
  ingredientsPhoto?: string;
  ingredientsOcrText?: string;
  localIngredientsText?: string;
  // Ingredienslisten stod på energifotoet — intet separat indholdsfoto.
  ingredientsOnNutritionPhoto?: boolean;
};

// Kun læsbar tekst bruges (usableOcrText) — ulæselig OCR må aldrig ende i et
// felt (docs/DECISIONS.md 2026-09-27). Næring/ingredienser læses med
// tesseracts tabel-layout.
async function ocr(photo: string, languages: string[], tableLayout = false) {
  try {
    return usableOcrText(await extractTextPrioritized(photo, languages, undefined, { tableLayout }));
  } catch {
    return "";
  }
}

// Forsiden: lokal OCR bruges kun til dublet-tjek mod databasen. Returnerer
// id'et på en eksisterende vare, hvis teksten matcher en.
export async function readFrontPhoto(photo: string, languages: string[]): Promise<{ duplicateId: string | null }> {
  const text = await ocr(photo, languages);
  if (!text) return { duplicateId: null };
  try {
    const response = await fetch("/api/products/recognize-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return { duplicateId: null };
    const data = (await response.json()) as { product: { id: string } | null };
    return { duplicateId: data.product?.id ?? null };
  } catch {
    return { duplicateId: null };
  }
}

// Energi: næringstabellen læses lokalt; står ingredienslisten ved siden af,
// er indholds-trinnet også klaret.
export async function readNutritionPhoto(photo: string, languages: string[]) {
  const text = await ocr(photo, languages, true);
  return {
    text,
    nutrition: text ? parseNutritionText(text) : null,
    ingredientsText: text ? findIngredientsSection(text) : null,
  };
}

export async function readIngredientsPhoto(photo: string, languages: string[]) {
  const text = await ocr(photo, languages, true);
  return { text, ingredientsText: text ? (findIngredientsSection(text) ?? "") : "" };
}

// Stregkode-fotoet gemmes i baggrunden til kvalitetskontrol
// (docs/DECISIONS.md 2026-09-19) og må aldrig blokere flowet.
export async function saveBarcodePhoto(photo: string, barcode: string, marketRegion: string): Promise<string | null> {
  try {
    const response = await fetch("/api/ai/save-barcode-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo, barcode, marketRegion }),
    });
    const data = response.ok ? ((await response.json()) as { analysisId?: string }) : null;
    return data?.analysisId ?? null;
  } catch {
    return null;
  }
}

export async function createQuickProduct(data: CaptureData, marketRegion: string): Promise<string> {
  const response = await fetch("/api/products/quick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      barcode: data.barcode,
      marketRegion,
      barcodeAnalysisId: data.barcodeAnalysisId,
      frontPhoto: data.frontPhoto,
      nutritionPhoto: data.nutritionPhoto,
      nutritionOcrText: data.nutritionOcrText,
      localNutrition: data.localNutrition ?? null,
      ingredientsPhoto: data.ingredientsOnNutritionPhoto ? undefined : data.ingredientsPhoto,
      ingredientsOcrText: data.ingredientsOcrText,
      localIngredientsText: data.localIngredientsText,
    }),
  });
  if (!response.ok) throw new Error("Quick product creation failed");
  const body = (await response.json()) as { product: { id: string } };
  return body.product.id;
}
