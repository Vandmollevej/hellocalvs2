// Varens sprog (docs/DECISIONS.md 2026-10-15). Kolonnerne på en vare står
// altid på dens originalsprog (Product.language) og overskrives aldrig af en
// oversættelse. Brugere med et andet app-sprog ser en oversættelse
// (ProductTranslation, src/lib/product-translations.ts).
//
// Sproget bestemmes af kilden, aldrig af ordene: en vare fra de danske ark
// er dansk, også når den hedder "Brie de Meaux" eller "Cheese snacks".
// Eneste undtagelse er ikke-latinske tegn (kinesisk, kyrillisk …), som
// giver skriftens sprog — også på en vare scannet i Danmark.
// Rene funktioner, så de kan testes med node --test.

import { barcodeMatchesRegion, inferGs1OriginCountryCode } from "./regions.ts";
import type { Locale } from "@/i18n";

// Appens sprog (src/i18n/index.ts LOCALES) — kopieret, så filen kan testes
// uden JSON-import.
const APP_LOCALES: readonly Locale[] = ["da", "en", "de", "fr", "nl", "sv", "no"];

// Ikke-latinske skrifter: græsk og frem til fonetiske udvidelser (kyrillisk,
// armensk, hebraisk, arabisk, indiske, thai, georgisk …), CJK inkl.
// kinesisk/japansk tegnsætning, koreansk og halvbredde-katakana. Latinske
// bogstaver (også æøå, äöü, é, ł) er udenfor.
export const FOREIGN_SCRIPT_PATTERN =
  "[Ͱ-ᶿ⺀-꛿가-퟿豈-﫿︰-﹏！-／：-＠｡-ￜ]";
const FOREIGN_SCRIPT = new RegExp(FOREIGN_SCRIPT_PATTERN, "u");

export function hasForeignScript(text: string | null | undefined): boolean {
  return !!text && FOREIGN_SCRIPT.test(text);
}

// Sproget ud fra skriften; null, når teksten kun har latinske tegn.
export function scriptLanguage(texts: Array<string | null | undefined>): string | null {
  const text = texts.filter(Boolean).join(" ");
  if (!hasForeignScript(text)) return null;
  if (/[぀-ヿｦ-ﾟ]/u.test(text)) return "ja";
  if (/[가-힯ᄀ-ᇿ]/u.test(text)) return "ko";
  if (/[⺀-鿿豈-﫿]/u.test(text)) return "zh";
  if (/[іїєґІЇЄҐ]/u.test(text)) return "uk";
  if (/[Ѐ-ӿ]/u.test(text)) return "ru";
  if (/[Ͱ-Ͽ]/u.test(text)) return "el";
  if (/[֐-׿]/u.test(text)) return "he";
  if (/[؀-ۿ]/u.test(text)) return "ar";
  if (/[฀-๿]/u.test(text)) return "th";
  if (/[ऀ-ॿ]/u.test(text)) return "hi";
  return "und";
}

// Landets sprog (src/lib/regions.ts, samme lande som OCR-sprogene).
const COUNTRY_LANGUAGE: Record<string, string> = {
  DK: "da", SE: "sv", NO: "no",
  DE: "de", AT: "de", CH: "de",
  NL: "nl", BE: "nl",
  FR: "fr", IT: "it", ES: "es",
  GB: "en", IE: "en", US: "en", CA: "en", US_CA: "en", AU: "en", NZ: "en",
};

export function countryLanguage(country: string | null | undefined): string | null {
  return country ? (COUNTRY_LANGUAGE[country.toUpperCase()] ?? null) : null;
}

// Danske kilder: ark, butikker og opskriftssider importeret til den danske
// database. Deres tekst er dansk og oversættes aldrig til dansk.
const DANISH_SOURCES = new Set(["FRIDA", "REMA1000", "BILKA", "VALDEMARSRO", "RETNEMT", "BETTERFEAST", "HELLOFRESH"]);

export type ProductLanguageSignals = {
  // Varens tekst (navn, variant, ingredienser, brand …).
  texts: Array<string | null | undefined>;
  externalSource?: string | null;
  // Open Food Facts' sprogfelt (off_products.lang).
  offLang?: string | null;
  // Open Food Facts-varen er allerede oversat til dansk i kolonnerne
  // (det ældre OFF-opslag, nameOriginal sat).
  translatedToDanish?: boolean;
  scannedCountry?: string | null;
  originCountryCode?: string | null;
  barcodes?: string[];
};

// Varens sprog ud fra kilden — null, når intet signal findes.
export function inferProductLanguage(signals: ProductLanguageSignals): string | null {
  const script = scriptLanguage(signals.texts);
  if (script) return script;
  if (signals.externalSource && DANISH_SOURCES.has(signals.externalSource)) return "da";
  if (signals.externalSource === "OPEN_FOOD_FACTS") {
    if (signals.translatedToDanish) return "da";
    const off = languageCode(signals.offLang);
    if (off) return off;
  }
  const fromCountry = countryLanguage(signals.scannedCountry) ?? countryLanguage(signals.originCountryCode);
  if (fromCountry) return fromCountry;
  for (const barcode of signals.barcodes ?? []) {
    const language = countryLanguage(inferGs1OriginCountryCode(barcode));
    if (language) return language;
  }
  return null;
}

