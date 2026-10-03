import type { IntegrationItem } from "@/lib/integrations/store-items";

// Withings-målinger → Hello Cal (docs/DECISIONS.md 2026-10-03: alt, vægten
// måler, kommer med). Værdi = value * 10^unit. Kropsvand (77) kommer i kg og
// gemmes som % af vægten i samme måling, ligesom Apple Health/Health Connect.
export const WITHINGS_MEASURE = {
  WEIGHT: 1,
  HEIGHT: 4, // meter
  FAT_FREE_MASS: 5,
  FAT_RATIO: 6,
  FAT_MASS: 8,
  HEART_PULSE: 11,
  TEMPERATURE: 12,
  SPO2: 54,
  BODY_TEMPERATURE: 71,
  MUSCLE_MASS: 76,
  HYDRATION: 77,
  BONE_MASS: 88,
  VO2_MAX: 123,
  VISCERAL_FAT: 170,
} as const;

export const WITHINGS_MEASURE_TYPES = Object.values(WITHINGS_MEASURE);

// Withings-måletype → HealthMetricType (vægt, højde og kropsvand har egne regler).
const METRIC_TYPE: Record<number, string> = {
  [WITHINGS_MEASURE.FAT_FREE_MASS]: "FAT_FREE_MASS_KG",
  [WITHINGS_MEASURE.FAT_RATIO]: "BODY_FAT_PERCENT",
  [WITHINGS_MEASURE.FAT_MASS]: "FAT_MASS_KG",
  [WITHINGS_MEASURE.HEART_PULSE]: "HEART_RATE_BPM",
  [WITHINGS_MEASURE.TEMPERATURE]: "TEMPERATURE_C",
  [WITHINGS_MEASURE.SPO2]: "OXYGEN_SATURATION_PERCENT",
  [WITHINGS_MEASURE.BODY_TEMPERATURE]: "TEMPERATURE_C",
  [WITHINGS_MEASURE.MUSCLE_MASS]: "MUSCLE_MASS_KG",
  [WITHINGS_MEASURE.BONE_MASS]: "BONE_MASS_KG",
  [WITHINGS_MEASURE.VO2_MAX]: "VO2_MAX",
  [WITHINGS_MEASURE.VISCERAL_FAT]: "VISCERAL_FAT_INDEX",
};

export type WithingsMeasureGroup = { date: number; measures: { value: number; type: number; unit: number }[] };

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;

export function withingsItems(groups: WithingsMeasureGroup[]): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const group of groups) {
    const at = new Date(group.date * 1000).toISOString();
    const valueOf = (type: number) => {
      const found = group.measures.find((measure) => measure.type === type);
      return found ? found.value * Math.pow(10, found.unit) : null;
    };
    const metric = (type: string, value: number) =>
      items.push({ kind: "metric", payload: { source: "WITHINGS", type, value, recordedAt: at } });

    for (const m of group.measures) {
      const value = m.value * Math.pow(10, m.unit);
      if (!Number.isFinite(value) || value <= 0) continue;
      if (m.type === WITHINGS_MEASURE.WEIGHT) {
        items.push({ kind: "weight", payload: { source: "WITHINGS", weightKg: round(value, 2), weighedAt: at } });
      } else if (m.type === WITHINGS_MEASURE.HEIGHT) {
        metric("HEIGHT_CM", round(value * 100, 1));
      } else if (m.type === WITHINGS_MEASURE.HYDRATION) {
        const weight = valueOf(WITHINGS_MEASURE.WEIGHT);
        if (weight && weight > 0) metric("BODY_WATER_PERCENT", round((value / weight) * 100, 1));
      } else if (METRIC_TYPE[m.type]) {
        metric(METRIC_TYPE[m.type], round(value, 2));
      }
    }
  }
  return items;
}
