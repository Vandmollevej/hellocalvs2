import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { shouldSync } from "@/lib/integrations";
import { fetchFitbitActivityLogs, fetchFitbitWeightLogs, refreshFitbitToken } from "@/lib/integrations/fitbit";
import { deliverToInbox, type InboxEnvelope } from "@/lib/vault/inbox-delivery";

const SYNC_WINDOW_DAYS = 30;

// POST — henter Fitbit-aktiviteter og -vejninger og forsegler dem straks til
// brugerens indbakke (docs/PRIVACY.md). Intet gemmes i klartekst; klienten
// flytter dem ind i boksen og fjerner dubletter via faste ID'er.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
  try {
    const integration = await prisma.integration.findUnique({
      where: { userId_provider: { userId: user.id, provider: "FITBIT" } },
    });
    if (
      !integration ||
      integration.status !== "CONNECTED" ||
      !integration.accessToken ||
      !integration.refreshToken ||
      !integration.inboxId
    ) {
      return NextResponse.json({ message: "Fitbit er ikke tilkoblet" }, { status: 400 });
    }
    if (!shouldSync(integration.lastSyncedAt)) return NextResponse.json({ ok: true, skipped: "throttled" });

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

    const items: InboxEnvelope[] = [
      ...activityLogs.map((log) => ({
        kind: "activity",
        payload: {
          source: "FITBIT",
          sportType: log.activityName.toLowerCase(),
          startedAt: new Date(log.originalStartTime ?? log.startTime).toISOString(),
          durationMinutes: Math.round(log.duration / 60000),
          caloriesBurned: log.calories,
        },
      })),
      ...weightLogs.map((log) => ({
        kind: "weight",
        payload: { source: "FITBIT", weightKg: log.weight, weighedAt: new Date(`${log.date}T${log.time}`).toISOString() },
      })),
    ];
    const delivered = await deliverToInbox(integration.inboxId, items);

    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncedAt: new Date(), lastError: null },
    });
    return NextResponse.json({ ok: true, delivered });
  } catch (error) {
    console.error("Fitbit sync failed", error instanceof Error ? error.message : "ukendt");
    await prisma.integration
      .updateMany({
        where: { userId: user.id, provider: "FITBIT" },
        data: { status: "ERROR", lastError: error instanceof Error ? error.message : "Ukendt fejl" },
      })
      .catch(() => {});
    return NextResponse.json({ message: "Fitbit-synkronisering fejlede" }, { status: 502 });
  }
}
