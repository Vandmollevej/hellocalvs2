import { findIngredientsSection, parseNutritionText, type ParsedNutrition } from "@/lib/product-ocr";
export type { OcrBox } from "@/lib/product-ocr-prioritized";
import { extractTextPrioritized, usableOcrText } from "@/lib/product-ocr-prioritized";
import { findLabelRegions, type LabelRegions } from "@/lib/label-text-regions";
import type { LanguageSignals } from "@/lib/regions";
import { scanFlowHeaders } from "@/lib/scan-debug-log";

// Klientlogik for kameraflowet under Tilføj (docs/DECISIONS.md 2026-09-27):
// stregkode → forside → energi → indhold. Hvert foto læses kun med lokal OCR
// (hurtigt); serveren bruger den lokale aflæsning, når den er sikker, og
// spørger ellers OpenAI, når varen er oprettet (POST /api/products/quick).

export type CaptureStep = "barcode" | "front" | "nutrition" | "ingredients";

export const CAPTURE_STEPS: CaptureStep[] = ["barcode", "front", "nutrition", "ingredients"];

export type CaptureData = {
  // Admin "Log" (src/lib/scan-debug-log.ts): samler scanningens trin.
  flowId?: string;
  barcode?: string;
  barcodeAnalysisId?: string;
  // Telefonens land (tidszone), appens sprog og telefonens sprog —
  // fastfrosset ved scanningen (src/lib/language-signals.ts).
  languageSignals?: LanguageSignals;
  frontPhoto?: string;
  nutritionPhoto?: string;
  nutritionOcrText?: string;
  nutritionOcrConfidence?: number;
  localNutrition?: ParsedNutrition | null;
  ingredientsPhoto?: string;
  ingredientsOcrText?: string;
  ingredientsOcrConfidence?: number;
  localIngredientsText?: string;
  // Ingredienslisten stod på energifotoet — intet separat indholdsfoto.
  ingredientsOnNutritionPhoto?: boolean;
};

// Kun læsbar tekst bruges (usableOcrText) — ulæselig OCR må aldrig ende i et
// felt (docs/DECISIONS.md 2026-09-27). Næring/ingredienser læses med
// tesseracts tabel-layout. Sikkerheden sendes med, så serveren kan afgøre,
// om aflæsningen kan bruges uden OpenAI.
async function ocr(photo: string, languages: string[], tableLayout = false) {
  try {
    const result = await extractTextPrioritized(photo, languages, undefined, { tableLayout });
    const text = usableOcrText(result);
    return { text, confidence: text ? result.confidence : 0 };
  } catch {
    return { text: "", confidence: 0 };
  }
}

// Forsiden: lokal OCR bruges kun til dublet-tjek mod databasen. Returnerer
// id'et på en eksisterende vare, hvis teksten matcher en (plus OCR-tallene
// til admin "Log").
export async function readFrontPhoto(
  photo: string,
  languages: string[],
  flowId?: string,
): Promise<{ duplicateId: string | null; textLength: number; confidence: number; lookupFailed: boolean }> {
  const { text, confidence } = await ocr(photo, languages);
  const stats = { textLength: text.length, confidence };
  if (!text) return { duplicateId: null, lookupFailed: false, ...stats };
  try {
    const response = await fetch("/api/products/recognize-text", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scanFlowHeaders(flowId) },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return { duplicateId: null, lookupFailed: true, ...stats };
    const data = (await response.json()) as { product: { id: string } | null };
    return { duplicateId: data.product?.id ?? null, lookupFailed: false, ...stats };
  } catch {
    return { duplicateId: null, lookupFailed: true, ...stats };
  }
}

export type LabelRead = {
  text: string;
  confidence: number;
  // Hvor næringstabellen/ingredienslisten står på fotoet (grøn ramme), fundet
  // ud fra linjerne — også når teksten som helhed er for usikker til at bruges.
  regions: LabelRegions;
  nutrition: ParsedNutrition | null;
  ingredientsText: string | null;
};

// Næring + ingredienser på ét foto. "Ingredienser" (på regionernes sprog)
// tæller som fundet, selv om listen ikke kan læses lokalt — så læser
// OpenAI den fra samme foto (docs/DECISIONS.md 2026-09-28).
async function readLabel(photo: string, languages: string[], tableLayout: boolean): Promise<LabelRead> {
  try {
    const result = await extractTextPrioritized(photo, languages, undefined, { tableLayout, layout: true });
    const text = usableOcrText(result);
    return {
      text,
      confidence: text ? result.confidence : 0,
      regions: findLabelRegions(result.lines),
      nutrition: text ? parseNutritionText(text) : null,
      ingredientsText: text ? findIngredientsSection(text) : null,
    };
  } catch {
    return { text: "", confidence: 0, regions: { nutrition: null, ingredients: null }, nutrition: null, ingredientsText: null };
  }
}

// Energi: næringstabellen læses lokalt; står ingredienslisten ved siden af,
// er indholds-trinnet også klaret.
export function readNutritionPhoto(photo: string, languages: string[]) {
  return readLabel(photo, languages, true);
}

// Stregkodefotoet: står næringstabellen og/eller ingredienslisten ved
// stregkoden, klares de trin med samme foto. Et helt kamerabillede med
// baggrund læses med tesseracts almindelige segmentering. Kører i
// baggrunden, mens brugeren fotograferer forsiden.
export function readBarcodePhoto(photo: string, languages: string[]) {
  return readLabel(photo, languages, false);
}

export async function readIngredientsPhoto(photo: string, languages: string[]) {
  const result = await readLabel(photo, languages, true);
  return { ...result, ingredientsText: result.ingredientsText ?? "" };
}

// Stregkode-fotoet gemmes i baggrunden til kvalitetskontrol
// (docs/DECISIONS.md 2026-09-19) og må aldrig blokere flowet.
export async function saveBarcodePhoto(
  photo: string,
  barcode: string,
  marketRegion: string,
  signals?: LanguageSignals,
  flowId?: string,
): Promise<string | null> {
  try {
    const response = await fetch("/api/ai/save-barcode-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scanFlowHeaders(flowId) },
      body: JSON.stringify({ photo, barcode, marketRegion, signals }),
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
    headers: { "Content-Type": "application/json", ...scanFlowHeaders(data.flowId) },
    body: JSON.stringify({
      barcode: data.barcode,
      marketRegion,
      signals: data.languageSignals,
      barcodeAnalysisId: data.barcodeAnalysisId,
      frontPhoto: data.frontPhoto,
      nutritionPhoto: data.nutritionPhoto,
      nutritionOcrText: data.nutritionOcrText,
      nutritionOcrConfidence: data.nutritionOcrConfidence,
      localNutrition: data.localNutrition ?? null,
      ingredientsPhoto: data.ingredientsOnNutritionPhoto ? undefined : data.ingredientsPhoto,
      ingredientsOcrText: data.ingredientsOcrText,
      ingredientsOcrConfidence: data.ingredientsOcrConfidence,
      localIngredientsText: data.localIngredientsText,
    }),
  });
  if (!response.ok) throw new Error("Quick product creation failed");
  const body = (await response.json()) as { product: { id: string } };
  return body.product.id;
}
