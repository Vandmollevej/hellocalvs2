import { prisma } from "@/lib/prisma";
import { storeIntegrationItems } from "@/lib/integrations/store-items";
import { filterItemsBySettings } from "@/lib/integrations/sync-settings";
import { freshAccessToken } from "./handlers";
import { GARMIN_API, garmin } from "./garmin";
import { GARMIN_SUMMARY_KINDS, garminItems, type GarminSummaryKind } from "./garmin-items";
import { getJson } from "./types";

// Garmins ping-notifikationer (Ping/Pull): Garmin fortæller, at der ligger nye
// data, og Hello Cal henter dem selv med brugerens eget token. Data i selve
// notifikationen (Push-tilstand) bruges ikke, da notifikationer ikke er
// signerede — kun adresser hos apis.garmin.com hentes, og kun for kendte
// Garmin-brugere.

type Ping = { userId?: string; callbackURL?: string };
export type GarminNotification = Partial<Record<GarminSummaryKind | "deregistrations" | "userPermissionsChange", Ping[]>>;

function trustedCallback(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.host === new URL(GARMIN_API).host && url.pathname.startsWith("/wellness-api/rest/")
      ? url
      : null;
  } catch {
    return null;
  }
}

async function integrationFor(userId: unknown) {
  if (typeof userId !== "string" || !userId) return null;
  return prisma.integration.findFirst({ where: { provider: "GARMIN", externalUserId: userId, accessToken: { not: null } } });
}

export async function handleGarminNotification(body: GarminNotification) {
  // Brugeren har fjernet Hello Cal i Garmin Connect.
  for (const entry of body.deregistrations ?? []) {
    const integration = await integrationFor(entry.userId);
    if (!integration) continue;
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "DISCONNECTED", accessToken: null, refreshToken: null, expiresAt: null, externalUserId: null },
    });
  }

  for (const kind of GARMIN_SUMMARY_KINDS) {
    for (const ping of body[kind] ?? []) {
      const url = trustedCallback(ping.callbackURL);
      const integration = url ? await integrationFor(ping.userId) : null;
      if (!url || !integration || integration.status === "DISCONNECTED") continue;
      try {
        const token = await freshAccessToken(garmin, integration);
        const records = await getJson<unknown[]>(url, token, `Garmin ${kind}`);
        const items = filterItemsBySettings("GARMIN", integration.syncSettings, garminItems(kind, Array.isArray(records) ? records : []));
        await storeIntegrationItems(integration.userId, items);
        await prisma.integration.update({
          where: { id: integration.id },
          data: { status: "CONNECTED", lastSyncedAt: new Date(), lastError: null },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Ukendt fejl";
        console.error(`Garmin ping (${kind}) fejlede`, message);
        await prisma.integration.update({ where: { id: integration.id }, data: { status: "ERROR", lastError: message } }).catch(() => {});
      }
    }
  }
}
