// Home-screen widget catalog for the future native iOS (WidgetKit) and Android
// (Glance/AppWidget) apps — see docs/WIDGETS.md and docs/DECISIONS.md
// 2026-09-26. The native widgets render from GET /api/widgets/snapshot; this
// file is the shared contract (kinds, sizes, config options, deep links) that
// both the endpoint and the in-app design preview (/widgets) read, so the
// design can be approved before any native code exists.
//
// Deliberately free of React hooks so route handlers can import it.

import type { AddActionKey } from "@/lib/add-actions";

export type WidgetPlatform = "ios" | "android";

export type WidgetKind = "quickAdd" | "addRow" | "statChart" | "statBox" | "recentEntries";

/** iOS widget families (fixed sizes) — Android sizes are grid cells and resizable. */
export type IosFamily = "systemSmall" | "systemMedium" | "systemLarge";

export type WidgetDefinition = {
  kind: WidgetKind;
  /** Danish working title, shown in the preview and the native widget gallery. */
  title: string;
  description: string;
  ios: IosFamily[];
  /** Android default size in launcher cells (columns × rows) and whether it may be resized. */
  android: { cols: number; rows: number; resizable: "none" | "horizontal" | "vertical" | "both" };
  /** App path opened when the widget body is tapped (individual buttons/rows may override). */
  tapPath: string;
};

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    kind: "quickAdd",
    title: "Tilføj",
    description: "Én knap med plus, der åbner listen over alt, du kan registrere.",
    ios: ["systemSmall"],
    android: { cols: 1, rows: 1, resizable: "none" },
    tapPath: "/add/menu",
  },
  {
    kind: "addRow",
    title: "Hurtig-tilføj",
    description: "En række genvejsknapper (fx søg, kamera, vand, vægt). Du vælger selv knapperne.",
    ios: ["systemMedium"],
    android: { cols: 4, rows: 1, resizable: "horizontal" },
    tapPath: "/add/menu",
  },
  {
    kind: "statChart",
    title: "Statistik-graf",
    description:
      "Graf fra Statistik over 2 rækker. iPhone: én widget pr. graf, som stables og swipes i en Smart Stack. Android: swipe op/ned mellem graferne i samme widget.",
    ios: ["systemMedium"],
    android: { cols: 4, rows: 2, resizable: "horizontal" },
    tapPath: "/statistics",
  },
  {
    kind: "statBox",
    title: "Statistik-boks",
    description: "Én statistik-boks i 2×2. Du vælger selv hvilken, fx kalorier tilbage.",
    ios: ["systemSmall"],
    android: { cols: 2, rows: 2, resizable: "none" },
    tapPath: "/statistics",
  },
  {
    kind: "recentEntries",
    title: "Seneste registreringer",
    description:
      "Dine seneste madregistreringer. iPhone: mellem (3 rækker) eller stor (8 rækker). Android: træk selv i højden.",
    ios: ["systemMedium", "systemLarge"],
    android: { cols: 4, rows: 2, resizable: "vertical" },
    tapPath: "/calendar",
  },
];

// Approximate iPhone widget sizes in points (6.1"/6.3" class devices). Only
// used by the web preview; the real sizes come from WidgetKit at runtime.
export const IOS_FAMILY_SIZE: Record<IosFamily, { width: number; height: number }> = {
  systemSmall: { width: 170, height: 170 },
  systemMedium: { width: 364, height: 170 },
  systemLarge: { width: 364, height: 382 },
};

// Approximate Android launcher cell size in dp (Pixel-class 5×5 grid).
export const ANDROID_CELL = { width: 88, height: 96, gap: 4 };

export function androidSize(cols: number, rows: number) {
  return {
    width: cols * ANDROID_CELL.width + (cols - 1) * ANDROID_CELL.gap,
    height: rows * ANDROID_CELL.height + (rows - 1) * ANDROID_CELL.gap,
  };
}

// ---------------------------------------------------------------------------
// Deep links. The native apps register the `hellocal://` scheme and map the
// path 1:1 onto the same screen as the web app route.

export const WIDGET_URL_SCHEME = "hellocal";

export function widgetDeepLink(path: string) {
  return `${WIDGET_URL_SCHEME}://${path.replace(/^\//, "")}`;
}

// ---------------------------------------------------------------------------
// Widget 2 — "Hurtig-tilføj" buttons. Keyed by AddActionKey so a new add
// action fails the type check here until it gets a widget mapping.

