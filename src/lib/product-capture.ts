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
  // Hele forsidebilledet i fuld opløsning — gemmes som varens billede
  // (brugerens krav 2026-10-15); frontPhoto er kopien til AI'en.
  frontPhotoFull?: string;
  // Telefonens tekstlæsning af forsiden (reserve til navn/brand).
  frontOcrText?: string;
  nutritionPhoto?: string;
  nutritionOcrText?: string;
  nutritionOcrConfidence?: number;
  localNutrition?: ParsedNutrition | null;
  // Energien læst af AI under flowet (readEnergyPhoto) — bruges af oprettelsen.
  nutritionAnalysisId?: string;
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
    return { text, confidence: text ? result.confidence : 0, ocrFailed: false };
  } catch {
    return { text: "", confidence: 0, ocrFailed: true };
  }
}

// Forsiden: lokal OCR bruges til dublet-tjek mod databasen og til at finde et
// kendt mærke i teksten. Returnerer id/navn på en eksisterende vare, hvis
// teksten matcher en (plus OCR-tallene til admin "Log"). `preRead`: kaldet fra
// forlæsningen, mens brugeren sigter (serveren logger da kun fund).
export type FrontRead = {
  // Den læste tekst — sendes med oprettelsen som reserve til navn/brand, hvis
  // AI'en ikke kan læse forsiden (docs/DECISIONS.md 2026-10-16).
  text: string;
  duplicateId: string | null;
  duplicateName: string | null;
  brand: string | null;
  textLength: number;
  confidence: number;
  lookupFailed: boolean;
  ocrFailed: boolean;
};

export async function readFrontPhoto(
  photo: string,
  languages: string[],
  flowId?: string,
  options: { preRead?: boolean } = {},
): Promise<FrontRead> {
  const { text, confidence, ocrFailed } = await ocr(photo, languages);
  const stats = { text, textLength: text.length, confidence, ocrFailed, duplicateId: null, duplicateName: null, brand: null };
  if (!text) return { ...stats, lookupFailed: false };
  try {
    const response = await fetch("/api/products/recognize-text", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...scanFlowHeaders(flowId) },
      body: JSON.stringify({ text, preRead: options.preRead === true }),
    });
    if (!response.ok) return { ...stats, lookupFailed: true };
    const data = (await response.json()) as {
      product: { id: string; name?: string; brand?: { name?: string } | null } | null;
      brand?: { name: string } | null;
    };
    const product = data.product;
    return {
      ...stats,
      lookupFailed: false,
      duplicateId: product?.id ?? null,
      duplicateName: product ? `${product.brand?.name ?? ""} ${product.name ?? ""}`.trim() || null : null,
      brand: data.brand?.name ?? null,
    };
  } catch {
    return { ...stats, lookupFailed: true };
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
  // Den lokale tekstlæsning kastede en fejl (ikke blot "ingen tekst").
  ocrFailed?: boolean;
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
    return { text: "", confidence: 0, regions: { nutrition: null, ingredients: null }, nutrition: null, ingredientsText: null, ocrFailed: true };
  }
}

// Energi/indhold i den levende scanning (docs/DECISIONS.md 2026-10-02): hvert
// billede fra videoen læses med tabel-layout; næring og ingredienser findes
// i samme aflæsning, og flere billeder lægges sammen i src/lib/live-scan.ts.
export function readLabelPhoto(photo: string, languages: string[]) {
  return readLabel(photo, languages, true);
}

