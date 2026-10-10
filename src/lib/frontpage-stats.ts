// Settings → Visning → Forside: which fields appear in the front page's
// number-slider (StatsWheel.tsx), and their "today" values. Mirrors
// src/lib/stat-cards.ts's catalog (the same fields as the statistics page's
// cards) but computes a single day's totals instead of a 30-day average,
// since the front page always shows *today*.

import { useSyncExternalStore } from "react";
import {
  IconApple,
  IconAtom2,
  IconBone,
  IconBread,
  IconCandy,
  IconClock,
  IconActivity,
  IconMoon,
  IconRun,
  IconStairsUp,
  IconDroplet,
  IconEgg,
  IconFlame,
  IconFootsteps,
  IconHeartbeat,
  IconLeaf,
  IconLemon2,
  IconRoute,
  IconScale,
  IconTarget,
  IconSalt,
  IconToolsKitchen2,
  type Icon,
} from "@tabler/icons-react";
import { IconDrumstick } from "@/components/icons/Drumstick";
import { IconWaterGlass } from "@/components/icons/WaterGlass";
import { DAILY_PROTEIN_GOAL } from "@/lib/goals";
import {
  DEFAULT_ENERGY_SPLIT,
  DEFAULT_FLOORS_GOAL,
  DEFAULT_STEPS_GOAL,
  KCAL_PER_STEP,
  energySplitPercent,
  macroGoalsFor,
  type MacroGoals,
  type WeightOutlook,
} from "@/lib/frontpage-goal-math";

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
  | "distanceKm"
  | "floors"
  | "earnedKcal"
  | "energySplit"
  | "activityKcal"
  | "stepKcal"
  | "intakeVsTypical"
  | "restingTime"
  | "zoneTime"
  | "weightOnGoalDay"
  | "goalChance";

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
  floors: number | null;
  restingMinutes: number | null;
  restingBpm: number | null;
};

/** Data ud over dagens summer, hentet af StatsWheel til de nyere felter. */
export type FrontpageExtraData = {
  /** Dagens registrerede sport (Activity), seneste først. */
  activities: { sportType: string; kcal: number }[];
  intakeComparison: { today: number; typical: number | null; percent: number | null };
  /** Minutter i den valgte pulszone i dag — null uden pulsmålinger. */
  zoneMinutes: number | null;
  /** 1–5. */
  zoneNumber: number;
  /** Egne mål (Målsætning → ernæring), hvis sat. */
  ownGoals: { proteinG?: number; fatG?: number; carbsG?: number };
  weightOutlook: WeightOutlook | null;
  weightGoalKg: number | null;
};

export type FrontpageStatData = {
  totals: FrontpageNutritionTotals;
  metrics: FrontpageMetricTotals;
  /** Dagens kaloriemål (DailyBudgetSnapshot, ellers DAILY_KCAL_GOAL). */
  goalKcal: number;
  extra: FrontpageExtraData;
};

export type FrontpageStatResult = {
  value: string;
  unit: string;
  /** Mål-linjen under tallet (erstatter pladsholderteksten). */
  caption?: string;
  /** Målet er nået → hovedtallet bliver grønt. */
  reached?: boolean;
  /** Ikoner til højre for tallet i stedet for def.icon (fx flamme + skridt). */
  icons?: Icon[];
};

type Translate = (key: string, params?: Record<string, string | number>) => string;

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits }).format(value);
}

function macroGoals(data: FrontpageStatData): MacroGoals {
  return macroGoalsFor(data.goalKcal, data.extra.ownGoals, DAILY_PROTEIN_GOAL);
}

/** "Mål: 120 g" under et tal, hvor målet er et minimum (grønt når nået). */
function minGoal(t: Translate, value: number, unit: string, digits = 0) {
  return t("frontPageStats.goalMin", { value: `${formatNumber(value, digits)}${unit ? ` ${unit}` : ""}` });
}

/** "Mål: højst 6 g" under et tal, hvor målet er en grænse. */
function maxGoal(t: Translate, value: number, unit: string, digits = 0) {
  return t("frontPageStats.goalMax", { value: `${formatNumber(value, digits)}${unit ? ` ${unit}` : ""}` });
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return hours > 0 ? `${hours} t ${rest} min` : `${rest} min`;
}