// Hvilke varer oversættes (brugerens beslutning 2026-10-15: "Vent med
// oversættelse af produktark, frida mv."): importerede kilder (ark, Frida,
// butiksimporter, opskriftssider) oversættes ikke endnu — kun varer, som
// brugere har scannet/oprettet, og Open Food Facts/USDA-varer. Sæt
// TRANSLATE_IMPORTED_SOURCES til true, når de importerede også skal med.
export const TRANSLATE_IMPORTED_SOURCES = false;
const LOOKUP_SOURCES = new Set(["OPEN_FOOD_FACTS", "USDA"]);

export function isTranslatableSource(product: { externalSource?: string | null; createdByUserId?: string | null }): boolean {
  if (TRANSLATE_IMPORTED_SOURCES) return true;
  if (product.externalSource) return LOOKUP_SOURCES.has(product.externalSource);
  // Uden kilde: oprettet af en bruger (scanning) — ellers et ark/admin-import.
  return !!product.createdByUserId;
}

// Brugerens app-sprog ("da", "en-GB", "nb" …) som en af appens sprogkoder.
export function appLocaleOf(appLanguage: string | null | undefined): Locale {
  const base = (appLanguage ?? "").toLowerCase().split(/[-_]/)[0];
  const mapped = base === "nb" || base === "nn" ? "no" : base;
  return (APP_LOCALES as readonly string[]).includes(mapped) ? (mapped as Locale) : "da";
}

// Skal varen vises oversat for brugeren? Kun når varens sprog er kendt og
// et andet end brugerens. Ukendt sprog oversættes aldrig.
export function needsTranslation(productLanguage: string | null | undefined, viewer: Locale): boolean {
  const language = languageCode(productLanguage);
  return !!language && language !== viewer;
}

// Sprognavnet til oversætterens prompt.
export const TARGET_LANGUAGE_NAMES: Record<Locale, string> = {
  da: "dansk",
  en: "engelsk",
  de: "tysk",
  fr: "fransk",
  nl: "hollandsk",
  sv: "svensk",
  no: "norsk (bokmål)",
};

// Sprognavne, AI'en eller en kilde kan svare med i stedet for en kode.
const LANGUAGE_NAME_CODES: Record<string, string> = {
  chinese: "zh", kinesisk: "zh", mandarin: "zh", cantonese: "zh",
  japanese: "ja", japansk: "ja", korean: "ko", koreansk: "ko",
  russian: "ru", russisk: "ru", ukrainian: "uk", ukrainsk: "uk",
  arabic: "ar", arabisk: "ar", thai: "th", vietnamese: "vi", vietnamesisk: "vi",
  polish: "pl", polsk: "pl", turkish: "tr", tyrkisk: "tr", greek: "el", græsk: "el",
  portuguese: "pt", portugisisk: "pt", hebrew: "he", hebraisk: "he", hindi: "hi",
  danish: "da", dansk: "da", swedish: "sv", svensk: "sv", norwegian: "no", norsk: "no",
  german: "de", tysk: "de", dutch: "nl", hollandsk: "nl", french: "fr", fransk: "fr",
  italian: "it", italiensk: "it", spanish: "es", spansk: "es", english: "en", engelsk: "en",
};

// "zh-CN", "ZH", "Chinese", "kinesisk", "nb" → "zh"/"no"; ukendt → null.
export function languageCode(value: string | null | undefined): string | null {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return null;
  const tag = text.match(/^([a-z]{2,3})(?:[-_][a-z0-9]{2,8})*$/);
  if (tag && !LANGUAGE_NAME_CODES[text]) return tag[1] === "nb" || tag[1] === "nn" ? "no" : tag[1];
  for (const token of text.split(/[^a-zæøåäöü]+/u)) {
    if (LANGUAGE_NAME_CODES[token]) return LANGUAGE_NAME_CODES[token];
  }
  return null;
}

// Søgningen (brugerens regel 2026-10-15): varer på brugerens sprog, engelske
// varer, varer med ukendt sprog og varer med stregkode fra brugerens land.
// Varer på andre sprog vises kun, når intet af det giver et resultat — så
// har brugeren tydeligvis søgt efter noget på et andet sprog.
export function inViewerLanguage(
  product: { language: string | null; barcodes?: { code: string }[] },
  viewer: { locale: Locale; region: string },
): boolean {
  const language = languageCode(product.language);
  if (!language || language === viewer.locale || language === "en") return true;
  return (product.barcodes ?? []).some((barcode) => barcodeMatchesRegion(barcode.code, viewer.region));
}
