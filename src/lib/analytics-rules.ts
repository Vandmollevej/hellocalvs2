// Anonym statistik (docs/PRIVACY.md "Statistik"). Fælles regler for
// klienten (der beregner grupperne) og serveren (der validerer og viser).

export const MIN_COHORT_SIZE = 25;

export const ANALYTICS_METRICS = {
  kcal: { width: 200, max: 6000 },
  proteinG: { width: 20, max: 400 },
  weightKg: { width: 5, max: 300 },
  waterMl: { width: 500, max: 8000 },
  activityMinutes: { width: 30, max: 600 },
} as const;

export type AnalyticsMetric = keyof typeof ANALYTICS_METRICS;

export const SEXES = ["FEMALE", "MALE", "UNKNOWN"] as const;

// 5-års-intervaller; aldrig præcis alder.
export function ageBand(age: number | null): string {
  if (age === null || !Number.isFinite(age) || age < 10) return "UNKNOWN";
  if (age >= 90) return "90+";
  const start = Math.floor(age / 5) * 5;
  return `${start}-${start + 4}`;
}

export function isAgeBand(value: unknown): value is string {
  return value === "UNKNOWN" || value === "90+" || (typeof value === "string" && /^\d{2}-\d{2}$/.test(value));
}

// Interval for en værdi, fx kcal 2340 → "2200-2400".
export function bucketFor(metric: AnalyticsMetric, value: number): string | null {
  const { width, max } = ANALYTICS_METRICS[metric];
  if (!Number.isFinite(value) || value < 0) return null;
  const start = Math.min(Math.floor(value / width) * width, max);
  return `${start}-${start + width}`;
}

export function isBucket(metric: AnalyticsMetric, value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d+)-(\d+)$/.exec(value);
  if (!match) return false;
  const { width, max } = ANALYTICS_METRICS[metric];
  const start = Number(match[1]);
  return start % width === 0 && start <= max && Number(match[2]) === start + width;
}

// Midtpunktet af et interval — serveren gemmer aldrig den præcise værdi.
export function bucketMidpoint(bucket: string): number {
  const [a, b] = bucket.split("-").map(Number);
  return (a + b) / 2;
}