function signed(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatNumber(Math.abs(value))}`;
}

export const FRONTPAGE_STAT_DEFS: {
  key: FrontpageStatKey;
  labelKey: string;
  icon: Icon;
  compute: (data: FrontpageStatData, t: Translate) => FrontpageStatResult;
}[] = [
  {
    key: "calories",
    labelKey: "frontPageStats.calories",
    // Kniv og gaffel = kalorieindtag (brugerens ønske 2026-10-09; erstatter kyllingelåret).
    icon: IconToolsKitchen2,
    compute: (data, t) => ({
      value: formatNumber(data.totals.kcal),
      unit: "kcal",
      caption: maxGoal(t, data.goalKcal, "kcal"),
    }),
  },
  {
    key: "kcalRemaining",
    // "Kalorier i plus" = hvor mange kcal brugeren stadig har til gode i dag
    // (mål minus indtag, aldrig negativ) — ikke det samme som en overskridelse.
    labelKey: "frontPageStats.kcalRemaining",
    icon: IconDrumstick,
    compute: (data, t) => ({
      value: formatNumber(Math.max(0, data.goalKcal - data.totals.kcal)),
      unit: "kcal",
      caption: t("frontPageStats.kcalRemainingCaption"),
    }),
  },
  {
    key: "protein",
    labelKey: "frontPageStats.protein",
    icon: IconEgg,
    compute: (data, t) => {
      const goal = macroGoals(data).proteinG;
      return {
        value: formatNumber(data.totals.protein),
        unit: "g",
        caption: minGoal(t, goal, "g"),
        reached: data.totals.protein >= goal,
      };
    },
  },
  {
    key: "carbs",
    labelKey: "frontPageStats.carbs",
    icon: IconBread,
    compute: (data, t) => ({
      value: formatNumber(data.totals.carbs),
      unit: "g",
      caption: maxGoal(t, macroGoals(data).carbsG, "g"),
    }),
  },
  {
    key: "fat",
    labelKey: "frontPageStats.fat",
    icon: IconDroplet,
    compute: (data, t) => ({
      value: formatNumber(data.totals.fat),
      unit: "g",
      caption: maxGoal(t, macroGoals(data).fatG, "g"),
    }),
  },
  {
    key: "sugar",
    labelKey: "frontPageStats.sugar",
    icon: IconCandy,
    compute: (data, t) => ({
      value: formatNumber(data.totals.sugar, 1),
      unit: "g",
      caption: maxGoal(t, macroGoals(data).sugarG, "g"),
    }),
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
    compute: (data, t) => ({
      value: formatNumber(data.totals.salt, 1),
      unit: "g",
      caption: maxGoal(t, macroGoals(data).saltG, "g"),
    }),
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
    icon: IconWaterGlass,
    // Same "1,6 l" placeholder src/lib/stat-cards.ts has always shown until a
    // HealthKit/Health Connect companion app sends real WATER_ML readings.
    compute: (data) => ({
      value: data.metrics.waterMl !== null ? formatNumber(data.metrics.waterMl / 1000, 1) : "–",
      unit: "l",
    }),
  },
  {
    key: "burned",
    labelKey: "frontPageStats.burned",
    // Flamme = forbrændte kalorier (design.md §6.16).
    icon: IconFlame,
    compute: (data, t) => ({
      value: data.metrics.burnedKcal !== null ? formatNumber(data.metrics.burnedKcal) : "–",
      unit: "kcal",
      caption: t("frontPageStats.burnedCaption"),
    }),
  },
  {
    key: "steps",
    labelKey: "frontPageStats.steps",
    icon: IconFootsteps,
    compute: (data, t) => ({
      value: data.metrics.steps !== null ? formatNumber(data.metrics.steps) : "–",
      unit: "",
      caption: minGoal(t, DEFAULT_STEPS_GOAL, ""),
      reached: (data.metrics.steps ?? 0) >= DEFAULT_STEPS_GOAL,
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
    compute: (data, t) => ({
      value: data.metrics.distanceKm !== null ? formatNumber(data.metrics.distanceKm, 1) : "–",
      unit: "km",
      caption: t("frontPageStats.distanceCaption"),
    }),
  },
  {
    key: "floors",
    labelKey: "frontPageStats.floors",
    icon: IconStairsUp,
    compute: (data, t) => ({
      value: data.metrics.floors !== null ? formatNumber(data.metrics.floors) : "–",
      unit: "",
      caption: minGoal(t, DEFAULT_FLOORS_GOAL, ""),
      reached: (data.metrics.floors ?? 0) >= DEFAULT_FLOORS_GOAL,
    }),
  },
  {
    key: "earnedKcal",
    // Alt der er forbrændt ud over standardforbruget ("Optjent").
    labelKey: "frontPageStats.earnedKcal",
    icon: IconFlame,
    compute: (data, t) => {
      const sport = data.extra.activities.reduce((sum, a) => sum + a.kcal, 0);
      const earned = data.metrics.burnedKcal ?? (sport > 0 ? sport : null);
      return {
        value: earned !== null ? `+${formatNumber(earned)}` : "–",
        unit: "kcal",
        caption: t("frontPageStats.earnedCaption"),
      };
    },
  },
  {
    key: "energySplit",
    labelKey: "frontPageStats.energySplit",
    icon: IconAtom2,
    compute: (data, t) => {
      const split = energySplitPercent(data.totals.protein, data.totals.fat, data.totals.carbs);
      const goal = DEFAULT_ENERGY_SPLIT;
      return {
        value: split ? `P ${split.protein} F ${split.fat} K ${split.carbs}` : "–",
        unit: "%",
        caption: t("frontPageStats.energySplitCaption", { p: goal.protein, f: goal.fat, k: goal.carbs }),
      };
    },
  },
  {
    key: "activityKcal",
    labelKey: "frontPageStats.activityKcal",
    icon: IconActivity,
    compute: (data, t) => {
      const total = data.extra.activities.reduce((sum, a) => sum + a.kcal, 0);
      const running = data.extra.activities.some((a) => /run|løb|jog/i.test(a.sportType));
      return {
        value: data.extra.activities.length > 0 ? formatNumber(total) : "–",
        unit: "kcal",
        caption: data.extra.activities[0]?.sportType ?? t("frontPageStats.activityNone"),
        icons: [running ? IconRun : IconActivity],
      };
    },
  },
  {
    key: "stepKcal",
    labelKey: "frontPageStats.stepKcal",
    icon: IconFlame,
    compute: (data, t) => ({
      value: data.metrics.steps !== null ? formatNumber(data.metrics.steps * KCAL_PER_STEP) : "–",
      unit: "kcal",
      caption: t("frontPageStats.stepKcalCaption"),
      icons: [IconFlame, IconFootsteps],
    }),
  },
  {
    key: "intakeVsTypical",
    labelKey: "frontPageStats.intakeVsTypical",
    icon: IconClock,
    compute: (data, t) => {
      const { today, percent } = data.extra.intakeComparison;
      return {
        value: formatNumber(today),
        unit: "kcal",
        caption:
          percent === null
            ? t("frontPageStats.intakeNoBasis")
            : t("frontPageStats.intakeVsTypicalCaption", { percent: signed(percent) }),
      };
    },
  },
  {
    key: "restingTime",
    labelKey: "frontPageStats.restingTime",
    icon: IconMoon,
    compute: (data, t) => ({
      value: data.metrics.restingMinutes !== null ? formatDuration(data.metrics.restingMinutes) : "–",
      unit: "",
      caption:
        data.metrics.restingBpm !== null
          ? t("frontPageStats.restingBpm", { bpm: formatNumber(data.metrics.restingBpm) })
          : t("frontPageStats.restingBpmNone"),
    }),
  },
  {
    key: "zoneTime",
    labelKey: "frontPageStats.zoneTime",
    icon: IconHeartbeat,
    compute: (data, t) => ({
      value: data.extra.zoneMinutes !== null ? formatDuration(data.extra.zoneMinutes) : "–",
      unit: "",
      caption: t("frontPageStats.zoneCaption", { zone: data.extra.zoneNumber }),
    }),
  },
  {
    key: "weightOnGoalDay",
    labelKey: "frontPageStats.weightOnGoalDay",
    icon: IconScale,
    compute: (data, t) => {
      const outlook = data.extra.weightOutlook;
      if (!outlook || data.extra.weightGoalKg === null) {
        return { value: "–", unit: "kg", caption: t("frontPageStats.noWeightGoal") };
      }
      return {
        value: formatNumber(outlook.predictedKg, 1),
        unit: "kg",
        caption: t("frontPageStats.weightGoalCaption", {
          goal: formatNumber(data.extra.weightGoalKg, 1),
          verdict: t(`frontPageStats.verdict.${outlook.verdict}`),
        }),
        reached: outlook.verdict === "likely",
      };
    },
  },
  {
    key: "goalChance",
    labelKey: "frontPageStats.goalChance",
    icon: IconTarget,
    compute: (data, t) => {
      const outlook = data.extra.weightOutlook;
      if (!outlook) return { value: "–", unit: "", caption: t("frontPageStats.noWeightGoal") };
      return {
        value: formatNumber(outlook.chancePercent),
        unit: "%",
        caption: t("frontPageStats.goalChanceCaption", {
          max: formatNumber(outlook.recommendedKgPerWeek, 2),
        }),
        reached: outlook.chancePercent >= 60,
      };
    },
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
