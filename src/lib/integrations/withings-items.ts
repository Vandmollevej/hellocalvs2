import type { HealthMetricType } from "@prisma/client";
import type { IntegrationItem } from "@/lib/integrations/store-items";

// Withings-måletyper (developer.withings.com, "Measure - Getmeas").
// Værdi = value * 10^unit. ALT, vægten/blodtryksapparatet/uret måler, hentes
// (brugerkrav 2026-10-03) — ikke kun vægt og fedtprocent.
const WEIGHT = 1;
// 77 = kropsvand i kg; gemmes både i kg og som % af vægten i samme måling.
const HYDRATION = 77;
const METRIC_BY_MEASTYPE: Record<number, { type: HealthMetricType; factor?: number }> = {
  4: { type: "HEIGHT_CM", factor: 100 },
  5: { type: "FAT_FREE_MASS_KG" },
  6: { type: "BODY_FAT_PERCENT" },
  8: { type: "FAT_MASS_KG" },
  9: { type: "BLOOD_PRESSURE_DIASTOLIC_MMHG" },
  10: { type: "BLOOD_PRESSURE_SYSTOLIC_MMHG" },
  11: { type: "HEART_RATE_BPM" },
  12: { type: "TEMPERATURE_C" },
  54: { type: "OXYGEN_SATURATION_PERCENT" },
  71: { type: "TEMPERATURE_C" },
  73: { type: "SKIN_TEMPERATURE_C" },
  76: { type: "MUSCLE_MASS_KG" },
  [HYDRATION]: { type: "BODY_WATER_KG" },
  88: { type: "BONE_MASS_KG" },
  91: { type: "PULSE_WAVE_VELOCITY_M_S" },
  123: { type: "VO2_MAX" },
  155: { type: "VASCULAR_AGE" },
  167: { type: "NERVE_HEALTH_SCORE" },
  168: { type: "EXTRACELLULAR_WATER_KG" },
  169: { type: "INTRACELLULAR_WATER_KG" },
  170: { type: "VISCERAL_FAT_INDEX" },
  226: { type: "BASAL_METABOLIC_RATE_KCAL" },
  227: { type: "METABOLIC_AGE" },
  229: { type: "ELECTROCHEMICAL_SKIN_CONDUCTANCE" },
};
export const MEASTYPES = [WEIGHT, ...Object.keys(METRIC_BY_MEASTYPE)].join(",");

export type MeasureGroup = { date: number; measures: { value: number; type: number; unit: number }[] };

// Withings-målegrupper → vejninger + målinger (ren funktion, testet i
// src/lib/integration-items.test.mjs).
export function withingsItems(groups: MeasureGroup[]): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const group of groups) {
    const at = new Date(group.date * 1000).toISOString();
    const valueOf = (type: number) => {
      const found = group.measures.find((measure) => measure.type === type);
      return found ? found.value * Math.pow(10, found.unit) : null;
    };
    for (const m of group.measures) {
      const value = m.value * Math.pow(10, m.unit);
      if (m.type === WEIGHT) {
        items.push({ kind: "weight", payload: { source: "WITHINGS", weightKg: value, weighedAt: at } });
        continue;
      }
      const mapped = METRIC_BY_MEASTYPE[m.type];
      if (!mapped) continue;
      const metricValue = Math.round(value * (mapped.factor ?? 1) * 100) / 100;
      items.push({ kind: "metric", payload: { source: "WITHINGS", type: mapped.type, value: metricValue, recordedAt: at } });
      if (m.type === HYDRATION) {
        const weight = valueOf(WEIGHT);
        if (weight && weight > 0) {
          const percent = Math.round((value / weight) * 1000) / 10;
          items.push({ kind: "metric", payload: { source: "WITHINGS", type: "BODY_WATER_PERCENT", value: percent, recordedAt: at } });
        }
      }
    }
  }
  return items;
}
