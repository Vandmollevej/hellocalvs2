// Cardio-målinger (smartur + manuel indtastning) — lagres i HealthMetric.
export const CARDIO_METRICS = [
  { type: "RESTING_HEART_RATE_BPM", key: "restingHr", unit: "bpm", agg: "min", min: 20, max: 140, decimals: 0 },
  { type: "HEART_RATE_MAX_BPM", key: "maxHr", unit: "bpm", agg: "max", min: 60, max: 250, decimals: 0 },
  { type: "VO2_MAX", key: "vo2Max", unit: "ml/kg/min", agg: "avg", min: 10, max: 100, decimals: 1 },
  { type: "OXYGEN_SATURATION_PERCENT", key: "spo2", unit: "%", agg: "avg", min: 50, max: 100, decimals: 1 },
  { type: "HEART_RATE_VARIABILITY_MS", key: "hrv", unit: "ms", agg: "avg", min: 1, max: 300, decimals: 0 },
  { type: "RESPIRATORY_RATE_BPM", key: "respiratoryRate", unit: "/min", agg: "avg", min: 4, max: 60, decimals: 1 },
  { type: "HEART_RATE_RECOVERY_BPM", key: "hrRecovery", unit: "bpm", agg: "max", min: 1, max: 120, decimals: 0 },
] as const;

export type CardioMetric = (typeof CARDIO_METRICS)[number];
export const CARDIO_TYPES: string[] = CARDIO_METRICS.map((m) => m.type);

export const CARDIO_RANGES = [
  { key: "30", days: 30 },
  { key: "90", days: 90 },
  { key: "180", days: 180 },
  { key: "365", days: 365 },
  { key: "all", days: 0 },
] as const;

// Én værdi pr. dag (laveste/højeste/gennemsnit afhængig af målingen).
export function dailyValues(
  rows: { value: number; recordedAt: string }[],
  agg: CardioMetric["agg"],
): { at: string; value: number }[] {
  const byDay = new Map<string, number[]>();
  for (const r of rows) {
    const day = r.recordedAt.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), r.value]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({
      at: `${day}T12:00:00.000Z`,
      value: agg === "min" ? Math.min(...v) : agg === "max" ? Math.max(...v) : v.reduce((a, b) => a + b, 0) / v.length,
    }));
}
