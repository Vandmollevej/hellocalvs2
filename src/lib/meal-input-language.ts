import { isRegionCode, regionToSpeechLang, type RegionCode } from "@/lib/regions";

// Sproget brugeren taler/skriver et måltid på (tale-siden på mobil og chat-
// siden på web, brugerens krav 2026-10-02). Talegenkendelse og AI-tolkning
// tager KUN højde for dette sprog; engelsk er altid med som fallback, fordi
// mange varer hedder noget på engelsk. Standard er regionens sprog
// (docs/DECISIONS.md 2026-09-12), men brugerens eget flagvalg vinder og
// huskes på enheden.

export const MEAL_INPUT_LANGUAGES = [
  { code: "da", flag: "denmark", speechLang: "da-DK", englishName: "Danish", names: { da: "Dansk", en: "Danish" } },
  { code: "sv", flag: "sweden", speechLang: "sv-SE", englishName: "Swedish", names: { da: "Svensk", en: "Swedish" } },
  { code: "nb", flag: "norway", speechLang: "nb-NO", englishName: "Norwegian (Bokmål)", names: { da: "Norsk", en: "Norwegian" } },
  { code: "de", flag: "germany", speechLang: "de-DE", englishName: "German", names: { da: "Tysk", en: "German" } },
  { code: "nl", flag: "netherlands", speechLang: "nl-NL", englishName: "Dutch", names: { da: "Hollandsk", en: "Dutch" } },
  { code: "fr", flag: "france", speechLang: "fr-FR", englishName: "French", names: { da: "Fransk", en: "French" } },
  { code: "it", flag: "italy", speechLang: "it-IT", englishName: "Italian", names: { da: "Italiensk", en: "Italian" } },
  { code: "es", flag: "spain", speechLang: "es-ES", englishName: "Spanish", names: { da: "Spansk", en: "Spanish" } },
  { code: "en", flag: "united-kingdom", speechLang: "en-GB", englishName: "English", names: { da: "Engelsk", en: "English" } },
] as const;

export type MealInputLanguage = (typeof MEAL_INPUT_LANGUAGES)[number];
export type MealInputLanguageCode = MealInputLanguage["code"];

const BY_CODE = new Map<string, MealInputLanguage>(MEAL_INPUT_LANGUAGES.map((language) => [language.code, language]));

// Regioner hvor flaget for regionens eget sprog bør være landets (fx USA's
// flag for engelsk i USA, Østrigs for tysk i Østrig).
const REGION_FLAG: Partial<Record<RegionCode, string>> = {
  AT: "austria",
  CH: "switzerland",
  BE: "belgium",
  US: "usa",
  CA: "canada",
  AU: "australia",
  NZ: "new-zealand",
  IE: "ireland",
};

export function isMealInputLanguageCode(value: unknown): value is MealInputLanguageCode {
  return typeof value === "string" && BY_CODE.has(value);
}

export function getMealInputLanguage(code: MealInputLanguageCode): MealInputLanguage {
  return BY_CODE.get(code) ?? MEAL_INPUT_LANGUAGES[0];
}

function primarySubtag(tag: string) {
  return tag.toLowerCase().split(/[-_]/)[0];
}

/** Regionens sprog (fx "DK" -> "da", "AT" -> "de"); dansk hvis ukendt. */
export function defaultMealInputLanguage(region: string | null | undefined): MealInputLanguageCode {
  const primary = primarySubtag(regionToSpeechLang(region ?? "DK"));
  return isMealInputLanguageCode(primary) ? primary : "da";
}

/** BCP-47-tag til talegenkendelsen: regionens variant, når sproget er regionens eget (de-AT, en-US …). */
export function speechLangFor(code: MealInputLanguageCode, region: string | null | undefined): string {
  const regionTag = regionToSpeechLang(region ?? "DK");
  return primarySubtag(regionTag) === code ? regionTag : getMealInputLanguage(code).speechLang;
}

export function flagFor(code: MealInputLanguageCode, region: string | null | undefined): string {
  if (region && isRegionCode(region) && defaultMealInputLanguage(region) === code) {
    return REGION_FLAG[region] ?? getMealInputLanguage(code).flag;
  }
  return getMealInputLanguage(code).flag;
}

export const MEAL_INPUT_LANGUAGE_STORAGE_KEY = "hf-meal-input-language";

export function readStoredMealInputLanguage(): MealInputLanguageCode | null {
  try {
    const stored = window.localStorage.getItem(MEAL_INPUT_LANGUAGE_STORAGE_KEY);
    return isMealInputLanguageCode(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function storeMealInputLanguage(code: MealInputLanguageCode) {
  try {
    window.localStorage.setItem(MEAL_INPUT_LANGUAGE_STORAGE_KEY, code);
  } catch {
    // Privat tilstand: valget gælder stadig, så længe siden er åben.
  }
}
