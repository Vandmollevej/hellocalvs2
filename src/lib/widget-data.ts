// Builds the data behind every home-screen widget (src/lib/widgets.ts) in one
// response, so a native widget refresh is a single request. Server-only.

import { prisma } from "@/lib/prisma";
import { groupByDay } from "@/lib/daily-totals";
import { computeStatCards, STAT_WINDOW_DAYS } from "@/lib/stat-cards";
import { classifyProduct } from "@/lib/food-classification";
import { visibleAddActions } from "@/lib/widget-add-actions";
import { DAILY_KCAL_GOAL, WEIGHT_GOAL_KG } from "@/lib/goals";
import { getRetentionCutoffDate, getSubscriptionTier } from "@/lib/subscription";
import { translate, type Locale } from "@/i18n";
import {
  RECENT_ENTRIES_MAX,
  WIDGET_ADD_ACTIONS,
  WIDGET_CHART_DAYS,
  WIDGET_LABELS,
  widgetDeepLink,
  type WidgetSnapshot,
} from "@/lib/widgets";

const REFRESH_AFTER_SECONDS = 15 * 60;

const PATHS = { add: "/add/menu", statistics: "/statistics", calendar: "/calendar" };

function formatKcal(value: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(value);
}

/** Registration.nutrient*Snapshot are Json columns; groupByDay wants plain number maps. */
function numberRecord(value: unknown): Record<string, number> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, number>) : undefined;
}

