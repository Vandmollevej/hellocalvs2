// Decimaltegn i varetekster (brugerens regel 2026-10-10, docs/REGLER.md):
// arkene og databasen skriver decimaler med punktum ("1.5 l", "3.5% fedt"),
// men brugeren ser landets eget decimaltegn — komma i Danmark og de andre
// komma-lande ("1,5 l"), punktum i fx Storbritannien og USA. Ældre data og
// registreringernes titleSnapshot har stadig komma, så omskrivningen virker
// begge veje. Kun tal med ét decimaltegn omskrives: "3,6,9" (en opremsning)
// og "10.10.2026" røres ikke, og komma med mellemrum ("45+, med kommen") er
// aldrig et decimaltegn.

export type DecimalSeparator = "," | ".";

// Bruges kun hvis Intl ikke kan svare (fx et meget gammelt browser-Intl).
// Lande hvor punktum er decimaltegn; alle andre bruger komma.
const DOT_REGIONS = new Set([
  "US", "CA", "GB", "IE", "AU", "NZ", "CH", "LI", "MX", "JP", "CN", "HK", "TW", "KR", "IN", "PK", "BD",
  "LK", "NP", "SG", "MY", "PH", "TH", "IL", "SA", "AE", "QA", "KW", "BH", "OM", "JO", "EG", "NG",
  "GH", "KE", "UG", "TZ", "ZW", "BW", "MT", "PR", "DO", "GT", "HN", "SV", "NI", "PA", "PE",
]);

const cache = new Map<string, DecimalSeparator>();

/** Decimaltegnet i et land (ISO 3166-1 alpha-2). Ukendt land = Danmark = komma. */
export function decimalSeparatorForRegion(region: string | null | undefined): DecimalSeparator {
  const code = (region ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return ",";
  const cached = cache.get(code);
  if (cached) return cached;
  let separator: DecimalSeparator = DOT_REGIONS.has(code) ? "." : ",";
  try {
    // CLDR ved, hvilket decimaltegn landets hovedsprog bruger (und-CH → de-CH → ".").
    const locale = new Intl.Locale("und", { region: code }).maximize();
    const part = new Intl.NumberFormat(locale.toString()).formatToParts(1.5).find((p) => p.type === "decimal");
    if (part) separator = part.value === "," ? "," : ".";
  } catch {
    // Intl.Locale mangler — brug listen ovenfor.
  }
  cache.set(code, separator);
  return separator;
}

const DOT_DECIMAL = /(?<![\d.,])(\d+)\.(\d+)(?![\d.,])/g;
const COMMA_DECIMAL = /(?<![\d.,])(\d+),(\d+)(?![\d.,])/g;
// Gammelt dansk tusindtalspunktum ("1.080 g") — gram med tre decimaler findes
// ikke, så det er et tusindtal og bliver stående i komma-lande.
const DANISH_THOUSANDS = /^[1-9]\d{0,2}\.\d{3}\s?(?:g|mg|ml|gram)\b/i;

/** Skriver decimaltal i en varetekst med det givne decimaltegn. */
export function localizeDecimals(text: string, separator: DecimalSeparator): string {
  if (!text || !/\d[.,]\d/.test(text)) return text;
  if (separator === ".") return text.replace(COMMA_DECIMAL, "$1.$2");
  return text.replace(DOT_DECIMAL, (match, whole: string, fraction: string, offset: number, all: string) =>
    DANISH_THOUSANDS.test(all.slice(offset)) ? match : `${whole},${fraction}`,
  );
}

/** Søgning: "1,5" skal også finde "1.5" og omvendt. Returnerer den anden skrivemåde, hvis der er en. */
export function decimalVariants(query: string): string[] {
  if (!/\d[.,]\d/.test(query)) return [];
  const asDot = query.replace(COMMA_DECIMAL, "$1.$2");
  const asComma = query.replace(DOT_DECIMAL, "$1,$2");
  return [...new Set([asDot, asComma])].filter((variant) => variant !== query);
}
