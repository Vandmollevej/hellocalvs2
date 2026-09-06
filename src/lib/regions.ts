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
