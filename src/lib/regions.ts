// Understøttede regioner til personlige indstillinger. `barcodePrefixes` er
// landets GS1-stregkodepræfikser, brugt til at prioritere søgeresultater fra
// egen database og Open Food Facts (se src/app/api/products/route.ts).
export const REGIONS = [
  { code: "DK", label: "Danmark", barcodePrefixes: ["57"] },
  { code: "SE", label: "Sverige", barcodePrefixes: ["73"] },
  { code: "NO", label: "Norge", barcodePrefixes: ["70"] },
  { code: "DE", label: "Tyskland", barcodePrefixes: ["40", "41", "42", "43"] },
  { code: "GB", label: "Storbritannien", barcodePrefixes: ["50"] },
  { code: "US", label: "USA", barcodePrefixes: ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13"] },
] as const;

export type RegionCode = (typeof REGIONS)[number]["code"];

const PREFIXES_BY_REGION = new Map<string, readonly string[]>(
  REGIONS.map((r) => [r.code, r.barcodePrefixes])
);

export function isRegionCode(value: string): value is RegionCode {
  return PREFIXES_BY_REGION.has(value);
}

// True hvis stregkoden starter med et af regionens GS1-præfikser.
export function barcodeMatchesRegion(barcode: string, region: string): boolean {
  const prefixes = PREFIXES_BY_REGION.get(region);
  if (!prefixes) return false;
  return prefixes.some((prefix) => barcode.startsWith(prefix));
}
