// Hvilket mærke data fra Health Connect/Apple Health kommer fra, ud fra
// afsender-appens pakke-/bundle-ID (Health Connect: dataOrigin.packageName,
// HealthKit: sourceRevision.source.bundleIdentifier). Bruges kun til at vise
// "Forbundet" på mærkets kort — intet sendes til mærket.

export type ViaBrand = "SAMSUNG_HEALTH" | "EUFY" | "RENPHO" | "XIAOMI" | "TUYA";

const PATTERNS: [ViaBrand, RegExp][] = [
  ["SAMSUNG_HEALTH", /shealth|samsung/i],
  ["EUFY", /eufy|oceanwing/i],
  ["RENPHO", /renpho|qingniu/i],
  ["XIAOMI", /xiaomi|huami|zepp|\bmi\.health|mifit/i],
  ["TUYA", /tuya|smartlife/i],
];

export function brandForOrigin(origin: unknown): ViaBrand | null {
  if (typeof origin !== "string" || !origin) return null;
  return PATTERNS.find(([, pattern]) => pattern.test(origin))?.[0] ?? null;
}
