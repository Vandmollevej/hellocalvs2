// Definerer de statistik-kort brugeren kan sætte sammen på Statistik-siden.
// Kortenes rækkefølge/aktive sæt gemmes af StatCardsGrid (localStorage), ikke her.

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

export const STAT_WINDOW_DAYS = 30;

export type StatCardValue = {
  key: string;
  label: string;
  icon: Icon;
  value: string;
};

export type StatCardData = {
  days: DailyTotal[];
};

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits }).format(value);
}

function average(days: DailyTotal[], pick: (d: DailyTotal) => number) {
  if (days.length === 0) return 0;
  return days.reduce((sum, d) => sum + pick(d), 0) / days.length;
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
    label: `Dage logget (${STAT_WINDOW_DAYS} dage)`,
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
    // Skridt kommer fra sundhedsintegration, som ikke er tilkoblet endnu.
    compute: () => "6.210",
  },
  {
    key: "water",
    label: "Vand",
    icon: IconDroplet,
    compute: () => "1,6 l",
  },
  {
    key: "burned",
    label: "Forbrændt",
    icon: IconBolt,
    compute: () => "642 kcal",
  },
];

export const DEFAULT_ACTIVE_STAT_KEYS: string[] = STAT_CARD_DEFS.map((def) => def.key);

export function computeStatCards(data: StatCardData): StatCardValue[] {
  return STAT_CARD_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    icon: def.icon,
    value: def.compute(data),
  }));
}

// Delt layout-persistens for StatCardsGrid og siden med ubrugte kort, så begge
// læser/skriver den samme localStorage-nøgle uden at duplikere logikken.

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
    // localStorage utilgængelig — ignorér.
  }
}

/** Tilføjer et statistik-kort til bunden af det aktive layout, hvis det ikke allerede er der. */
export function addStatCardToLayout(defaultLayout: StatGridLayoutItem[], key: string): StatGridLayoutItem[] {
  const current = loadStatLayout(defaultLayout);
  const alreadyActive = current.some((item) => item.type === "stat" && item.key === key);
  const next = alreadyActive ? current : [...current, { type: "stat" as const, key }];
  saveStatLayout(next);
  return next;
}

/** Hvilke kort-nøgler er aktive i det gemte layout (eller standardlayoutet, hvis intet er gemt endnu). */
export function activeStatKeys(defaultLayout: StatGridLayoutItem[]): Set<string> {
  const current = loadStatLayout(defaultLayout);
  return new Set(current.filter((item): item is StatLayoutItem => item.type === "stat").map((item) => item.key));
}
