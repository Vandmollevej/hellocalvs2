import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { metaBySlug } from "@/lib/integrations";
import { integrationLog } from "@/lib/integrations/log";
import { isLogRange } from "@/lib/integrations/log-window";

// GET /api/integrations/<app>/log?range=today|yesterday|week|month|year|all —
// log over det, integrationen har leveret (synkroniseringssiden, 2026-10-11).
// Kun de datatyper, brugeren har slået til, er med (syncSettings.read).
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const meta = metaBySlug((await ctx.params).provider);
  if (!meta) return NextResponse.json({ message: "Ukendt integration" }, { status: 404 });

  const range = req.nextUrl.searchParams.get("range") ?? "today";
  if (!isLogRange(range)) return NextResponse.json({ message: "Ukendt periode" }, { status: 400 });

  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const row = await prisma.integration.findUnique({
      where: { userId_provider: { userId: user.id, provider: meta.provider } },
      select: { syncSettings: true },
    });
    return NextResponse.json(await integrationLog(user.id, meta.provider, row?.syncSettings ?? null, range));
  } catch (error) {
    console.error("Integration log failed", error instanceof Error ? error.message : "ukendt");
    return NextResponse.json({ entries: [], total: 0, message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
