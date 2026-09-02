import da from "./locales/da.json";
import en from "./locales/en.json";

export type Locale = "da" | "en";

export const DEFAULT_LOCALE: Locale = "da";

export const LOCALES: Locale[] = ["da", "en"];

// Keep this in sync with the shape of da.json/en.json — the two files must
// carry identical keys. da.json is the reference/default dictionary.
export type Dictionary = typeof da;

const DICTIONARIES: Record<Locale, Dictionary> = { da, en };

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
