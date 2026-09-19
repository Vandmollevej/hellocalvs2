// Settings → Visning → Forside: which fields appear in the front page's
// number-slider (StatsWheel.tsx), and their "today" values. Mirrors
// src/lib/stat-cards.ts's catalog (the same fields as the statistics page's
// cards) but computes a single day's totals instead of a 30-day average,
// since the front page always shows *today*.

import { useSyncExternalStore } from "react";
import {
  IconApple,
  IconAtom2,
  IconBolt,
  IconBone,
  IconCandy,
  IconDroplet,
  IconEgg,
  IconFlame,
  IconFootsteps,
  IconGauge,
  IconHeartbeat,
  IconLeaf,
  IconLemon2,
  IconRoute,
  IconSalt,
  IconToolsKitchen2,
  type Icon,
} from "@tabler/icons-react";
import { DAILY_KCAL_GOAL, DAILY_PROTEIN_GOAL } from "@/lib/goals";

export type FrontpageStatKey =
  | "calories"
  | "kcalRemaining"
  | "protein"
  | "carbs"
  | "fat"
  | "sugar"
  | "fiber"
  | "salt"
  | "potassium"
  | "calcium"
  | "iron"
  | "saturatedFat"
  | "unsaturatedFat"
  | "transFat"
  | "cholesterol"
  | "vitaminA"
  | "vitaminC"
  | "water"
  | "burned"
  | "steps"
  | "distanceKm";

// Today's summed registration snapshots (see src/lib/daily-totals.ts, whose
// per-day shape this reuses — the front page just never groups by day, it
// only ever wants today's single bucket).
export type FrontpageNutritionTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
  salt: number;
  potassium: number;
  calcium: number;
  iron: number;
  saturatedFat: number;
  unsaturatedFat: number;
  transFat: number;
  cholesterol: number;
  vitaminA: number;
  vitaminC: number;
};

// Today's HealthMetric readings (see src/lib/stat-cards.ts's averageMetric) —
// null when a companion app has never sent that type at all, distinct from 0.
export type FrontpageMetricTotals = {
  steps: number | null;
  waterMl: number | null;
  burnedKcal: number | null;
  distanceKm: number | null;
};

export type FrontpageStatData = {
  totals: FrontpageNutritionTotals;
  metrics: FrontpageMetricTotals;
};

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits }).format(value);
}

export const FRONTPAGE_STAT_DEFS: {
  key: FrontpageStatKey;
  labelKey: string;
  icon: Icon;
  compute: (data: FrontpageStatData) => { value: string; unit: string; goal?: number };
}[] = [
  {
    key: "calories",
    labelKey: "frontPageStats.calories",
    icon: IconFlame,
    compute: (data) => ({ value: formatNumber(data.totals.kcal), unit: "kcal", goal: DAILY_KCAL_GOAL }),
  },
  {
    key: "kcalRemaining",
    // "Kalorier i plus" = hvor mange kcal brugeren stadig har til gode i dag
    // (mål minus indtag, aldrig negativ) — ikke det samme som en overskridelse.
    labelKey: "frontPageStats.kcalRemaining",
    icon: IconGauge,
    compute: (data) => ({ value: formatNumber(Math.max(0, DAILY_KCAL_GOAL - data.totals.kcal)), unit: "kcal" }),
  },
  {
    key: "protein",
    labelKey: "frontPageStats.protein",
    icon: IconEgg,
    compute: (data) => ({ value: formatNumber(data.totals.protein), unit: "g", goal: DAILY_PROTEIN_GOAL }),
  },
  {
    key: "carbs",
    labelKey: "frontPageStats.carbs",
    icon: IconToolsKitchen2,
    compute: (data) => ({ value: formatNumber(data.totals.carbs), unit: "g" }),
  },
  {
    key: "fat",
    labelKey: "frontPageStats.fat",
    icon: IconDroplet,
    compute: (data) => ({ value: formatNumber(data.totals.fat), unit: "g" }),
  },
  {
    key: "sugar",
    labelKey: "frontPageStats.sugar",
    icon: IconCandy,
    compute: (data) => ({ value: formatNumber(data.totals.sugar, 1), unit: "g" }),
  },
  {
    key: "fiber",
    labelKey: "frontPageStats.fiber",
    icon: IconLeaf,
    compute: (data) => ({ value: formatNumber(data.totals.fiber, 1), unit: "g" }),
  },
  {
    key: "salt",
    labelKey: "frontPageStats.salt",
    icon: IconSalt,
    compute: (data) => ({ value: formatNumber(data.totals.salt, 1), unit: "g" }),
  },
  {
    key: "potassium",
    labelKey: "frontPageStats.potassium",
    icon: IconApple,
    compute: (data) => ({ value: formatNumber(data.totals.potassium), unit: "mg" }),
  },
  {
    key: "calcium",
    labelKey: "frontPageStats.calcium",
    icon: IconBone,
    compute: (data) => ({ value: formatNumber(data.totals.calcium), unit: "mg" }),
  },
  {
    key: "iron",
    labelKey: "frontPageStats.iron",
    icon: IconAtom2,
    compute: (data) => ({ value: formatNumber(data.totals.iron, 1), unit: "mg" }),
  },
  {
    key: "saturatedFat",
    labelKey: "frontPageStats.saturatedFat",
    icon: IconDroplet,
    compute: (data) => ({ value: formatNumber(data.totals.saturatedFat, 1), unit: "g" }),
  },
  {
    key: "unsaturatedFat",
    labelKey: "frontPageStats.unsaturatedFat",
    icon: IconDroplet,
    compute: (data) => ({ value: formatNumber(data.totals.unsaturatedFat, 1), unit: "g" }),
  },
  {
    key: "transFat",
    labelKey: "frontPageStats.transFat",
    icon: IconDroplet,
    compute: (data) => ({ value: formatNumber(data.totals.transFat, 2), unit: "g" }),
  },
  {
    key: "cholesterol",
    labelKey: "frontPageStats.cholesterol",
    icon: IconHeartbeat,
    compute: (data) => ({ value: formatNumber(data.totals.cholesterol), unit: "mg" }),
  },
  {
    key: "vitaminA",
    labelKey: "frontPageStats.vitaminA",
    icon: IconApple,
    compute: (data) => ({ value: formatNumber(data.totals.vitaminA), unit: "µg" }),
  },
  {
    key: "vitaminC",
    labelKey: "frontPageStats.vitaminC",
    icon: IconLemon2,
    compute: (data) => ({ value: formatNumber(data.totals.vitaminC), unit: "mg" }),
  },
  {
    key: "water",
    labelKey: "frontPageStats.water",
    icon: IconDroplet,
    // Same "1,6 l" placeholder src/lib/stat-cards.ts has always shown until a
    // HealthKit/Health Connect companion app sends real WATER_ML readings.
    compute: (data) => ({
      value: data.metrics.waterMl !== null ? formatNumber(data.metrics.waterMl / 1000, 1) : "1,6",
      unit: "l",
    }),
  },
  {
    key: "burned",
    labelKey: "frontPageStats.burned",
    icon: IconBolt,
    compute: (data) => ({
      value: data.metrics.burnedKcal !== null ? formatNumber(data.metrics.burnedKcal) : "642",
      unit: "kcal",
    }),
  },
  {
    key: "steps",
    labelKey: "frontPageStats.steps",
    icon: IconFootsteps,
    compute: (data) => ({
      value: data.metrics.steps !== null ? formatNumber(data.metrics.steps) : "6.210",
      unit: "",
    }),
  },
  {
    key: "distanceKm",
    labelKey: "frontPageStats.distanceKm",
    icon: IconRoute,
    // Brand new metric (DISTANCE_KM, see prisma/schema.prisma) — no companion
    // app sends it yet, so unlike steps/water/burned above there is no
    // pre-existing baked-in demo number to preserve; show a plain dash
    // instead of inventing one.
    compute: (data) => ({
      value: data.metrics.distanceKm !== null ? formatNumber(data.metrics.distanceKm, 1) : "–",
      unit: "km",
    }),
  },
];

