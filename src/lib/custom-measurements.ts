// "Tilføj egen måling" (Indstillinger → Visning → Forside): brugeren bygger sit
// eget tal til tal-hjulet på forsiden ud fra navn, parameter, periode og en kort
// tekst. Måling gemmes pr. enhed i localStorage (som resten af forsidens
// visning) og vises i StatsWheel.tsx.

import { useSyncExternalStore } from "react";
import { NUTRIENTS } from "@/lib/nutrients";
import { periodRange } from "@/lib/stat-periods";
import { clampMeasureText } from "@/lib/custom-measure-text";

export type MeasureGroup = "food" | "activity" | "sleep" | "heart" | "body";

// food = sum af registreringer, sum = sum af HealthMetric-rækker, avg = gennemsnit,
// latest = seneste måling, remaining = dagsmål minus indtag.
type MeasureKind = "food" | "sum" | "avg" | "latest" | "remaining";

export type MeasureParamDef = {
  key: string;
  labelKey: string;
  group: MeasureGroup;
  kind: MeasureKind;
  /** food: felt i DailyTotal/nutrients, ellers HealthMetricType. */
  source?: string;
  unit: string;
  digits: number;
  /** Værdien divideres før visning (fx ml → l, minutter → timer). */
  divisor?: number;
};

const p = (
  key: string,
  group: MeasureGroup,
  kind: MeasureKind,
  source: string | undefined,
  unit: string,
  digits = 0,
  divisor?: number,
): MeasureParamDef => ({ key, labelKey: `customMeasure.param.${key}`, group, kind, source, unit, digits, divisor });

const NUTRIENT_PARAMS: MeasureParamDef[] = NUTRIENTS.map((n) => ({
  key: `nutrient:${n.key}`,
  labelKey: `addProduct.nutrient.${n.key}`,
  group: "food" as const,
  kind: "food" as const,
  source: n.key,
  unit: n.unit,
  digits: n.digits,
}));