/** YYYY-MM-DD of `date` in the widget device's own time zone. */
function dayKey(date: Date, tzOffsetMinutes: number) {
  return new Date(date.getTime() + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** The last `count` day keys, oldest first, ending with today (device time zone). */
function lastDayKeys(now: Date, tzOffsetMinutes: number, count: number) {
  return Array.from({ length: count }, (_, i) =>
    dayKey(new Date(now.getTime() - (count - 1 - i) * 86_400_000), tzOffsetMinutes),
  );
}

export async function buildWidgetSnapshot(
  userId: string,
  options: { locale: Locale; tzOffsetMinutes: number; now?: Date },
): Promise<WidgetSnapshot> {
  const { locale, tzOffsetMinutes } = options;
  const now = options.now ?? new Date();
  const t = (key: string) => translate(locale, key);
  const labels = WIDGET_LABELS[locale];

  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { sex: true, cycleTrackingEnabled: true } }),
    prisma.subscription.findUnique({ where: { userId } }),
  ]);

  // Same rolling free-tier history limit as GET /api/registrations.
  const retentionCutoff = getRetentionCutoffDate(getSubscriptionTier(subscription), now);
  const windowStart = new Date(now.getTime() - (STAT_WINDOW_DAYS + 1) * 86_400_000);
  const from = retentionCutoff && retentionCutoff > windowStart ? retentionCutoff : windowStart;

  const [registrations, recent, weights, sleep, metrics] = await Promise.all([
    prisma.registration.findMany({
      where: { userId, createdAt: { gte: from } },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: {
            imageUrl: true,
            productCategory: true,
            productType: true,
            dietaryTags: true,
            nutritionExtra: true,
          },
        },
      },
    }),
    prisma.registration.findMany({
      where: { userId, ...(retentionCutoff ? { createdAt: { gte: retentionCutoff } } : {}) },
      orderBy: { createdAt: "desc" },
      take: RECENT_ENTRIES_MAX,
      select: {
        id: true,
        titleSnapshot: true,
        kcalSnapshot: true,
        amountGrams: true,
        createdAt: true,
        product: { select: { imageUrl: true } },
      },
    }),
    prisma.weightEntry.findMany({
      where: { userId, weighedAt: { gte: new Date(now.getTime() - (WIDGET_CHART_DAYS + 1) * 86_400_000) } },
      select: { weightKg: true, weighedAt: true },
    }),
    prisma.sleepQualityEntry.findMany({
      where: { userId, date: { gte: new Date(now.getTime() - (WIDGET_CHART_DAYS + 1) * 86_400_000) } },
      select: { date: true, rating: true },
    }),
    prisma.healthMetric.findMany({
      where: { userId, recordedAt: { gte: from } },
      select: { type: true, value: true, recordedAt: true },
    }),
  ]);

  // --- Today + 7-day charts (grouped in the device's time zone) -----------
  const kcalByDay = new Map<string, number>();
  for (const r of registrations) {
    const key = dayKey(r.createdAt, tzOffsetMinutes);
    kcalByDay.set(key, (kcalByDay.get(key) ?? 0) + r.kcalSnapshot);
  }
  const weightByDay = new Map<string, { sum: number; count: number }>();
  for (const w of weights) {
    const key = dayKey(w.weighedAt, tzOffsetMinutes);
    const entry = weightByDay.get(key) ?? { sum: 0, count: 0 };
    entry.sum += w.weightKg;
    entry.count += 1;
    weightByDay.set(key, entry);
  }
  // SleepQualityEntry.date is a calendar date (stored as UTC midnight).
  const sleepByDay = new Map(sleep.map((s) => [s.date.toISOString().slice(0, 10), s.rating]));

  const days = lastDayKeys(now, tzOffsetMinutes, WIDGET_CHART_DAYS);
  const todayKey = days[days.length - 1];
  const eatenKcal = Math.round(kcalByDay.get(todayKey) ?? 0);
  const goalKcal = DAILY_KCAL_GOAL;
  const leftKcal = goalKcal - eatenKcal;

  const charts: WidgetSnapshot["charts"] = [
    {
      key: "kcal" as const,
      label: t("statistics.calories"),
      unit: "kcal",
      goal: goalKcal,
      points: days.map((date) => ({ date, value: Math.round(kcalByDay.get(date) ?? 0) })),
    },
    {
      key: "weight" as const,
      label: t("statistics.weight"),
      unit: "kg",
      goal: WEIGHT_GOAL_KG,
      points: days.map((date) => {
        const entry = weightByDay.get(date);
        return { date, value: entry ? Math.round((entry.sum / entry.count) * 10) / 10 : null };
      }),
    },
    {
      key: "sleepQuality" as const,
      label: t("statistics.sleepQuality"),
      unit: "1–5",
      goal: null,
      points: days.map((date) => ({ date, value: sleepByDay.get(date) ?? null })),
    },
  ].map((chart) => ({ ...chart, path: PATHS.statistics, deepLink: widgetDeepLink(PATHS.statistics) }));

  // --- Stat boxes: two widget-only boxes + every Statistik card ----------
  const statCards = computeStatCards({
    days: groupByDay(
      registrations.map((r) => ({
        ...r,
        nutrientSnapshot: numberRecord(r.nutrientSnapshot),
        nutrientEstimatedSnapshot: numberRecord(r.nutrientEstimatedSnapshot),
        nutrientToleranceSnapshot: numberRecord(r.nutrientToleranceSnapshot),
        createdAt: r.createdAt.toISOString(),
      })),
    ),
    metrics: metrics.map((m) => ({ type: m.type, value: m.value, recordedAt: m.recordedAt.toISOString() })),
    sources: registrations.map(({ product, ...r }) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      product: product ? { imageUrl: product.imageUrl } : null,
      classification: product ? classifyProduct(product) : null,
    })),
  });
  const statLink = { path: PATHS.statistics, deepLink: widgetDeepLink(PATHS.statistics) };
  const statBoxes: WidgetSnapshot["statBoxes"] = [
    {
      key: "kcalLeft",
      label: leftKcal >= 0 ? labels.kcalLeft : labels.kcalOver,
      value: `${formatKcal(Math.abs(leftKcal))} kcal`,
      ...statLink,
    },
    {
      key: "kcalEatenVsGoal",
      label: labels.kcalEatenVsGoal,
      value: `${formatKcal(eatenKcal)} / ${formatKcal(goalKcal)}`,
      progress: goalKcal > 0 ? eatenKcal / goalKcal : 0,
      ...statLink,
    },
    ...statCards.map((card) => ({ key: card.key, label: card.label, value: card.value, ...statLink })),
  ];

  // --- Quick-add buttons (same visibility rules as the in-app wheel) -----
  const addActions = visibleAddActions({ sex: user?.sex ?? null, cycleTrackingEnabled: user?.cycleTrackingEnabled ?? false }).map(
    (key) => ({
      key,
      label: t(WIDGET_ADD_ACTIONS[key].labelKey),
      path: WIDGET_ADD_ACTIONS[key].path,
      deepLink: widgetDeepLink(WIDGET_ADD_ACTIONS[key].path),
    }),
  );

  const recentEntries: WidgetSnapshot["recentEntries"] = recent.map((r) => ({
    id: r.id,
    title: r.titleSnapshot,
    kcal: Math.round(r.kcalSnapshot),
    amountGrams: r.amountGrams,
    createdAt: r.createdAt.toISOString(),
    imageUrl: r.product?.imageUrl ?? null,
    path: `/registration/${r.id}`,
    deepLink: widgetDeepLink(`/registration/${r.id}`),
  }));

  return {
    generatedAt: now.toISOString(),
    locale,
    tzOffsetMinutes,
    refreshAfterSeconds: REFRESH_AFTER_SECONDS,
    today: { date: todayKey, eatenKcal, goalKcal, leftKcal, overGoal: leftKcal < 0 },
    charts,
    statBoxes,
    addActions,
    recentEntries,
    paths: PATHS,
  };
}
