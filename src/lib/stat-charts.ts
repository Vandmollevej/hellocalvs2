// Graferne øverst på statistiksiden: hvilke grafer der findes, hvilke der er
// aktive, og deres rækkefølge. Delt af StatChartsSection og
// /statistics/unused-charts, så begge læser/skriver samme localStorage-nøgle.
//
// Ingen nye datatyper opfindes her: dagsgraferne plotter felter, der allerede
// findes i DailyTotal (src/lib/daily-totals.ts), med samme navne og enheder
// som de tilsvarende statistik-kort (STAT_CARD_DEFS i src/lib/stat-cards.ts).

import type { DailyTotal } from "@/lib/daily-totals";
import { STAT_CARD_DEFS } from "@/lib/stat-cards";
import type { SleepInsightKind } from "@/components/SleepInsightChart";
import { NUTRIENTS, type NutrientKey } from "@/lib/nutrients";

// Kun talfelter (ikke dateKey eller næringsstof-maps som nutrients).
export type DailyChartField = Exclude<
  { [K in keyof DailyTotal]: DailyTotal[K] extends number ? K : never }[keyof DailyTotal],
  "kcal"
>;

export type StatChartDef =
  | { key: "caloriesAndWeight"; kind: "caloriesAndWeight" }
  | { key: "intradayKcal"; kind: "intradayKcal" }
  // Oplevelse af søvn (docs/DECISIONS.md 2026-09-26): søvnkvalitet 1–5 mod kalorier.
  | { key: "sleepQuality"; kind: "sleepQuality" }
  // Søvnstatistikkens grafer (/statistics/sleep), som tilvalg her.
  | { key: `sleep:${SleepInsightKind}`; kind: "sleepInsight"; insight: SleepInsightKind }
  | { key: `daily:${DailyChartField}`; kind: "daily"; field: DailyChartField; unit: string }
  // Én graf pr. gruppe (mineraler / vitaminer); brugeren krydser selv af i
  // grafens dropdown, hvilke næringsstoffer der vises (2026-10-02).
  | { key: NutrientGroupChartKey; kind: "nutrientGroup"; group: NutrientGroup };

export type NutrientGroup = "mineral" | "vitamin";
export type NutrientGroupChartKey = "minerals" | "vitamins";

/** Næringsstofferne i en gruppe, i katalogets rækkefølge (src/lib/nutrients.ts). */
export function nutrientGroupMembers(group: NutrientGroup): { key: NutrientKey; unit: string }[] {
  return NUTRIENTS.filter((n) => n.group === group).map((n) => ({ key: n.key, unit: n.unit }));
}

/** Hvilke linjer der er slået til, før brugeren selv har valgt. */
export const NUTRIENT_GROUP_DEFAULT_SERIES: Record<NutrientGroup, NutrientKey[]> = {
  mineral: ["calcium", "iron", "potassium"],
  vitamin: ["vitaminA", "vitaminC", "vitaminD"],
};

// Ældre gemte layouts havde én graf pr. mineral/vitamin; de samles nu i
// gruppegraferne.
const LEGACY_CHART_KEYS: Record<string, NutrientGroupChartKey> = {
  "daily:potassium": "minerals",
  "daily:calcium": "minerals",
  "daily:iron": "minerals",
  "daily:vitaminA": "vitamins",
  "daily:vitaminC": "vitamins",
};

function daily(field: DailyChartField, unit: string): StatChartDef {
  return { key: `daily:${field}`, kind: "daily", field, unit };
}

export const STAT_CHART_DEFS: StatChartDef[] = [
  { key: "caloriesAndWeight", kind: "caloriesAndWeight" },
  { key: "intradayKcal", kind: "intradayKcal" },
  { key: "sleepQuality", kind: "sleepQuality" },
  ...(["quality", "kcal", "coffee", "sport", "device", "bodyFat"] as const).map(
    (insight): StatChartDef => ({ key: `sleep:${insight}`, kind: "sleepInsight", insight }),
  ),
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
  { key: "minerals", kind: "nutrientGroup", group: "mineral" },
  { key: "vitamins", kind: "nutrientGroup", group: "vitamin" },
];

export const DEFAULT_ACTIVE_CHART_KEYS: string[] = ["caloriesAndWeight", "intradayKcal", "sleepQuality"];

const chartDefByKey = new Map<string, StatChartDef>(STAT_CHART_DEFS.map((def) => [def.key, def]));

export function statChartDef(key: string): StatChartDef | undefined {
  return chartDefByKey.get(key);
}

/** Dagsgrafens navn = det tilsvarende statistik-korts navn. */
export function dailyChartLabel(field: string): string {
  return STAT_CARD_DEFS.find((def) => def.key === field)?.label ?? field;
}

/** Grafens navn — det samme på statistiksiden og på "Tilføj til statistik". */
export function statChartLabel(def: StatChartDef, t: (key: string) => string): string {
  if (def.kind === "caloriesAndWeight") return t("statistics.caloriesAndWeightChart");
  if (def.kind === "sleepQuality") return t("statistics.sleepQualityChart");
  if (def.kind === "intradayKcal") return t("statUnusedCharts.intradayKcal");
  if (def.kind === "sleepInsight") return t(`sleepStats.chart.${def.insight}`);
  if (def.kind === "nutrientGroup") {
    return t(def.group === "mineral" ? "statUnusedCards.category.minerals" : "statUnusedCards.category.vitamins");
  }
  return dailyChartLabel(def.field);
}

export const STAT_CHART_LAYOUT_STORAGE_KEY = "hellocal.statistik.charts";

function sanitize(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [...DEFAULT_ACTIVE_CHART_KEYS];
  const seen = new Set<string>();
  return keys
    .map((key) => (typeof key === "string" ? (LEGACY_CHART_KEYS[key] ?? key) : key))
    .filter((key): key is string => {
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
