import { ActivitySource, HealthMetricSource, HealthMetricType, WeightSource, type IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readTypeOf, resolveSyncSettings } from "@/lib/integrations/sync-settings";
import { isMicronutrientType, type IntegrationLogEntry, type IntegrationLogResponse } from "./log-format";
import { logWindow, type LogRange } from "./log-window";

// Log over det, en integration har leveret til Hello Cal (synkroniseringssiden,
// 2026-10-11): målinger, vejninger og træning med integrationens eget navn som
// kilde. Kun de datatyper, brugeren har slået til under "Rediger visning"
// (syncSettings.read), vises — slår man en type fra, forsvinder den fra loggen.

/** Længste liste, siden henter ad gangen; resten kan ses ved at vælge en kortere periode. */
export const LOG_LIMIT = 300;

const has = (values: object, value: string) => (Object.values(values) as string[]).includes(value);

export async function integrationLog(
  userId: string,
  provider: IntegrationProvider,
  storedSettings: unknown,
  range: LogRange,
  now: Date = new Date()
): Promise<IntegrationLogResponse> {
  const { from, to } = logWindow(range, now);
  const { read } = resolveSyncSettings(provider, storedSettings);
  const time = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };

  const metricTypes = Object.values(HealthMetricType).filter(
    (type) => !isMicronutrientType(type) && read[readTypeOf({ kind: "metric", payload: { type } })] === true
  );

  const metricWhere = has(HealthMetricSource, provider) && metricTypes.length > 0
    ? { userId, source: provider as HealthMetricSource, type: { in: metricTypes }, recordedAt: time }
    : null;
  const weightWhere = has(WeightSource, provider) && read.weight === true
    ? { userId, source: provider as WeightSource, weighedAt: time }
    : null;
  const activityWhere = has(ActivitySource, provider) && read.activities === true
    ? { userId, source: provider as ActivitySource, startedAt: time }
    : null;

  const [metrics, metricCount, weights, weightCount, activities, activityCount] = await Promise.all([
    metricWhere
      ? prisma.healthMetric.findMany({ where: metricWhere, orderBy: { recordedAt: "desc" }, take: LOG_LIMIT })
      : [],
    metricWhere ? prisma.healthMetric.count({ where: metricWhere }) : 0,
    weightWhere ? prisma.weightEntry.findMany({ where: weightWhere, orderBy: { weighedAt: "desc" }, take: LOG_LIMIT }) : [],
    weightWhere ? prisma.weightEntry.count({ where: weightWhere }) : 0,
    activityWhere ? prisma.activity.findMany({ where: activityWhere, orderBy: { startedAt: "desc" }, take: LOG_LIMIT }) : [],
    activityWhere ? prisma.activity.count({ where: activityWhere }) : 0,
  ]);

  const entries: IntegrationLogEntry[] = [
    ...metrics.map((m): IntegrationLogEntry => ({
      id: `metric:${m.id}`,
      kind: "metric",
      type: m.type,
      value: m.value,
      kcal: null,
      at: m.recordedAt.toISOString(),
      // Dagssummer (skridt, søvn …) gemmes som datoen kl. 00:00:00.000 UTC.
      daySum: m.recordedAt.toISOString().endsWith("T00:00:00.000Z"),
    })),
    ...weights.map((w): IntegrationLogEntry => ({
      id: `weight:${w.id}`,
      kind: "weight",
      type: "WEIGHT",
      value: w.weightKg,
      kcal: null,
      at: w.weighedAt.toISOString(),
      daySum: false,
    })),
    ...activities.map((a): IntegrationLogEntry => ({
      id: `activity:${a.id}`,
      kind: "activity",
      type: a.sportType,
      value: a.durationMinutes,
      kcal: a.caloriesBurned,
      at: a.startedAt.toISOString(),
      daySum: false,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, LOG_LIMIT);

  return { range, entries, total: metricCount + weightCount + activityCount };
}