// Energi: næringstabellen læses lokalt; står ingredienslisten ved siden af,
// er indholds-trinnet også klaret.
export function readNutritionPhoto(photo: string, languages: string[]) {
  return readLabelPhoto(photo, languages);
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

// Energi-/indholdstrinnets hele, ubeskårne kamerabillede (docs/DECISIONS.md
// 2026-10-15) uploades under flowet og kobles til varen ved oprettelsen;
// nattens robot analyserer det én gang (mærkninger, finlæsning, stavekontrol).
export const BACK_PHOTO_TIMEOUT_MS = 60_000;

export async function uploadBackPhoto(
  photo: { url: string; width: number; height: number },
  step: "barcode" | "front" | "nutrition" | "ingredients",
  flowId: string,
): Promise<boolean> {
  try {
    const response = await fetch("/api/products/back-photos", {
      method: "POST",
      signal: AbortSignal.timeout(BACK_PHOTO_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", ...scanFlowHeaders(flowId) },
      body: JSON.stringify({ photo: photo.url, step, width: photo.width, height: photo.height }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Energi-trinnet (brugerens krav 2026-10-16): kunne telefonen ikke læse
// næringstabellen, læser AI'en fotoet, mens brugeren står på trinnet.
// Trinnet klares kun med ok = true; ellers tages billedet om.
export const ENERGY_READ_TIMEOUT_MS = 60_000;
export type EnergyReadResult =
  | { ok: true; analysisId: string }
  | { ok: false; reason: "unreadable" | "ai_unavailable" | "error" };

export async function readEnergyPhoto(
  photo: string,
  data: CaptureData,
  marketRegion: string,
): Promise<EnergyReadResult> {
  try {
    const response = await fetch("/api/products/read-energy", {
      method: "POST",
      signal: AbortSignal.timeout(ENERGY_READ_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", ...scanFlowHeaders(data.flowId) },
      body: JSON.stringify({
        photo,
        barcode: data.barcode,
        marketRegion,
        signals: data.languageSignals,
        ocrText: data.nutritionOcrText ?? "",
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; analysisId?: string; reason?: string }
      | null;
    if (body?.ok && typeof body.analysisId === "string") return { ok: true, analysisId: body.analysisId };
    const reason = body?.reason === "unreadable" || body?.reason === "ai_unavailable" ? body.reason : "error";
    return { ok: false, reason };
  } catch {
    return { ok: false, reason: "error" };
  }
}

// Uden tidsgrænse stod en hængende upload som et sort, låst kamera, mens
// serveren allerede havde oprettet varen (bruger 2026-10-14).
export const CREATE_TIMEOUT_MS = 60_000;

export async function createQuickProduct(data: CaptureData, marketRegion: string): Promise<string> {
  const response = await fetch("/api/products/quick", {
    method: "POST",
    signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
    headers: { "Content-Type": "application/json", ...scanFlowHeaders(data.flowId) },
    body: JSON.stringify({
      barcode: data.barcode,
      marketRegion,
      signals: data.languageSignals,
      barcodeAnalysisId: data.barcodeAnalysisId,
      frontPhoto: data.frontPhoto,
      frontPhotoFull: data.frontPhotoFull,
      frontOcrText: data.frontOcrText,
      nutritionPhoto: data.nutritionPhoto,
      nutritionOcrText: data.nutritionOcrText,
      nutritionOcrConfidence: data.nutritionOcrConfidence,
      localNutrition: data.localNutrition ?? null,
      nutritionAnalysisId: data.nutritionAnalysisId,
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

// Fejlede eller udløb oprettelsen, kan serveren alligevel have oprettet
// varen (svaret gik tabt): findes stregkoden nu, er det varen.
export async function findCreatedProduct(barcode: string, flowId?: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/products/lookup/${encodeURIComponent(barcode)}`, {
      signal: AbortSignal.timeout(15_000),
      headers: scanFlowHeaders(flowId),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { product?: { id?: string } };
    return body.product?.id ?? null;
  } catch {
    return null;
  }
}

// "Scan varen igen" (docs/DECISIONS.md 2026-10-02): samme fotos som "opret
// straks", men til en eksisterende vare (POST /api/products/[id]/rescan).
export async function submitProductRescan(productId: string, data: CaptureData, marketRegion: string): Promise<void> {
  // Uden tidsgrænse kan en hængende upload stå som sort kamera for evigt.
  const response = await fetch(`/api/products/${encodeURIComponent(productId)}/rescan`, {
    method: "POST",
    signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
    headers: { "Content-Type": "application/json", ...scanFlowHeaders(data.flowId) },
    body: JSON.stringify({
      marketRegion,
      signals: data.languageSignals,
      frontPhoto: data.frontPhoto,
      nutritionPhoto: data.nutritionPhoto,
      nutritionOcrText: data.nutritionOcrText,
      nutritionOcrConfidence: data.nutritionOcrConfidence,
      ingredientsPhoto: data.ingredientsOnNutritionPhoto ? undefined : data.ingredientsPhoto,
      ingredientsOcrText: data.ingredientsOcrText,
      ingredientsOcrConfidence: data.ingredientsOcrConfidence,
    }),
  });
  if (!response.ok) throw new Error(`Rescan failed (${response.status})`);
}

// 2-års kvalitetstjek (docs/DECISIONS.md 2026-10-15): varen er kendt, men over
// to år gammel. Fotoene gemmes til nattens vurdering
// (POST /api/products/[id]/quality-check); kunden går videre til varen med
// dens tidligere info, uanset svaret.
export async function submitProductQualityCheck(productId: string, data: CaptureData, marketRegion: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/products/${encodeURIComponent(productId)}/quality-check`, {
      method: "POST",
      signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", ...scanFlowHeaders(data.flowId) },
      body: JSON.stringify({
        marketRegion,
        signals: data.languageSignals,
        frontPhoto: data.frontPhoto,
        nutritionPhoto: data.nutritionPhoto,
        nutritionOcrText: data.nutritionOcrText,
        nutritionOcrConfidence: data.nutritionOcrConfidence,
        ingredientsPhoto: data.ingredientsOnNutritionPhoto ? undefined : data.ingredientsPhoto,
        ingredientsOcrText: data.ingredientsOcrText,
        ingredientsOcrConfidence: data.ingredientsOcrConfidence,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
