import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { INTEGRATION_CATALOG } from "@/lib/integrations";
import { BODY_METRIC_TYPES, SAME_MEASUREMENT_MS } from "@/lib/body-metrics";
import { attireHistory, getAttireSettings } from "@/lib/weight-attire-server";
import { MAX_PROMPT_DAYS, suggestAttire } from "@/lib/weigh-attire";
import type { HealthMetricSource, HealthMetricType } from "@prisma/client";

// GET — vejninger fra en smartvægt de seneste 7 dage, hvor brugeren endnu ikke
// har bekræftet tøj (popup "Du har vejet dig i morges. Men var det:").
export async function GET() {
  try {
    const user = await getProfileUser("weight", "VIEWED");
    if (!user) return unauthorized();
    const settings = await getAttireSettings();
    const since = new Date(Date.now() - MAX_PROMPT_DAYS * 86_400_000);
    const entries = await prisma.weightEntry.findMany({
      where: { userId: user.id, attire: null, source: { not: "MANUAL" }, weighedAt: { gte: since } },
      orderBy: { weighedAt: "asc" },
      take: 30,
    });
    if (entries.length === 0) return NextResponse.json({ pending: [] });

    const history = await attireHistory(user.id, settings);
    const pending = await Promise.all(
      entries.map(async (entry) => {
        const meta = INTEGRATION_CATALOG.find((item) => item.provider === entry.source);
        const metrics = await prisma.healthMetric.findMany({
          where: {
            userId: user.id,
            source: entry.source as HealthMetricSource,
            type: { in: BODY_METRIC_TYPES as HealthMetricType[] },
            recordedAt: {
              gte: new Date(entry.weighedAt.getTime() - SAME_MEASUREMENT_MS),
              lte: new Date(entry.weighedAt.getTime() + SAME_MEASUREMENT_MS),
            },
          },
          select: { type: true, value: true },
        });
        return {
          id: entry.id,
          weightKg: entry.weightKg,
          weighedAt: entry.weighedAt.toISOString(),
          source: { label: meta?.label ?? entry.source, icon: meta?.icon ?? null },
          metrics,
          suggestion: suggestAttire(entry.weighedAt, history, settings),
        };
      })
    );
    return NextResponse.json({ pending });
  } catch (error) {
    console.error("Pending weigh-ins failed", error);
    return NextResponse.json({ pending: [] });
  }
}
