import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { shouldSync } from "@/lib/integrations";
import { fetchWithingsWeightMeasurements, refreshWithingsToken } from "@/lib/integrations/withings";
import { deliverToInbox } from "@/lib/vault/inbox-delivery";

const SYNC_WINDOW_DAYS = 30;

// POST — henter Withings-vejninger og forsegler dem straks til brugerens
// indbakke (docs/PRIVACY.md). Intet gemmes i klartekst.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
  try {
    const integration = await prisma.integration.findUnique({
      where: { userId_provider: { userId: user.id, provider: "WITHINGS" } },
    });
    if (
      !integration ||
      integration.status !== "CONNECTED" ||
      !integration.accessToken ||
      !integration.refreshToken ||
      !integration.inboxId
    ) {
      return NextResponse.json({ message: "Withings er ikke tilkoblet" }, { status: 400 });
    }
    if (!shouldSync(integration.lastSyncedAt)) return NextResponse.json({ ok: true, skipped: "throttled" });

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
    const delivered = await deliverToInbox(
      integration.inboxId,
      measurements.map((m) => ({
        kind: "weight",
        payload: { source: "WITHINGS", weightKg: m.weightKg, weighedAt: m.weighedAt.toISOString() },
      }))
    );

    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncedAt: new Date(), lastError: null },
    });
    return NextResponse.json({ ok: true, delivered });
  } catch (error) {
    console.error("Withings sync failed", error instanceof Error ? error.message : "ukendt");
    await prisma.integration
      .updateMany({
        where: { userId: user.id, provider: "WITHINGS" },
        data: { status: "ERROR", lastError: error instanceof Error ? error.message : "Ukendt fejl" },
      })
      .catch(() => {});
    return NextResponse.json({ message: "Withings-synkronisering fejlede" }, { status: 502 });
  }
}
