import type { HealthMetricSource, IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Forsidens puls-linje slår i brugerens målte puls (bruger 2026-10-03,
// docs/DECISIONS.md samme dato). Pulsen er den nyeste HEART_RATE_BPM-måling
// fra en tilsluttet integration, hvis den højst er LIVE_HEART_RATE_MAX_AGE_MINUTES
// gammel; ellers null, og forsiden slår 60 bpm.

/** Integrationerne synkroniserer hvert 15. minut; to runder plus urets egen forsinkelse. */
export const LIVE_HEART_RATE_MAX_AGE_MINUTES = 30;

const MIN_BPM = 30;
const MAX_BPM = 220;

// HealthMetricSource-værdierne har samme navn som integrationen, der leverer dem.
const SOURCE_PROVIDER: Record<HealthMetricSource, IntegrationProvider> = {
  APPLE_HEALTH: "APPLE_HEALTH",
  GOOGLE_HEALTH: "GOOGLE_HEALTH",
  FITBIT: "FITBIT",
  WITHINGS: "WITHINGS",
  GARMIN: "GARMIN",
  HEALTH_CONNECT: "HEALTH_CONNECT",
  WHOOP: "WHOOP",
  HUAWEI_HEALTH: "HUAWEI_HEALTH",
};

export type LiveHeartRate = { bpm: number; recordedAt: string; source: HealthMetricSource };

export async function findLiveHeartRate(userId: string, now = new Date()): Promise<LiveHeartRate | null> {
  const connected = await prisma.integration.findMany({
    where: { userId, status: "CONNECTED" },
    select: { provider: true },
  });
  const providers = new Set(connected.map((row) => row.provider));
  const sources = (Object.keys(SOURCE_PROVIDER) as HealthMetricSource[]).filter((source) =>
    providers.has(SOURCE_PROVIDER[source])
  );
  if (sources.length === 0) return null;

  const latest = await prisma.healthMetric.findFirst({
    where: {
      userId,
      type: "HEART_RATE_BPM",
      source: { in: sources },
      value: { gte: MIN_BPM, lte: MAX_BPM },
      recordedAt: { gte: new Date(now.getTime() - LIVE_HEART_RATE_MAX_AGE_MINUTES * 60_000), lte: now },
    },
    orderBy: { recordedAt: "desc" },
    select: { value: true, recordedAt: true, source: true },
  });
  if (!latest) return null;
  return { bpm: Math.round(latest.value), recordedAt: latest.recordedAt.toISOString(), source: latest.source };
}
