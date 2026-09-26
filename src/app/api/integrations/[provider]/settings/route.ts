import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { metaBySlug } from "@/lib/integrations";
import { adapterByProvider } from "@/lib/integrations/registry";
import { missingWriteScopes, resolveSyncSettings, sanitizeSyncSettings } from "@/lib/integrations/sync-settings";

// PUT /api/integrations/<app>/settings — gemmer brugerens til/fra-valg for,
// hvad der hentes fra og sendes til appen. Kan gemmes før tilkobling (så
// valget styrer, hvilken adgang der bedes om) og ændres når som helst.
export async function PUT(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const meta = metaBySlug((await ctx.params).provider);
  if (!meta) return NextResponse.json({ message: "Ukendt integration" }, { status: 404 });

  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const syncSettings = sanitizeSyncSettings(meta.provider, await req.json().catch(() => ({})));
    const row = await prisma.integration.upsert({
      where: { userId_provider: { userId: user.id, provider: meta.provider } },
      create: { userId: user.id, provider: meta.provider, syncSettings },
      update: { syncSettings },
    });
    const adapter = adapterByProvider(meta.provider);
    const needsReconnect =
      adapter && row.status !== "DISCONNECTED" ? missingWriteScopes(meta.provider, adapter.writeScopes, row.syncSettings, row.scope) : [];
    return NextResponse.json({ settings: resolveSyncSettings(meta.provider, row.syncSettings), needsReconnect });
  } catch (error) {
    console.error("Integration settings save failed", error instanceof Error ? error.message : "ukendt");
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
