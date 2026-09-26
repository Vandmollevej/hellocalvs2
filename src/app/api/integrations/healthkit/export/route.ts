import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateDeviceToken, companionIntegration, companionSource } from "@/lib/integrations/companion";
import { collectPushData } from "@/lib/integrations/push";
import { resolveSyncSettings } from "@/lib/integrations/sync-settings";

// GET /api/integrations/healthkit/export?source=APPLE_HEALTH&since=<cursor>
// Hello Cal-appen på telefonen henter her de data, den skal skrive til Apple
// Health / Health Connect (push, docs/HEALTHKIT_COMPANION.md). Svaret har
// brugerens til/fra-valg (hvilke typer appen skal bede om læse-/skriveadgang
// til) og kun data for de typer, der er slået til under "Send til".
//
// Cursor: appen gemmer "cursor" fra svaret og sender den som "since" næste
// gang, når dataene er skrevet. Serveren noterer den som seneste push.
export async function GET(req: Request) {
  const token = await authenticateDeviceToken(req);
  if (!token) return NextResponse.json({ message: "Ugyldigt eller manglende enhedstoken" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const source = companionSource(params.get("source"));
  if (!source) return NextResponse.json({ message: "source skal være APPLE_HEALTH eller HEALTH_CONNECT" }, { status: 400 });
  const sinceParam = params.get("since");
  const sinceDate = sinceParam ? new Date(sinceParam) : null;
  if (sinceDate && Number.isNaN(sinceDate.getTime())) {
    return NextResponse.json({ message: "since skal være en ISO-dato" }, { status: 400 });
  }

  try {
    const integration = await companionIntegration(token.userId, source);
    const since = sinceDate ?? integration.lastPushedAt ?? integration.connectedAt ?? integration.createdAt;
    const { data, nextMark } = await collectPushData(token.userId, source, integration.syncSettings, since);
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "CONNECTED", lastPushedAt: sinceDate ?? integration.lastPushedAt },
    });
    return NextResponse.json({
      settings: resolveSyncSettings(source, integration.syncSettings),
      cursor: nextMark.toISOString(),
      ...data,
    });
  } catch (error) {
    console.error("Companion export failed", error instanceof Error ? error.message : "ukendt");
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
