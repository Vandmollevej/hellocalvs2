// Væskestatistik (/statistics/body-water, docs/DECISIONS.md 2026-09-29):
// kropsvand (% af kropsvægt, fra smartvægte) pr. dag sammenholdt med samme
// dags kalorier, salt og sukker — som mulige årsager til udsving. Ren
// beregning; siden henter selv data.

import type { HealthMetricTotals } from "@/lib/stat-cards";
import { groupByDay, type RegistrationTotals } from "@/lib/daily-totals";
import { localDateKey } from "@/lib/sleep-quality";

export type WaterFactorKey = "kcal" | "salt" | "sugar";
export const WATER_FACTORS: { key: WaterFactorKey; unit: string }[] = [
  { key: "kcal", unit: "kcal" },
  { key: "salt", unit: "g" },
  { key: "sugar", unit: "g" },
];

export type WaterStatDay = { date: Date; waterPercent: number | null; kcal: number | null; salt: number | null; sugar: number | null };

export function buildWaterStatDays(input: {
  days: Date[];
  registrations: RegistrationTotals[];
  metrics: HealthMetricTotals[];
}): WaterStatDay[] {
  const totals = new Map(groupByDay(input.registrations).map((total) => [total.dateKey, total]));
  const water = new Map<string, { sum: number; count: number }>();
  for (const metric of input.metrics) {
    if (metric.type !== "BODY_WATER_PERCENT") continue;
    const key = localDateKey(new Date(metric.recordedAt));
    const entry = water.get(key) ?? { sum: 0, count: 0 };
    entry.sum += metric.value;
    entry.count += 1;
    water.set(key, entry);
  }
  return input.days.map((date) => {
    const key = localDateKey(date);
    const total = totals.get(key);
    const w = water.get(key);
    return {
      date,
      waterPercent: w ? Math.round((w.sum / w.count) * 10) / 10 : null,
      kcal: total ? Math.round(total.kcal) : null,
      salt: total ? Math.round(total.salt * 10) / 10 : null,
      sugar: total ? Math.round(total.sugar * 10) / 10 : null,
    };
  });
}

// Pearson-korrelation mellem kropsvand og en faktor over dage med begge værdier.
// Null ved under 5 par eller ingen variation — så gættes der aldrig.
export function waterCorrelation(days: WaterStatDay[], factor: WaterFactorKey): number | null {
  const pairs = days.flatMap((d) => (d.waterPercent !== null && d[factor] !== null ? [[d.waterPercent, d[factor] as number]] : []));
  if (pairs.length < 5) return null;
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const mx = mean(pairs.map((p) => p[0]));
  const my = mean(pairs.map((p) => p[1]));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? null : Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100;
}
