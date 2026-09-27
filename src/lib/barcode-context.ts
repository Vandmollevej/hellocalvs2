import {
  CROSS_BORDER_REGIONS,
  isRegionCode,
  gs1RegionCandidates,
  primaryOcrLanguages,
  type LanguageSignals,
  type RegionCode,
} from "@/lib/regions";

// Danish labels for the language codes returned by primaryOcrLanguages(),
// used only to describe priority languages inside AI vision prompts (see
// src/lib/product-ai-tasks.ts) — not a language table in its own right, so
// this doesn't duplicate the region/OCR-language source of truth in regions.ts.
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

// Tesseract bliver markant langsommere pr. ekstra sprog (test 2026-09-27:
// 3 sprog ~3x så lang tid som 1), så lokal OCR får kun de første.
const MAX_TESSERACT_LANGUAGES = 3;

export type BarcodeContext = {
  barcode: string;
  gs1Prefix3: string | null;
  marketRegion: RegionCode;
  gs1Regions: RegionCode[];
  signals: LanguageSignals;
  // Fx "I Danmark sælges også svenske og tyske varer …" til AI-prompten.
  crossBorderNote: string | null;
  primaryOcrLanguages: string[];
  primaryLanguageLabels: string[];
  tesseractLanguages: string[];
  tesseractLanguageString: string;
};

const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

// Signaler fra klienten valideres, før de bruges i prompts eller gemmes.
export function cleanLanguageSignals(value: unknown): LanguageSignals {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const country = typeof source.locationCountry === "string" ? source.locationCountry.trim().toUpperCase() : "";
  const appLanguage = typeof source.appLanguage === "string" ? source.appLanguage.trim() : "";
  const phoneLanguages = Array.isArray(source.phoneLanguages)
    ? source.phoneLanguages.filter((tag): tag is string => typeof tag === "string" && LANGUAGE_TAG.test(tag)).slice(0, 3)
    : [];
  return {
    locationCountry: /^[A-Z]{2}$/.test(country) ? country : null,
    appLanguage: LANGUAGE_TAG.test(appLanguage) ? appLanguage : null,
    phoneLanguages,
  };
}

// Barcode is scanned first in /camera/create. Later photos (front/
// ingredients/nutrition) must never change the market region, GS1 signal or
// language signals frozen here at scan time — jf. docs/DECISIONS.md, OpenAI
// product recognition (2026-09-16/17) og sprogsignaler (2026-09-27).
export function buildBarcodeContext(
  barcode: string,
  marketRegionInput: string,
  signalsInput?: unknown,
): BarcodeContext {
  const marketRegion: RegionCode = isRegionCode(marketRegionInput) ? marketRegionInput : "DK";
  const cleanedBarcode = barcode.replace(/\D/g, "");
  const gs1Regions = gs1RegionCandidates(cleanedBarcode);
  const signals = cleanLanguageSignals(signalsInput);
  const languages = primaryOcrLanguages(marketRegion, gs1Regions, signals);
  // Lokal OCR får ikke grænsehandels-sprogene (kun når stregkoden selv peger
  // dertil), så den ikke bliver langsommere for helt almindelige varer.
  const tesseractLanguages = primaryOcrLanguages(marketRegion, gs1Regions, signals, {
    includeCrossBorder: false,
  }).slice(0, MAX_TESSERACT_LANGUAGES);

  return {
    barcode: cleanedBarcode,
    gs1Prefix3: cleanedBarcode.slice(0, 3) || null,
    marketRegion,
    gs1Regions,
    signals,
    crossBorderNote: CROSS_BORDER_REGIONS[marketRegion]?.note ?? null,
    primaryOcrLanguages: languages,
    primaryLanguageLabels: languages.map((code) => LANGUAGE_LABELS[code] ?? code),
    tesseractLanguages,
    tesseractLanguageString: tesseractLanguages.join("+"),
  };
}

// Én linje til AI-prompten med de signaler, der faktisk er kendt.
export function describeLanguageSignals(signals: LanguageSignals): string | null {
  const parts = [
    signals.locationCountry ? `telefonens land ${signals.locationCountry}` : null,
    signals.appLanguage ? `appens sprog ${signals.appLanguage}` : null,
    signals.phoneLanguages?.length ? `telefonens sprog ${signals.phoneLanguages.join(", ")}` : null,
  ].filter(Boolean);
  return parts.length ? `Øvrige sprogsignaler: ${parts.join("; ")}.` : null;
}
