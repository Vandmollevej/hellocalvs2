import { after, NextResponse } from "next/server";
import type { IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { runIntegrationSync } from "@/lib/integrations/handlers";
import { takeFetchOnOpen } from "@/lib/integrations/open-refresh";
import { OAUTH_PROVIDERS, isConfigured } from "@/lib/integrations/registry";

// POST — appen er kommet frem (web: ny side/genindlæsning, native: forgrund).
// Henter data, som en integration har meldt klar, men som er udskudt til
// næste åbning (src/lib/integrations/open-refresh.ts). Desuden hentes alle
// forbundne cloud-integrationer uden webhook (fx Google Health), så de
// synkroniserer af sig selv ligesom Withings (2026-10-16). Den almindelige
// grænse på 15 min. mellem to hentninger gør kaldet billigt.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ fetched: 0 });
  const forced = new Set(takeFetchOnOpen(user.id));
  const connected = await prisma.integration
    .findMany({
      where: { userId: user.id, status: { in: ["CONNECTED", "ERROR"] }, accessToken: { not: null } },
      select: { provider: true },
    })
    .catch(() => []);
  const providers = new Set<IntegrationProvider>([...forced, ...connected.map((row) => row.provider)]);
  for (const provider of providers) {
    const adapter = OAUTH_PROVIDERS.find((item) => item.provider === provider);
    if (!adapter || !isConfigured(adapter)) continue;
    after(() =>
      runIntegrationSync(user.id, adapter, forced.has(provider)).catch((error) =>
        console.error(`${adapter.label}-hentning ved åbning fejlede`, error instanceof Error ? error.message : "ukendt")
      )
    );
  }
  return NextResponse.json({ fetched: providers.size });
}
