// Graferne øverst på statistiksiden: hvilke grafer der findes, hvilke der er
// aktive, og deres rækkefølge. Delt af StatChartsSection og
// /statistics/unused-charts, så begge læser/skriver samme localStorage-nøgle.
//
// Ingen nye datatyper opfindes her: dagsgraferne plotter felter, der allerede
// findes i DailyTotal (src/lib/daily-totals.ts), med samme navne og enheder
// som de tilsvarende statistik-kort (STAT_CARD_DEFS i src/lib/stat-cards.ts).

import type { DailyTotal } from "@/lib/daily-totals";
import { STAT_CARD_DEFS } from "@/lib/stat-cards";

export type DailyChartField = Exclude<keyof DailyTotal, "dateKey" | "kcal">;

export type StatChartDef =
  | { key: "caloriesAndWeight"; kind: "caloriesAndWeight" }
  | { key: "intradayKcal"; kind: "intradayKcal" }
  | { key: `daily:${DailyChartField}`; kind: "daily"; field: DailyChartField; unit: string };

function daily(field: DailyChartField, unit: string): StatChartDef {
  return { key: `daily:${field}`, kind: "daily", field, unit };
}

export const STAT_CHART_DEFS: StatChartDef[] = [
  { key: "caloriesAndWeight", kind: "caloriesAndWeight" },
  { key: "intradayKcal", kind: "intradayKcal" },
  daily("protein", "g"),
  daily("carbs", "g"),
  daily("fat", "g"),
  daily("saturatedFat", "g"),
  daily("unsaturatedFat", "g"),
  daily("transFat", "g"),
  daily("cholesterol", "mg"),
  daily("salt", "g"),
  daily("sugar", "g"),
  daily("fiber", "g"),
  daily("potassium", "mg"),
  daily("calcium", "mg"),
  daily("iron", "mg"),
  daily("vitaminA", "µg"),
  daily("vitaminC", "mg"),
];

export const DEFAULT_ACTIVE_CHART_KEYS: string[] = ["caloriesAndWeight", "intradayKcal"];

const chartDefByKey = new Map<string, StatChartDef>(STAT_CHART_DEFS.map((def) => [def.key, def]));

export function statChartDef(key: string): StatChartDef | undefined {
  return chartDefByKey.get(key);
}

/** Dagsgrafens navn = det tilsvarende statistik-korts navn. */
export function dailyChartLabel(field: DailyChartField): string {
  return STAT_CARD_DEFS.find((def) => def.key === field)?.label ?? field;
}

export const STAT_CHART_LAYOUT_STORAGE_KEY = "hellocal.statistik.charts";

function sanitize(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [...DEFAULT_ACTIVE_CHART_KEYS];
  const seen = new Set<string>();
  return keys.filter((key): key is string => {
    if (typeof key !== "string" || !chartDefByKey.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function loadChartLayout(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_ACTIVE_CHART_KEYS];
  try {
    const raw = window.localStorage.getItem(STAT_CHART_LAYOUT_STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : [...DEFAULT_ACTIVE_CHART_KEYS];
  } catch {
    return [...DEFAULT_ACTIVE_CHART_KEYS];
  }
}

export function saveChartLayout(keys: string[]) {
  try {
    window.localStorage.setItem(STAT_CHART_LAYOUT_STORAGE_KEY, JSON.stringify(sanitize(keys)));
  } catch {
    // localStorage unavailable — ignore.
  }
}

/** Tilføjer grafer nederst i graf-sektionen (dem, der allerede er aktive, springes over). */
export function addChartsToLayout(keys: string[]): string[] {
  const current = loadChartLayout();
  const next = [...current, ...keys.filter((key) => !current.includes(key))];
  saveChartLayout(next);
  return next;
}
