// Omsætning af Huawei Health Kit-svar til Hello Cals fælles poster (rene
// funktioner, testes i src/lib/integration-items.test.mjs).

import type { IntegrationItem } from "@/lib/integrations/store-items";

// Danske brugere: dagene regnes i dansk tid.
const TIME_ZONE = "Europe/Copenhagen";

export type FieldValue = { fieldName?: string; integerValue?: number; longValue?: number; floatValue?: number; doubleValue?: number };
export type SamplePoint = { dataTypeName?: string; startTime?: number | string; endTime?: number | string; value?: FieldValue[] };
export type Group = { startTime?: number | string; sampleSet?: { samplePoints?: SamplePoint[] }[] };
export type HealthRecord = { startTime?: number | string; endTime?: number | string; value?: FieldValue[] };
export type ActivityRecord = {
  name?: string;
  startTime?: number | string;
  endTime?: number | string;
  activitySummary?: { dataSummary?: SamplePoint[] };
};

// Huawei bruger både ms og ns (samplePoints/healthRecords) — normalisér til ms.
export function huaweiTimeMs(value: number | string | undefined): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  if (n > 1e17) return n / 1e6;
  if (n > 1e14) return n / 1e3;
  if (n > 1e11) return n;
  return n * 1000;
}

export function huaweiField(values: FieldValue[] | undefined, ...names: string[]): number | null {
  for (const name of names) {
    const found = values?.find((v) => v.fieldName === name);
    const n = found?.integerValue ?? found?.longValue ?? found?.floatValue ?? found?.doubleValue;
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return null;
}

export function offsetMinutes(at: Date) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

export function huaweiTimeZone(at: Date) {
  const total = offsetMinutes(at);
  const abs = Math.abs(total);
  return `${total < 0 ? "-" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}${String(abs % 60).padStart(2, "0")}`;
}

// Lokal dato som Hello Cals dagsnøgle (YYYY-MM-DDT00:00:00.000Z).
export function dayKey(ms: number) {
  const local = new Date(ms + offsetMinutes(new Date(ms)) * 60_000);
  return `${local.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export const yyyymmdd = (d: Date) => dayKey(d.getTime()).slice(0, 10).replace(/-/g, "");

export function metric(type: string, value: number | null, recordedAt: string): IntegrationItem[] {
  return value !== null && Number.isFinite(value) && value > 0
    ? [{ kind: "metric", payload: { source: "HUAWEI_HEALTH", type, value, recordedAt } }]
    : [];
}

export function huaweiDailyItems(metricType: string, fields: string[], groups: Group[], scale = 1): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const group of groups) {
    const start = huaweiTimeMs(group.startTime);
    if (start === null) continue;
    const at = dayKey(start);
    let total: number | null = null;
    for (const set of group.sampleSet ?? []) {
      for (const point of set.samplePoints ?? []) {
        const value = huaweiField(point.value, ...fields);
        if (value !== null) total = Math.max(total ?? 0, value);
      }
    }
    if (total !== null) items.push(...metric(metricType, Math.round(total * scale * 100) / 100, at));
  }
  return items;
}

export function huaweiWeightItems(points: SamplePoint[]): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const point of points) {
    const ms = huaweiTimeMs(point.endTime ?? point.startTime);
    if (ms === null) continue;
    const at = new Date(ms).toISOString();
    const weight = huaweiField(point.value, "body_weight");
    if (weight && weight > 0) items.push({ kind: "weight", payload: { source: "HUAWEI_HEALTH", weightKg: weight, weighedAt: at } });
    const field = (...names: string[]) => huaweiField(point.value, ...names);
    // Kropsvand: procent direkte, ellers kg omregnet med vægten.
    const waterKg = field("moisture");
    const waterPercent = field("moisture_rate") ?? (waterKg && weight && weight > 0 ? Math.round((waterKg / weight) * 1000) / 10 : null);
    items.push(
      ...metric("BODY_FAT_PERCENT", field("body_fat_rate"), at),
      ...metric("FAT_MASS_KG", field("body_fat"), at),
      ...metric("MUSCLE_MASS_KG", field("muscle_mass"), at),
      ...metric("SKELETAL_MUSCLE_MASS_KG", field("skeletal_muscle_mass"), at),
      ...metric("BONE_MASS_KG", field("bone_salt", "bone_mass"), at),
      ...metric("BODY_WATER_PERCENT", waterPercent, at),
      ...metric("VISCERAL_FAT_INDEX", field("visceral_fat_level"), at),
      ...metric("PROTEIN_PERCENT", field("protein_rate"), at),
      ...metric("BASAL_METABOLIC_RATE_KCAL", field("basal_metabolism"), at),
      ...metric("METABOLIC_AGE_YEARS", field("body_age"), at),
      ...metric("BMI", field("bmi"), at)
    );
  }
  return items;
}

// Enkeltmålinger (blodtryk, SpO2, temperatur, blodsukker): datatype-felter → måletyper.
export const HUAWEI_SAMPLE_TYPES: { dataType: string; scope: string; metrics: { type: string; fields: string[] }[] }[] = [
  {
    dataType: "com.huawei.instantaneous.blood_pressure",
    scope: "bloodpressure",
    metrics: [
      { type: "BLOOD_PRESSURE_SYSTOLIC_MMHG", fields: ["systolic_pressure"] },
      { type: "BLOOD_PRESSURE_DIASTOLIC_MMHG", fields: ["diastolic_pressure"] },
      { type: "HEART_RATE_BPM", fields: ["sphygmus"] },
    ],
  },
  { dataType: "com.huawei.instantaneous.spo2", scope: "oxygensaturation", metrics: [{ type: "OXYGEN_SATURATION_PERCENT", fields: ["saturation"] }] },
  { dataType: "com.huawei.instantaneous.body.temperature", scope: "bodytemperature", metrics: [{ type: "TEMPERATURE_C", fields: ["temperature"] }] },
  { dataType: "com.huawei.instantaneous.blood_glucose", scope: "bloodglucose", metrics: [{ type: "BLOOD_GLUCOSE_MMOL_L", fields: ["level"] }] },
];

export function huaweiSampleItems(metrics: { type: string; fields: string[] }[], points: SamplePoint[]): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const point of points) {
    const ms = huaweiTimeMs(point.endTime ?? point.startTime);
    if (ms === null) continue;
    const at = new Date(ms).toISOString();
    for (const m of metrics) items.push(...metric(m.type, huaweiField(point.value, ...m.fields), at));
  }
  return items;
}

export function huaweiSleepItems(records: HealthRecord[]): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const record of records) {
    const end = huaweiTimeMs(huaweiField(record.value, "wakeup_time") ?? record.endTime);
    if (end === null) continue;
    const at = dayKey(end);
    items.push(
      ...metric("SLEEP_MINUTES", huaweiField(record.value, "all_sleep_time"), at),
      ...metric("SLEEP_LIGHT_MINUTES", huaweiField(record.value, "light_sleep_time"), at),
      ...metric("SLEEP_DEEP_MINUTES", huaweiField(record.value, "deep_sleep_time"), at),
      ...metric("SLEEP_REM_MINUTES", huaweiField(record.value, "dream_time"), at),
      ...metric("SLEEP_AWAKE_MINUTES", huaweiField(record.value, "awake_time"), at),
      ...metric("SLEEP_SCORE", huaweiField(record.value, "sleep_score"), at)
    );
  }
  return items;
}

export function huaweiActivityItems(records: ActivityRecord[]): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const record of records) {
    const start = huaweiTimeMs(record.startTime);
    const end = huaweiTimeMs(record.endTime);
    if (start === null || end === null || end <= start) continue;
    const calories = (record.activitySummary?.dataSummary ?? [])
      .filter((s) => s.dataTypeName?.includes("calories"))
      .map((s) => huaweiField(s.value, "calories", "calories_total") ?? 0)
      .reduce((sum, value) => sum + value, 0);
    items.push({
      kind: "activity",
      payload: {
        source: "HUAWEI_HEALTH",
        sportType: (record.name ?? "workout").toLowerCase(),
        startedAt: new Date(start).toISOString(),
        durationMinutes: Math.round((end - start) / 60_000),
        caloriesBurned: Math.round(calories),
      },
    });
  }
  return items;
}
