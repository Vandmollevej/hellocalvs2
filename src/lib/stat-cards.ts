// Defines the stat cards the user can assemble on the Statistics page.
// The cards' order/active set is stored by StatCardsGrid (localStorage), not here.

import {
  IconBolt,
  IconDroplet,
  IconEgg,
  IconFlame,
  IconTargetArrow,
  IconToolsKitchen2,
  IconWalk,
  type Icon,
} from "@tabler/icons-react";
import { DAILY_KCAL_GOAL } from "@/lib/goals";
import type { DailyTotal } from "@/lib/daily-totals";
import { getSportMeta } from "@/lib/sport-icons";

export const STAT_WINDOW_DAYS = 30;

export type StatCardValue = {
  key: string;
  label: string;
  icon: Icon;
  value: string;
};

export type ActivityTotals = {
  sportType: string;
  durationMinutes: number;
  caloriesBurned: number;
  startedAt: string;
};

// Loosely coupled to HealthMetricType (Prisma) — `type` is a free string here so
// this shared lib doesn't get a hard dependency on @prisma/client.
export type HealthMetricTotals = {
  type: string;
  value: number;
  recordedAt: string;
};

export type StatCardData = {
  days: DailyTotal[];
  // Only set when at least one real integration (Fitbit/Withings) is CONNECTED,
  // per docs/DECISIONS.md — see where computeStatCards() is called from.
  activities?: ActivityTotals[];
  // From a future HealthKit/Health Connect companion app (see
  // docs/HEALTHKIT_COMPANION.md) — empty/undefined until data exists.
  metrics?: HealthMetricTotals[];
};

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits }).format(value);
}

function average(days: DailyTotal[], pick: (d: DailyTotal) => number) {
  if (days.length === 0) return 0;
  return days.reduce((sum, d) => sum + pick(d), 0) / days.length;
}

/** Gennemsnit af én HealthMetricType's værdier (typisk én række pr. dag fra
 * companion-appen) — null hvis der slet ingen data findes for typen endnu. */
function averageMetric(metrics: HealthMetricTotals[] | undefined, type: string): number | null {
  const matching = (metrics ?? []).filter((m) => m.type === type);
  if (matching.length === 0) return null;
  return matching.reduce((sum, m) => sum + m.value, 0) / matching.length;
}

export const STAT_CARD_DEFS: {
  key: string;
  label: string;
  icon: Icon;
  compute: (data: StatCardData) => string;
}[] = [
  {
    key: "calories",
    label: "Kalorier",
    icon: IconFlame,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.kcal))} kcal`,
  },
  {
    key: "protein",
    label: "Protein",
    icon: IconEgg,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.protein))} g`,
  },
  {
    key: "carbs",
    label: "Kulhydrat",
    icon: IconToolsKitchen2,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.carbs))} g`,
  },
  {
    key: "fat",
    label: "Fedt",
    icon: IconDroplet,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.fat))} g`,
  },
  {
    key: "daysLogged",
    label: "Dage logget",
    icon: IconTargetArrow,
    compute: (data) => `${data.days.length}`,
  },
  {
    key: "goalsMet",
    label: "Mål nået",
    icon: IconTargetArrow,
    compute: (data) => `${data.days.filter((d) => d.kcal > 0 && d.kcal <= DAILY_KCAL_GOAL).length} dage`,
  },
  {
    key: "steps",
    label: "Skridt",
    icon: IconWalk,
    // Real data once a HealthKit/Health Connect companion app has sent
    // STEPS readings (see docs/HEALTHKIT_COMPANION.md); a placeholder number until then.
    compute: (data) => {
      const avg = averageMetric(data.metrics, "STEPS");
      return avg !== null ? formatNumber(avg) : "6.210";
    },
  },
  {
    key: "water",
    label: "Vand",
    icon: IconDroplet,
    compute: (data) => {
      const avg = averageMetric(data.metrics, "WATER_ML");
      return avg !== null ? `${(avg / 1000).toFixed(1).replace(".", ",")} l` : "1,6 l";
    },
  },
  {
    key: "burned",
    label: "Forbrændt",
    icon: IconBolt,
    compute: (data) => {
      const avg = averageMetric(data.metrics, "ACTIVE_ENERGY_KCAL");
      return avg !== null ? `${formatNumber(avg)} kcal` : "642 kcal";
    },
  },
];

export const DEFAULT_ACTIVE_STAT_KEYS: string[] = STAT_CARD_DEFS.map((def) => def.key);

export const SPORT_STAT_KEY_PREFIX = "sport:";

// One card per sport type the user actually has activity data for (from a
// connected integration or their own manual logging) — sports are
// open-ended/dynamic, so they can't be a fixed STAT_CARD_DEFS entry.
function computeSportStatCards(activities: ActivityTotals[]): StatCardValue[] {
  const bySport = new Map<string, { durationMinutes: number; caloriesBurned: number }>();
  for (const activity of activities) {
    const existing = bySport.get(activity.sportType) ?? { durationMinutes: 0, caloriesBurned: 0 };
    existing.durationMinutes += activity.durationMinutes;
    existing.caloriesBurned += activity.caloriesBurned;
    bySport.set(activity.sportType, existing);
  }

  return Array.from(bySport.entries()).map(([sportType, totals]) => {
    const meta = getSportMeta(sportType);
    return {
      key: `${SPORT_STAT_KEY_PREFIX}${sportType}`,
      label: meta.label,
      icon: meta.icon,
      value: `${formatNumber(totals.durationMinutes)} min · ${formatNumber(totals.caloriesBurned)} kcal`,
    };
  });
}

export function computeStatCards(data: StatCardData): StatCardValue[] {
  const staticCards = STAT_CARD_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    icon: def.icon,
    value: def.compute(data),
  }));
  const sportCards = data.activities ? computeSportStatCards(data.activities) : [];
  return [...staticCards, ...sportCards];
}

// Shared layout persistence for StatCardsGrid and the unused-cards page, so both
// read/write the same localStorage key without duplicating the logic.

export type StatLayoutItem = { type: "stat"; key: string };
export type StatHeaderLayoutItem = { type: "header"; id: string; text: string };
export type StatGridLayoutItem = StatLayoutItem | StatHeaderLayoutItem;

export const STAT_LAYOUT_STORAGE_KEY = "hellocal.statistik.layout";

export function loadStatLayout(defaultLayout: StatGridLayoutItem[]): StatGridLayoutItem[] {
  if (typeof window === "undefined") return defaultLayout;
  try {
    const raw = window.localStorage.getItem(STAT_LAYOUT_STORAGE_KEY);
    if (!raw) return defaultLayout;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return defaultLayout;
  } catch {
    return defaultLayout;
  }
}

export function saveStatLayout(layout: StatGridLayoutItem[]) {
  try {
    window.localStorage.setItem(STAT_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // localStorage unavailable — ignore.
  }
}

/** Adds a stat card to the bottom of the active layout if it isn't already there. */
export function addStatCardToLayout(defaultLayout: StatGridLayoutItem[], key: string): StatGridLayoutItem[] {
  const current = loadStatLayout(defaultLayout);
  const alreadyActive = current.some((item) => item.type === "stat" && item.key === key);
  const next = alreadyActive ? current : [...current, { type: "stat" as const, key }];
  saveStatLayout(next);
  return next;
}

/** Which card keys are active in the saved layout (or the default layout, if nothing is saved yet). */
export function activeStatKeys(defaultLayout: StatGridLayoutItem[]): Set<string> {
  const current = loadStatLayout(defaultLayout);
  return new Set(current.filter((item): item is StatLayoutItem => item.type === "stat").map((item) => item.key));
}
