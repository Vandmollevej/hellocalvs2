import da from "./locales/da.json";
import en from "./locales/en.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import nl from "./locales/nl.json";
import sv from "./locales/sv.json";
import no from "./locales/no.json";

// Same language set as HelloFresh's markets: Danish, English, German, French,
// Dutch, Swedish and Norwegian (Bokmål).
export type Locale = "da" | "en" | "de" | "fr" | "nl" | "sv" | "no";

export const DEFAULT_LOCALE: Locale = "da";

export const LOCALES: Locale[] = ["da", "en", "de", "fr", "nl", "sv", "no"];

// Language names are shown in their own language, so they are never translated.
export const LOCALE_NAMES: Record<Locale, string> = {
  da: "Dansk",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  nl: "Nederlands",
  sv: "Svenska",
  no: "Norsk",
};

// BCP 47 tag for Intl formatting (dates, numbers).
const INTL_LOCALES: Record<Locale, string> = {
  da: "da-DK",
  en: "en-GB",
  de: "de-DE",
  fr: "fr-FR",
  nl: "nl-NL",
  sv: "sv-SE",
  no: "nb-NO",
};

export function intlLocale(locale: Locale): string {
  return INTL_LOCALES[locale] ?? INTL_LOCALES[DEFAULT_LOCALE];
}

// The static help centre (public/) exists once per language.
export function helpPagePath(locale: Locale): string {
  return locale === "da" ? "/hjaelp.html" : `/help-${locale}.html`;
}

// Keep this in sync with the shape of da.json — every locale file must carry
// identical keys. da.json is the reference/default dictionary.
export type Dictionary = typeof da;

const DICTIONARIES: Record<Locale, Dictionary> = { da, en, de, fr, nl, sv, no };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

type Primitive = string | number;

function resolveKey(dictionary: Dictionary, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined,
      dictionary
    );
}

function interpolate(template: string, params?: Record<string, Primitive>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, token: string) =>
    token in params ? String(params[token]) : match
  );
}

// Simple dot-path lookup with {token} interpolation, e.g.
// translate(dict, "settings.setupProgress", { done: 2, total: 3 }).
// Falls back to the Danish dictionary, then to the raw key, so a missing
// translation never crashes the UI.
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, Primitive>
): string {
  const dictionary = getDictionary(locale);
  let value = resolveKey(dictionary, key);

  if (typeof value !== "string" && locale !== DEFAULT_LOCALE) {
    value = resolveKey(getDictionary(DEFAULT_LOCALE), key);
  }

  if (typeof value !== "string") {
    return key;
  }

  return interpolate(value, params);
}
