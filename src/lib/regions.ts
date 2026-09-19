// Supported regions for personal settings. `barcodePrefixes` are the
// country's GS1 barcode prefixes, used to prioritize search results from
// our own database and Open Food Facts (see src/app/api/products/route.ts).
// Udvidet 2026-09-06 (fejl #17 i Fejlretninger/FEJLLISTE.md) til at dække
// HelloFreshs faktiske leveringslande, ikke kun de oprindelige 6. GS1-præfikser
// er standard landepræfikser (GS1 GmbH's officielle liste), ikke gættet.
export const REGIONS = [
  { code: "DK", label: "Danmark", barcodePrefixes: ["57"] },
  { code: "SE", label: "Sverige", barcodePrefixes: ["73"] },
  { code: "NO", label: "Norge", barcodePrefixes: ["70"] },
  { code: "DE", label: "Tyskland", barcodePrefixes: ["40", "41", "42", "43"] },
  { code: "AT", label: "Østrig", barcodePrefixes: ["90", "91"] },
  { code: "CH", label: "Schweiz", barcodePrefixes: ["76"] },
  { code: "NL", label: "Holland", barcodePrefixes: ["87"] },
  { code: "BE", label: "Belgien", barcodePrefixes: ["54"] },
  { code: "FR", label: "Frankrig", barcodePrefixes: ["30", "31", "32", "33", "34", "35", "36", "37"] },
  { code: "IT", label: "Italien", barcodePrefixes: ["80", "81", "82", "83"] },
  { code: "ES", label: "Spanien", barcodePrefixes: ["84"] },
  { code: "GB", label: "Storbritannien", barcodePrefixes: ["50"] },
  { code: "IE", label: "Irland", barcodePrefixes: ["539"] },
  { code: "US", label: "USA", barcodePrefixes: ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13"] },
  { code: "CA", label: "Canada", barcodePrefixes: ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13"] },
  { code: "AU", label: "Australien", barcodePrefixes: ["93"] },
  { code: "NZ", label: "New Zealand", barcodePrefixes: ["94"] },
] as const;

export type RegionCode = (typeof REGIONS)[number]["code"];

const PREFIXES_BY_REGION = new Map<string, readonly string[]>(
  REGIONS.map((r) => [r.code, r.barcodePrefixes])
);

export function isRegionCode(value: string): value is RegionCode {
  return PREFIXES_BY_REGION.has(value);
}

// True if the barcode starts with one of the region's GS1 prefixes.
export function barcodeMatchesRegion(barcode: string, region: string): boolean {
  const prefixes = PREFIXES_BY_REGION.get(region);
  if (!prefixes) return false;
  return prefixes.some((prefix) => barcode.startsWith(prefix));
}

// EU law requires food packaging to carry its declarations in the country's
// official language, regardless of what display language a user's phone/
// browser happens to be set to (jf. docs/DECISIONS.md 2026-09-12) — so OCR
// and speech recognition must expect the REGION's language, never
// navigator.language or the app's own UI locale. Tesseract.js language codes
// (ISO 639-2/B, "+"-joined for multiple), English always included as a
// secondary OCR language for mixed-language packaging text.
const OCR_LANGUAGE_BY_REGION: Record<RegionCode, string> = {
  DK: "dan+eng",
  SE: "swe+eng",
  NO: "nor+eng",
  DE: "deu+eng",
  AT: "deu+eng",
  CH: "deu+eng",
  NL: "nld+eng",
  BE: "nld+eng",
  FR: "fra+eng",
  IT: "ita+eng",
  ES: "spa+eng",
  GB: "eng",
  IE: "eng",
  US: "eng",
  CA: "eng+fra",
  AU: "eng",
  NZ: "eng",
};

export function regionToOcrLanguage(region: string): string {
  return isRegionCode(region) ? OCR_LANGUAGE_BY_REGION[region] : "dan+eng";
}

// GS1 country-prefix candidates for a barcode. Used only as a *fallback*
// signal alongside the user's own region below — never a whitelist, and
// never treated as a confirmed physical country of production (a GS1 prefix
// is a registration/issuance signal only). See docs/DECISIONS.md, OpenAI
// product recognition (2026-09-16/17).
export function gs1RegionCandidates(barcode: string): RegionCode[] {
  const cleaned = barcode.replace(/\D/g, "");
  if (!cleaned) return [];
  // US/CA share the 000-139 GS1 range in this project's mapping, so both
  // are returned rather than inventing one certain match.
  return REGIONS.filter((region) =>
    region.barcodePrefixes.some((prefix) => cleaned.startsWith(prefix))
  ).map((region) => region.code);
}

// Ordered, deduplicated Tesseract/vision language codes: the user's market
// region is the primary signal (never the phone/browser display language,
// see OCR_LANGUAGE_BY_REGION above), the barcode's GS1 signal is a
// secondary/fallback signal, English is always included last as a safety
// net. This is a priority order, not a hard restriction — low-confidence
// OCR/vision may still recognize other languages.
export function primaryOcrLanguages(marketRegion: string, gs1Regions: RegionCode[]): string[] {
  const region = isRegionCode(marketRegion) ? marketRegion : "DK";
  const codesFor = (r: RegionCode) => OCR_LANGUAGE_BY_REGION[r].split("+");
  return [...new Set([...codesFor(region), ...gs1Regions.flatMap(codesFor), "eng"])];
}

// BCP-47 speech-recognition language tags per region, same reasoning as
// OCR_LANGUAGE_BY_REGION above.
const SPEECH_LANG_BY_REGION: Record<RegionCode, string> = {
  DK: "da-DK",
  SE: "sv-SE",
  NO: "nb-NO",
  DE: "de-DE",
  AT: "de-AT",
  CH: "de-CH",
  NL: "nl-NL",
  BE: "nl-BE",
  FR: "fr-FR",
  IT: "it-IT",
  ES: "es-ES",
  GB: "en-GB",
  IE: "en-IE",
  US: "en-US",
  CA: "en-CA",
  AU: "en-AU",
  NZ: "en-NZ",
};

export function regionToSpeechLang(region: string): string {
  return isRegionCode(region) ? SPEECH_LANG_BY_REGION[region] : "da-DK";
}

function ean13CheckDigit(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(digits12[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

// A fictional (never looked up) EAN-13, used only as the illustration inside
// the live barcode-scan guide on /camera?mode=product — starts with the
// user's region's real 3-digit GS1 prefix so it matches what their own
// barcodes actually look like.
export function buildFakeBarcodeForRegion(region: string): string {
  const prefixes = PREFIXES_BY_REGION.get(region) ?? PREFIXES_BY_REGION.get("DK")!;
  const prefix3 = prefixes[0].length >= 3 ? prefixes[0].slice(0, 3) : prefixes[0].padEnd(3, "0");
  const body = prefix3.padEnd(12, "0");
  return `${body}${ean13CheckDigit(body)}`;
}

// Human-readable EAN-13 grouping: 1 digit, then two groups of 6.
export function formatEan13(code: string): string {
  return `${code.slice(0, 1)} ${code.slice(1, 7)} ${code.slice(7, 13)}`;
}

// A single-value GS1 origin/market signal for a barcode, stored on
// Product.originCountryCode and used only as a search-ranking boost (see
// src/lib/product-search-ranking.ts, docs/DECISIONS.md 2026-09-19). Unlike
// gs1RegionCandidates() above (which returns every matching region as an
// OCR-language fallback list), this collapses to one code — or "US_CA" when
// the prefix is ambiguous between the two — and null when the prefix maps to
// more than one distinct region. Same caveat applies: a GS1 prefix identifies
// where the company prefix was issued, not necessarily the physical
// manufacturing country, and must never be shown as such in the UI.
export function inferGs1OriginCountryCode(barcode: string): string | null {
  const matches = REGIONS.filter((region) =>
    region.barcodePrefixes.some((prefix) => barcode.startsWith(prefix))
  );
  if (matches.length === 0) return null;

  const codes = [...new Set(matches.map((match) => match.code))];
  if (codes.length === 1) return codes[0];
  if (codes.length === 2 && codes.includes("US") && codes.includes("CA")) return "US_CA";
  return null;
}