export const WIDGET_ADD_ACTIONS: Record<AddActionKey, { path: string; labelKey: string }> = {
  microphone: { path: "/voice", labelKey: "addButton.microphone" },
  ownDishes: { path: "/create-dish", labelKey: "addButton.ownDishes" },
  search: { path: "/search", labelKey: "addButton.search" },
  weight: { path: "/weight/create", labelKey: "addButton.weight" },
  water: { path: "/water/create", labelKey: "addButton.water" },
  activity: { path: "/activity/create", labelKey: "addButton.activity" },
  camera: { path: "/camera?mode=product", labelKey: "addButton.camera" },
  targetWeight: { path: "/profile/goals", labelKey: "profile.actions.target" },
  bodyMeasurements: { path: "/profile/body-measurements", labelKey: "profile.row.bodyMeasurements" },
  menstrualCycle: { path: "/period/create", labelKey: "addButton.menstrualCycle" },
};

export const DEFAULT_ADD_ROW_KEYS: AddActionKey[] = ["search", "camera", "water", "weight"];

/** iOS medium and Android 4×1 fit four buttons; Android may widen to five cells. */
export const MAX_ADD_ROW_ACTIONS = { ios: 4, android: 5 } as const;

// ---------------------------------------------------------------------------
// Widget 3 — the charts from Statistik.

export type WidgetChartKey = "kcal" | "weight" | "sleepQuality";

export const WIDGET_CHART_KEYS: WidgetChartKey[] = ["kcal", "weight", "sleepQuality"];

export const WIDGET_CHART_DAYS = 7;

// ---------------------------------------------------------------------------
// Widget 4 — the 2×2 stat box. Two widget-only boxes plus every card from
// Statistik (src/lib/stat-cards.ts, same keys).

export const WIDGET_STAT_BOX_SPECIAL_KEYS = ["kcalLeft", "kcalEatenVsGoal"] as const;

export const DEFAULT_STAT_BOX_KEY = "kcalLeft";

// Widget-only labels. Kept here rather than in da.json/en.json because the
// native apps ship their own string catalogs; the snapshot just carries the
// resolved text.
export const WIDGET_LABELS = {
  da: { kcalLeft: "Kalorier tilbage", kcalOver: "Over dagens mål", kcalEatenVsGoal: "Spist i dag / mål" },
  en: { kcalLeft: "Calories left", kcalOver: "Over today's goal", kcalEatenVsGoal: "Eaten today / goal" },
} as const;

// ---------------------------------------------------------------------------
// Widget 6 — latest registrations.

export const RECENT_ENTRIES_ROWS: Record<"systemMedium" | "systemLarge", number> = {
  systemMedium: 3,
  systemLarge: 8,
};

export const RECENT_ENTRIES_MAX = 12;

/** Android: how many rows fit a resized widget height (header 40 dp, rows 36 dp). */
export function recentEntriesRowsForHeight(heightDp: number) {
  return Math.max(1, Math.min(RECENT_ENTRIES_MAX, Math.floor((heightDp - 40) / 36)));
}

// ---------------------------------------------------------------------------
// Snapshot contract returned by GET /api/widgets/snapshot.

export type WidgetSnapshot = {
  generatedAt: string;
  locale: "da" | "en";
  tzOffsetMinutes: number;
  /** Suggested next refresh for WidgetKit timelines / Android WorkManager. */
  refreshAfterSeconds: number;
  today: {
    date: string;
    eatenKcal: number;
    goalKcal: number;
    leftKcal: number;
    overGoal: boolean;
  };
  charts: {
    key: WidgetChartKey;
    label: string;
    unit: string;
    goal: number | null;
    points: { date: string; value: number | null }[];
    path: string;
    deepLink: string;
  }[];
  statBoxes: {
    key: string;
    label: string;
    value: string;
    /** Only for kcalEatenVsGoal: fraction of the goal eaten, for a progress ring. */
    progress?: number;
    path: string;
    deepLink: string;
  }[];
  addActions: { key: AddActionKey; label: string; path: string; deepLink: string }[];
  recentEntries: {
    id: string;
    title: string;
    kcal: number;
    amountGrams: number;
    createdAt: string;
    imageUrl: string | null;
    path: string;
    deepLink: string;
  }[];
  paths: { add: string; statistics: string; calendar: string };
};
