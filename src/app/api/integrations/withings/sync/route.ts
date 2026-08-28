import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { shouldSync } from "@/lib/integrations";
import { fetchWithingsWeightMeasurements, refreshWithingsToken } from "@/lib/integrations/withings";

const SYNC_WINDOW_DAYS = 30;

export async function POST() {
  try {
    const user = await getDemoUser();
    const integration = await prisma.integration.findUnique({
      where: { userId_provider: { userId: user.id, provider: "WITHINGS" } },
    });

    if (!integration || integration.status !== "CONNECTED" || !integration.accessToken || !integration.refreshToken) {
      return NextResponse.json({ message: "Withings er ikke tilkoblet" }, { status: 400 });
    }

    if (!shouldSync(integration.lastSyncedAt)) {
      return NextResponse.json({ ok: true, skipped: "throttled" });
    }

    let accessToken = integration.accessToken;
    if (!integration.expiresAt || integration.expiresAt.getTime() < Date.now()) {
      const refreshed = await refreshWithingsToken(integration.refreshToken);
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

    const sinceUnixSeconds = Math.floor(
      (integration.lastSyncedAt?.getTime() ?? Date.now() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000) / 1000
    );
    const measurements = await fetchWithingsWeightMeasurements(accessToken, sinceUnixSeconds);

    let weightEntriesCreated = 0;
    for (const measurement of measurements) {
      const existing = await prisma.weightEntry.findFirst({
        where: { userId: user.id, source: "WITHINGS", weighedAt: measurement.weighedAt },
      });
      if (existing) continue;
      await prisma.weightEntry.create({
        data: {
          userId: user.id,
          weightKg: measurement.weightKg,
          source: "WITHINGS",
          weighedAt: measurement.weighedAt,
        },
      });
      weightEntriesCreated += 1;
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncedAt: new Date(), lastError: null },
    });

    return NextResponse.json({ ok: true, weightEntriesCreated });
  } catch (error) {
    console.error("Withings sync failed", error);
    const user = await getDemoUser().catch(() => null);
    if (user) {
      await prisma.integration
        .updateMany({
          where: { userId: user.id, provider: "WITHINGS" },
          data: { status: "ERROR", lastError: error instanceof Error ? error.message : "Ukendt fejl" },
        })
        .catch(() => {});
    }
    return NextResponse.json({ message: "Withings-synkronisering fejlede" }, { status: 502 });
  }
}
