import type { IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashDeviceToken } from "@/lib/device-tokens";
import { recordIntegrationEvent } from "@/lib/integrations/events";

// Fælles for Hello Cal-appen på telefonen (Apple Health / Health Connect,
// docs/HEALTHKIT_COMPANION.md): enhedskode-login og integrationens række med
// brugerens til/fra-valg.

export type CompanionSource = "APPLE_HEALTH" | "HEALTH_CONNECT";

export async function authenticateDeviceToken(req: Request) {
  const auth = req.headers.get("authorization");
  const raw = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!raw) return null;
  const token = await prisma.deviceToken.findUnique({ where: { tokenHash: hashDeviceToken(raw) } });
  if (!token) return null;
  await prisma.deviceToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  return token;
}

// GOOGLE_HEALTH var det tidligere navn for Health Connect; det betyder nu
// Google Health API (cloud) og modtages derfor som HEALTH_CONNECT.
export function companionSource(value: unknown): CompanionSource | null {
  const source = value === "GOOGLE_HEALTH" ? "HEALTH_CONNECT" : value;
  return source === "APPLE_HEALTH" || source === "HEALTH_CONNECT" ? source : null;
}

// Integrationens række; oprettes første gang appen melder sig, så kortet
// viser "Forbundet" og brugerens valg gælder. Rækken kan findes i forvejen
// uden forbindelse (til/fra-valg gemt før tilkobling); første gang appen så
// melder sig, tæller det som en tilkobling i admin → Integrationer.
export async function companionIntegration(userId: string, provider: IntegrationProvider) {
  const where = { userId_provider: { userId, provider } };
  const existing = await prisma.integration.findUnique({ where });
  if (existing && existing.status !== "DISCONNECTED") return existing;
  const row = await prisma.integration.upsert({
    where,
    create: { userId, provider, status: "CONNECTED", connectedAt: new Date() },
    update: { status: "CONNECTED", connectedAt: new Date(), lastError: null },
  });
  await recordIntegrationEvent(userId, provider, "CONNECTED");
  return row;
}
