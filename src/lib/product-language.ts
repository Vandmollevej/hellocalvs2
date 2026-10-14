// Varetekst må kun vises på et HelloFresh-sprog (brugerens regel 2026-10-14):
// står navn, variant, mængde, ingredienser eller brand på et andet sprog (fx
// kinesisk), oversættes teksten til brugerens app-sprog. Ikke-latinske
// skrifttegn (kinesisk, japansk, koreansk, kyrillisk, arabisk, thai …) må
// aldrig vises. Rene funktioner her; oversættelsen ligger i
// src/lib/product-translate.ts.

import type { Locale } from "@/i18n";

// Appens sprog (src/i18n/index.ts LOCALES) — kopieret, så filen kan testes
// med node --test uden JSON-import.
const APP_LOCALES: readonly Locale[] = ["da", "en", "de", "fr", "nl", "sv", "no"];

// Sprogene i HelloFreshs leveringslande (src/lib/regions.ts, OCR-sprogene).
const HELLOFRESH_LANGUAGE_TOKENS = new Set([
  "da", "dan", "danish", "dansk",
  "sv", "swe", "swedish", "svensk",
  "no", "nb", "nn", "nor", "nob", "nno", "norwegian", "norsk", "bokmål", "bokmal",
  "de", "deu", "ger", "german", "deutsch", "tysk",
  "nl", "nld", "dut", "dutch", "nederlands", "hollandsk", "flemish", "vlaams",
  "fr", "fra", "fre", "french", "français", "francais", "fransk",
  "it", "ita", "italian", "italiano", "italiensk",
  "es", "spa", "spanish", "español", "espanol", "spansk",
  "en", "eng", "english", "engelsk",
]);

// Skrifter, der aldrig hører til et HelloFresh-sprog: græsk og frem til
// fonetiske udvidelser (kyrillisk, armensk, hebraisk, arabisk, indiske, thai,
// georgisk …), CJK-blokkene inkl. kinesisk/japansk tegnsætning, koreansk og
// halvbredde-katakana. Latinske bogstaver (også æøå, äöü, é, ł) er udenfor.
// Strengen bruges både her og som Postgres-regex i den natlige oprydning.
export const FOREIGN_SCRIPT_PATTERN =
  "[Ͱ-ᶿ⺀-꛿가-퟿豈-﫿︰-﹏！-／：-＠｡-ￜ]";
const FOREIGN_SCRIPT = new RegExp(FOREIGN_SCRIPT_PATTERN, "u");

export function hasForeignScript(text: string | null | undefined): boolean {
  return !!text && FOREIGN_SCRIPT.test(text);
}

// AI'ens sprogfelt kan være "zh", "zh-CN", "Chinese", "dansk/engelsk" …
// true = et HelloFresh-sprog, false = et andet sprog, null = ukendt/tomt.
export function isHelloFreshLanguage(language: string | null | undefined): boolean | null {
  const tokens = (language ?? "")
    .toLowerCase()
    .split(/[^a-zæøåäöüéèçñ]+/u)
    .filter(Boolean);
  if (!tokens.length) return null;
  if (tokens.some((token) => HELLOFRESH_LANGUAGE_TOKENS.has(token))) return true;
  return false;
}

// Skal teksterne oversættes? Ja ved ikke-latinske tegn, eller når den læste
// emballage tydeligt er på et sprog uden for HelloFresh-landene.
export function needsProductTranslation(
  texts: Array<string | null | undefined>,
  detectedLanguage?: string | null,
): boolean {
  if (texts.some(hasForeignScript)) return true;
  return isHelloFreshLanguage(detectedLanguage) === false && texts.some((text) => !!text?.trim());
}

// Brugerens app-sprog ("da", "en-GB", "nb" …) som en af appens sprogkoder.
export function translationTarget(appLanguage: string | null | undefined): Locale {
  const base = (appLanguage ?? "").toLowerCase().split(/[-_]/)[0];
  const mapped = base === "nb" || base === "nn" ? "no" : base;
  return (APP_LOCALES as readonly string[]).includes(mapped) ? (mapped as Locale) : "da";
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
