import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { shouldSync } from "@/lib/integrations";
import {
  fetchFitbitActivityLogs,
  fetchFitbitWeightLogs,
  refreshFitbitToken,
} from "@/lib/integrations/fitbit";

const SYNC_WINDOW_DAYS = 30;

export async function POST() {
  try {
    const user = await getDemoUser();
    const integration = await prisma.integration.findUnique({
      where: { userId_provider: { userId: user.id, provider: "FITBIT" } },
    });

    if (!integration || integration.status !== "CONNECTED" || !integration.accessToken || !integration.refreshToken) {
      return NextResponse.json({ message: "Fitbit er ikke tilkoblet" }, { status: 400 });
    }

    if (!shouldSync(integration.lastSyncedAt)) {
      return NextResponse.json({ ok: true, skipped: "throttled" });
    }

    let accessToken = integration.accessToken;
    if (!integration.expiresAt || integration.expiresAt.getTime() < Date.now()) {
      const refreshed = await refreshFitbitToken(integration.refreshToken);
      accessToken = refreshed.access_token;
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token,
          expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
    }

    const since = new Date(Date.now() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [activityLogs, weightLogs] = await Promise.all([
      fetchFitbitActivityLogs(accessToken, since),
      fetchFitbitWeightLogs(accessToken, since, new Date()),
    ]);

    let activitiesCreated = 0;
    for (const log of activityLogs) {
      const startedAt = new Date(log.originalStartTime ?? log.startTime);
      const existing = await prisma.activity.findFirst({
        where: { userId: user.id, source: "FITBIT", startedAt },
      });
      if (existing) continue;
      await prisma.activity.create({
        data: {
          userId: user.id,
          source: "FITBIT",
          sportType: log.activityName.toLowerCase(),
          startedAt,
          durationMinutes: Math.round(log.duration / 60000),
          caloriesBurned: log.calories,
        },
      });
      activitiesCreated += 1;
    }

    let weightEntriesCreated = 0;
    for (const log of weightLogs) {
      const weighedAt = new Date(`${log.date}T${log.time}`);
      const existing = await prisma.weightEntry.findFirst({
        where: { userId: user.id, source: "FITBIT", weighedAt },
      });
      if (existing) continue;
      await prisma.weightEntry.create({
        data: {
          userId: user.id,
          weightKg: log.weight,
          source: "FITBIT",
          weighedAt,
        },
      });
      weightEntriesCreated += 1;
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncedAt: new Date(), lastError: null },
    });

    return NextResponse.json({ ok: true, activitiesCreated, weightEntriesCreated });
  } catch (error) {
    console.error("Fitbit sync failed", error);
    const user = await getDemoUser().catch(() => null);
    if (user) {
      await prisma.integration
        .updateMany({
          where: { userId: user.id, provider: "FITBIT" },
          data: { status: "ERROR", lastError: error instanceof Error ? error.message : "Ukendt fejl" },
        })
        .catch(() => {});
    }
    return NextResponse.json({ message: "Fitbit-synkronisering fejlede" }, { status: 502 });
  }
}
