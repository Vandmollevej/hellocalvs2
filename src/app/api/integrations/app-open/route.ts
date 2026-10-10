import { after, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { runIntegrationSync } from "@/lib/integrations/handlers";
import { takeFetchOnOpen } from "@/lib/integrations/open-refresh";
import { OAUTH_PROVIDERS } from "@/lib/integrations/registry";

// POST — appen er kommet frem (web: ny side/genindlæsning, native: forgrund).
// Henter data, som en integration har meldt klar, men som er udskudt til
// næste åbning (src/lib/integrations/open-refresh.ts). Uden udskudte data
// sker der intet, så kaldet er billigt.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ fetched: 0 });
  const providers = takeFetchOnOpen(user.id);
  for (const provider of providers) {
    const adapter = OAUTH_PROVIDERS.find((item) => item.provider === provider);
    if (!adapter) continue;
    after(() =>
      runIntegrationSync(user.id, adapter, true).catch((error) =>
        console.error(`${adapter.label}-hentning ved åbning fejlede`, error instanceof Error ? error.message : "ukendt")
      )
    );
  }
  return NextResponse.json({ fetched: providers.length });
}