export const MEASURE_PARAMS: MeasureParamDef[] = [
  p("kcalIntake", "food", "food", "kcal", "kcal"),
  p("kcalRemaining", "food", "remaining", undefined, "kcal"),
  p("protein", "food", "food", "protein", "g"),
  p("carbs", "food", "food", "carbs", "g"),
  p("fat", "food", "food", "fat", "g"),
  ...NUTRIENT_PARAMS.filter((n) => !["protein", "carbs", "fat"].includes(n.source ?? "")),
  p("kcalBurned", "activity", "sum", "ACTIVE_ENERGY_KCAL", "kcal"),
  p("restingEnergy", "activity", "sum", "RESTING_ENERGY_KCAL", "kcal"),
  p("steps", "activity", "sum", "STEPS", ""),
  p("distance", "activity", "sum", "DISTANCE_KM", "km", 1),
  p("water", "activity", "sum", "WATER_ML", "l", 1, 1000),
  p("exerciseMinutes", "activity", "sum", "EXERCISE_MINUTES", "min"),
  p("standMinutes", "activity", "sum", "STAND_MINUTES", "min"),
  p("floors", "activity", "sum", "FLOORS_CLIMBED", ""),
  p("zoneMinutes", "activity", "sum", "ACTIVE_ZONE_MINUTES", "min"),
  p("cardioLoad", "activity", "sum", "CARDIO_LOAD", "", 1),
  p("sleepDuration", "sleep", "sum", "SLEEP_MINUTES", "t", 1, 60),
  p("sleepInBed", "sleep", "sum", "SLEEP_IN_BED_MINUTES", "t", 1, 60),
  p("sleepAwake", "sleep", "sum", "SLEEP_AWAKE_MINUTES", "min"),
  p("sleepRem", "sleep", "sum", "SLEEP_REM_MINUTES", "min"),
  p("sleepLight", "sleep", "sum", "SLEEP_LIGHT_MINUTES", "min"),
  p("sleepDeep", "sleep", "sum", "SLEEP_DEEP_MINUTES", "min"),
  p("sleepScore", "sleep", "avg", "SLEEP_SCORE", ""),
  p("sleepEfficiency", "sleep", "avg", "SLEEP_EFFICIENCY_PERCENT", "%", 1),
  p("sleepAwakenings", "sleep", "avg", "SLEEP_AWAKENINGS", ""),
  p("heartRate", "heart", "avg", "HEART_RATE_BPM", "bpm"),
  p("restingHeartRate", "heart", "avg", "RESTING_HEART_RATE_BPM", "bpm"),
  p("heartRateMin", "heart", "avg", "HEART_RATE_MIN_BPM", "bpm"),
  p("heartRateMax", "heart", "avg", "HEART_RATE_MAX_BPM", "bpm"),
  p("hrv", "heart", "avg", "HEART_RATE_VARIABILITY_MS", "ms", 1),
  p("vo2Max", "heart", "avg", "VO2_MAX", "", 1),
  p("heartRateRecovery", "heart", "avg", "HEART_RATE_RECOVERY_BPM", "bpm"),
  p("respiratoryRate", "heart", "avg", "RESPIRATORY_RATE_BPM", "/min", 1),
  p("spo2", "heart", "avg", "OXYGEN_SATURATION_PERCENT", "%", 1),
  p("temperature", "heart", "avg", "TEMPERATURE_C", "°C", 1),
  p("stress", "heart", "avg", "STRESS_SCORE", ""),
  p("recoveryScore", "heart", "avg", "RECOVERY_SCORE", "%"),
  p("strain", "heart", "avg", "STRAIN_SCORE", "", 1),
  p("bloodGlucose", "heart", "avg", "BLOOD_GLUCOSE_MMOL_L", "mmol/l", 1),
  p("bodyFat", "body", "latest", "BODY_FAT_PERCENT", "%", 1),
  p("fatMass", "body", "latest", "FAT_MASS_KG", "kg", 1),
  p("fatFreeMass", "body", "latest", "FAT_FREE_MASS_KG", "kg", 1),
  p("muscleMass", "body", "latest", "MUSCLE_MASS_KG", "kg", 1),
  p("boneMass", "body", "latest", "BONE_MASS_KG", "kg", 1),
  p("bodyWater", "body", "latest", "BODY_WATER_PERCENT", "%", 1),
  p("visceralFat", "body", "latest", "VISCERAL_FAT_INDEX", "", 1),
  p("bmr", "body", "latest", "BASAL_METABOLIC_RATE_KCAL", "kcal"),
  p("bmi", "body", "latest", "BMI", "", 1),
];

export const MEASURE_PARAM_BY_KEY: Record<string, MeasureParamDef> = Object.fromEntries(
  MEASURE_PARAMS.map((def) => [def.key, def]),
);

export type MeasurePeriodKey =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear";

export const MEASURE_PERIOD_KEYS: MeasurePeriodKey[] = [
  "today",
  "yesterday",
  "last7",
  "last30",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "thisYear",
  "lastYear",
];

export function measurePeriodRange(key: MeasurePeriodKey, now: Date = new Date()): { start: Date; end: Date } {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === "yesterday") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 1);
    return { start, end: startOfToday };
  }
  if (key === "last30") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 29);
    const end = new Date(startOfToday);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  return periodRange(key, now);
}

export type CustomMeasurement = {
  id: string;
  name: string;
  description: string;
  param: string;
  period: MeasurePeriodKey;
  /** Den grå tekst under tallet: højst 2 linjer á 15 tegn. */
  text: string;
};

export type MeasureDay = {
  dateKey: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  nutrients: Record<string, number>;
};

export type MeasureMetric = { type: string; value: number; recordedAt: string };

export type MeasureInput = {
  days: MeasureDay[];
  metrics: MeasureMetric[];
  goalKcal: number;
  now?: Date;
};