// The five fields the user explicitly asked to see by default; every other
// FRONTPAGE_STAT_DEFS entry is still offered in the settings toggle list
// ("som udgangspunkt alle de valgmuligheder, som også findes i kortene på
// statistik"), just not active out of the box.
export const DEFAULT_FRONTPAGE_STAT_KEYS: FrontpageStatKey[] = [
  "calories",
  "kcalRemaining",
  "burned",
  "steps",
  "distanceKm",
];

const FRONTPAGE_STATS_STORAGE_KEY = "hellocal.frontpage.statKeys";

function isFrontpageStatKey(value: unknown): value is FrontpageStatKey {
  return typeof value === "string" && FRONTPAGE_STAT_DEFS.some((def) => def.key === value);
}

function parseFrontpageStatKeys(raw: string | null): FrontpageStatKey[] {
  if (!raw) return DEFAULT_FRONTPAGE_STAT_KEYS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_FRONTPAGE_STAT_KEYS;
    const keys = parsed.filter(isFrontpageStatKey);
    return keys.length > 0 ? keys : DEFAULT_FRONTPAGE_STAT_KEYS;
  } catch {
    return DEFAULT_FRONTPAGE_STAT_KEYS;
  }
}

// Same useSyncExternalStore pattern as useWheelActionKeys() in add-actions.ts
// — StatsWheel is part of the statically prerendered front page.
let cachedRaw: string | null | undefined;
let cachedKeys: FrontpageStatKey[] = DEFAULT_FRONTPAGE_STAT_KEYS;

function getSnapshot(): FrontpageStatKey[] {
  if (typeof window === "undefined") return DEFAULT_FRONTPAGE_STAT_KEYS;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(FRONTPAGE_STATS_STORAGE_KEY);
  } catch {
    return DEFAULT_FRONTPAGE_STAT_KEYS;
  }
  if (raw === cachedRaw) return cachedKeys;
  cachedRaw = raw;
  cachedKeys = parseFrontpageStatKeys(raw);
  return cachedKeys;
}

function getServerSnapshot(): FrontpageStatKey[] {
  return DEFAULT_FRONTPAGE_STAT_KEYS;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === FRONTPAGE_STATS_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Persists the number-slider's active fields and notifies every mounted `useFrontpageStatKeys()`. */
export function saveFrontpageStatKeys(keys: FrontpageStatKey[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FRONTPAGE_STATS_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // localStorage unavailable — ignore, same as add-actions.ts.
  }
  cachedRaw = undefined;
  listeners.forEach((listener) => listener());
}

/** The number-slider's active fields (settings → Visning → Forside), reactive and SSR-safe. */
export function useFrontpageStatKeys(): FrontpageStatKey[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
