import { prisma } from "@/lib/prisma";
import { runIntegrationSync } from "./handlers";
import { markFetchOnOpen } from "./open-refresh";
import { withings } from "./withings";

// Withings' notifikationer er ikke signerede og indeholder kun et bruger-ID:
// Hello Cal henter selv de nye data med brugerens eget token. Højst én
// hentning pr. bruger hvert 10. sekund; kommer en notifikation inden da,
// hentes der én gang, når de 10 sekunder er gået (vægt + puls fra samme
// vejning giver dermed kun én hentning).
const MIN_GAP_MS = 10_000;
// Aktivitet (appli 16) kommer ofte i løbet af dagen; den hentes først, når
// brugeren har appen fremme, så serveren ikke belastes.
const FETCH_ON_OPEN_APPLIS = new Set([16]);
const waiting = new Set<string>();

export async function handleWithingsNotification(withingsUserId: string, appli: number | null) {
  const integration = await prisma.integration.findFirst({
    where: { provider: "WITHINGS", externalUserId: withingsUserId, accessToken: { not: null }, status: { not: "DISCONNECTED" } },
    select: { userId: true, lastSyncedAt: true },
  });
  if (!integration) return;
  if (appli !== null && FETCH_ON_OPEN_APPLIS.has(appli)) {
    markFetchOnOpen(integration.userId, "WITHINGS");
    return;
  }
  if (waiting.has(integration.userId)) return;
  const wait = integration.lastSyncedAt ? MIN_GAP_MS - (Date.now() - integration.lastSyncedAt.getTime()) : 0;
  waiting.add(integration.userId);
  try {
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    await runIntegrationSync(integration.userId, withings, true);
  } finally {
    waiting.delete(integration.userId);
  }
}
