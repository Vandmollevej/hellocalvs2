import { isRegionCode, gs1RegionCandidates, primaryOcrLanguages, type RegionCode } from "@/lib/regions";

// Danish labels for the language codes returned by primaryOcrLanguages(),
// used only to describe priority languages inside AI vision prompts (see
// src/app/api/ai/analyze-product-front, extract-ingredients-photo,
// extract-nutrition-v2) — not a language table in its own right, so this
// doesn't duplicate the region/OCR-language source of truth in regions.ts.
const LANGUAGE_LABELS: Record<string, string> = {
  dan: "dansk",
  swe: "svensk",
  nor: "norsk",
  deu: "tysk",
  fra: "fransk",
  ita: "italiensk",
  nld: "hollandsk",
  spa: "spansk",
  eng: "engelsk",
};

export type BarcodeContext = {
  barcode: string;
  gs1Prefix3: string | null;
  marketRegion: RegionCode;
  gs1Regions: RegionCode[];
  primaryOcrLanguages: string[];
  primaryLanguageLabels: string[];
  tesseractLanguageString: string;
};

// Barcode is scanned first in /camera/create. Later photos (front/
// ingredients/nutrition) must never change the market region or GS1 signal
// frozen here at scan time — jf. docs/DECISIONS.md, OpenAI product
// recognition (2026-09-16/17).
export function buildBarcodeContext(barcode: string, marketRegionInput: string): BarcodeContext {
  const marketRegion: RegionCode = isRegionCode(marketRegionInput) ? marketRegionInput : "DK";
  const cleanedBarcode = barcode.replace(/\D/g, "");
  const gs1Regions = gs1RegionCandidates(cleanedBarcode);
  const languages = primaryOcrLanguages(marketRegion, gs1Regions);

  return {
    barcode: cleanedBarcode,
    gs1Prefix3: cleanedBarcode.slice(0, 3) || null,
    marketRegion,
    gs1Regions,
    primaryOcrLanguages: languages,
    primaryLanguageLabels: languages.map((code) => LANGUAGE_LABELS[code] ?? code),
    tesseractLanguageString: languages.join("+"),
  };
}