function dayStart(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m, d).getTime();
}

function formatNumber(value: number, digits: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: digits }).format(value);
}

/** Beregner en målings værdi som tekst ("—" uden data). Flerdages-perioder giver dagsgennemsnit. */
export function computeMeasurement(measurement: CustomMeasurement, input: MeasureInput): { value: string; unit: string } {
  const def = MEASURE_PARAM_BY_KEY[measurement.param];
  if (!def) return { value: "—", unit: "" };
  const now = input.now ?? new Date();
  const { start, end } = measurePeriodRange(measurement.period, now);
  const last = Math.min(end.getTime(), now.getTime() + 86400000);
  // Dage i perioden, der er begyndt (aktuelle perioder er ikke slut endnu).
  const elapsedDays = Math.max(1, Math.round((last - start.getTime()) / 86400000));
  const days = input.days.filter((d) => dayStart(d.dateKey) >= start.getTime() && dayStart(d.dateKey) < end.getTime());
  const divisor = def.divisor ?? 1;
  const out = (raw: number | null) => ({
    value: raw === null ? "—" : formatNumber(raw / divisor, def.digits),
    unit: raw === null ? "" : def.unit,
  });

  if (def.kind === "food" || def.kind === "remaining") {
    const intake = days.reduce((sum, d) => {
      if (def.kind === "remaining" || def.source === "kcal") return sum + d.kcal;
      if (def.source === "protein" || def.source === "carbs" || def.source === "fat") return sum + d[def.source];
      return sum + (d.nutrients[def.source ?? ""] ?? 0);
    }, 0);
    const total = def.kind === "remaining" ? Math.max(0, input.goalKcal * elapsedDays - intake) : intake;
    return out(total / elapsedDays);
  }

  const rows = input.metrics.filter((m) => {
    const time = new Date(m.recordedAt).getTime();
    return m.type === def.source && time >= start.getTime() && time < end.getTime();
  });
  if (rows.length === 0) return out(null);
  if (def.kind === "sum") return out(rows.reduce((sum, m) => sum + m.value, 0) / elapsedDays);
  if (def.kind === "avg") return out(rows.reduce((sum, m) => sum + m.value, 0) / rows.length);
  return out(rows.reduce((a, b) => (b.recordedAt > a.recordedAt ? b : a)).value);
}

export function newMeasurementId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Nøglen i tal-hjulets liste (blandes med FrontpageStatKey). */
export const CUSTOM_STAT_KEY_PREFIX = "custom:";

const STORAGE_KEY = "hellocal.frontpage.customMeasurements";
const EMPTY: CustomMeasurement[] = [];

function isMeasurement(value: unknown): value is CustomMeasurement {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.name === "string" &&
    typeof m.description === "string" &&
    typeof m.text === "string" &&
    typeof m.param === "string" &&
    m.param in MEASURE_PARAM_BY_KEY &&
    typeof m.period === "string" &&
    MEASURE_PERIOD_KEYS.includes(m.period as MeasurePeriodKey)
  );
}

function parse(raw: string | null): CustomMeasurement[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter(isMeasurement).map((m) => ({ ...m, text: clampMeasureText(m.text) }));
  } catch {
    return EMPTY;
  }
}

let cachedRaw: string | null | undefined;
let cached: CustomMeasurement[] = EMPTY;

function getSnapshot(): CustomMeasurement[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  cached = parse(raw);
  return cached;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveCustomMeasurements(measurements: CustomMeasurement[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(measurements));
  } catch {
    // localStorage utilgængelig — ignorer, som i frontpage-stats.ts.
  }
  cachedRaw = undefined;
  listeners.forEach((listener) => listener());
}

/** Brugerens egne målinger (Indstillinger → Visning → Forside), reaktiv og SSR-sikker. */
export function useCustomMeasurements(): CustomMeasurement[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
