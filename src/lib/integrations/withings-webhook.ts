import { prisma } from "@/lib/prisma";
import { runIntegrationSync } from "./handlers";
import { withings } from "./withings";

// Withings' notifikationer er ikke signerede og indeholder kun et bruger-ID:
// Hello Cal henter selv de nye målinger med brugerens eget token. Højst én
// hentning pr. bruger hvert 10. sekund; kommer en notifikation inden da,
// hentes der én gang, når de 10 sekunder er gået.
const MIN_GAP_MS = 10_000;
const waiting = new Set<string>();

export async function handleWithingsNotification(withingsUserId: string) {
  const integration = await prisma.integration.findFirst({
    where: { provider: "WITHINGS", externalUserId: withingsUserId, accessToken: { not: null }, status: { not: "DISCONNECTED" } },
    select: { userId: true, lastSyncedAt: true },
  });
  if (!integration || waiting.has(integration.userId)) return;
  const wait = integration.lastSyncedAt ? MIN_GAP_MS - (Date.now() - integration.lastSyncedAt.getTime()) : 0;
  waiting.add(integration.userId);
  try {
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    await runIntegrationSync(integration.userId, withings, true);
  } finally {
    waiting.delete(integration.userId);
  }
}
