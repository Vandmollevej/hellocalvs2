import { NextResponse, type NextRequest } from "next/server";
import type { Integration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getUserSubscriptionTier } from "@/lib/subscription";
import { shouldSync } from "@/lib/integrations";
import { newOAuthState, readOAuthState, saveIntegrationTokens, setOAuthCookie } from "@/lib/integrations-oauth";
import { storeIntegrationItems } from "@/lib/integrations/store-items";
import { filterItemsBySettings, missingWriteScopes, resolveSyncSettings } from "@/lib/integrations/sync-settings";
import { collectPushData, pushCount } from "@/lib/integrations/push";
import { OAUTH_PROVIDERS, adapterBySlug, isConfigured, publicUrl, redirectUri } from "./registry";
import { DAY_MS, type OAuthProviderAdapter } from "./types";

// Fælles route-logik for alle OAuth-integrationer (/api/integrations/<slug>/…).
// Hentede data gemmes direkte på brugeren; Hello Cal-data sendes til appen,
// hvis brugeren har slået det til (docs/DECISIONS.md 2026-09-26).

// Efter tilkobling vender brugeren tilbage til integrationens egen side.
const doneUrl = (adapter: OAuthProviderAdapter) => `/settings/integrations/${adapter.slug}`;
// Overlap ved gentagne synkroniseringer; dubletter springes over ved gemning.
const OVERLAP_MS = DAY_MS;

const stateCookie = (adapter: OAuthProviderAdapter) => `${adapter.slug.replace(/-/g, "_")}_oauth_state`;
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Ukendt fejl");

export function resolveAdapter(slug: string) {
  return adapterBySlug(slug);
}

// GET — starter OAuth for den indloggede bruger.
// Fejl sendes tilbage til siden som ?error=<slug>, ikke som rå JSON.
export async function connect(_req: NextRequest, adapter: OAuthProviderAdapter) {
  const failed = () => NextResponse.redirect(publicUrl(`${doneUrl(adapter)}?error=1`));
  if (!isConfigured(adapter)) {
    console.error(`${adapter.label} connect: ${adapter.envPrefix}_CLIENT_ID/_CLIENT_SECRET er ikke sat`);
    return failed();
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(publicUrl("/welcome"));
  // Integrationer er kun for Seriøs (docs/DECISIONS.md 2026-09-26).
  if ((await getUserSubscriptionTier(user.id)) !== "SERIOUS") return failed();

  // Brugerens til/fra-valg (gemt på integrationens side før tilkobling)
  // afgør, hvilken skriveadgang der bedes om.
  const row = await prisma.integration.findUnique({
    where: { userId_provider: { userId: user.id, provider: adapter.provider } },
    select: { syncSettings: true },
  });
  const settings = resolveSyncSettings(adapter.provider, row?.syncSettings);

  const state = newOAuthState();
  const response = NextResponse.redirect(adapter.buildAuthorizeUrl(state, redirectUri(adapter), settings));
  setOAuthCookie(response, stateCookie(adapter), { state });
  return response;
}

export async function callback(req: NextRequest, adapter: OAuthProviderAdapter) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = readOAuthState(req, stateCookie(adapter));

  function done(query: string) {
    const url = publicUrl(doneUrl(adapter));
    url.search = query;
    const response = NextResponse.redirect(url);
    response.cookies.delete(stateCookie(adapter));
    return response;
  }

  if (req.nextUrl.searchParams.get("error") || !code || !state || !expected || state !== expected.state) {
    return done("error=1");
  }
  try {
    const tokens = await adapter.exchangeCode(code, redirectUri(adapter));
    await adapter.afterConnect?.(tokens);
    // Strava sender de givne scopes i adressen i stedet for i token-svaret.
    const scope = tokens.scope ?? req.nextUrl.searchParams.get("scope") ?? undefined;
    await saveIntegrationTokens(adapter.provider, { ...tokens, scope });
  } catch (error) {
    console.error(`${adapter.label} callback failed`, errorMessage(error));
    return done("error=1");
  }
  return done("connected=1");
}

async function freshAccessToken(adapter: OAuthProviderAdapter, integration: Integration) {
  const expiresSoon = integration.expiresAt && integration.expiresAt.getTime() < Date.now() + 60_000;
  if (!expiresSoon || !integration.refreshToken || !adapter.refresh) return integration.accessToken as string;
  const refreshed = await adapter.refresh(integration.refreshToken);
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? integration.refreshToken,
      expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
    },
  });
  return refreshed.access_token;
}

export type SyncResult = { delivered: number; pushed: number; skipped?: "throttled" };

// Henter nye data fra appen (kun de slåede-til typer) og sender nye
// Hello Cal-data til den. Bruges af "Synkroniser nu" og baggrundsjobbet.
export async function runIntegrationSync(userId: string, adapter: OAuthProviderAdapter, force = false): Promise<SyncResult> {
  const where = { userId_provider: { userId, provider: adapter.provider } };
  const integration = await prisma.integration.findUnique({ where });
  if (!integration || integration.status === "DISCONNECTED" || !integration.accessToken) {
    throw new Error(`${adapter.label} er ikke tilkoblet`);
  }
  if (!force && integration.status === "CONNECTED" && !shouldSync(integration.lastSyncedAt)) {
    return { delivered: 0, pushed: 0, skipped: "throttled" };
  }

  try {
    const accessToken = await freshAccessToken(adapter, integration);

    const since = integration.lastSyncedAt
      ? new Date(integration.lastSyncedAt.getTime() - OVERLAP_MS)
      : new Date(Date.now() - adapter.initialDays * DAY_MS);
    const items = filterItemsBySettings(adapter.provider, integration.syncSettings, await adapter.fetchItems(accessToken, since));
    const delivered = await storeIntegrationItems(userId, items);

    // Push: kun data lavet efter tilkoblingen, og kun typer med skriveadgang.
    let pushed = 0;
    let lastPushedAt = integration.lastPushedAt;
    if (adapter.push) {
      const pushSince = integration.lastPushedAt ?? integration.connectedAt ?? new Date();
      const { data, nextMark } = await collectPushData(userId, adapter.provider, integration.syncSettings, pushSince);
      const missing = new Set(missingWriteScopes(adapter.provider, adapter.writeScopes, integration.syncSettings, integration.scope));
      if (missing.has("nutrition")) data.nutrition = [];
      if (missing.has("water")) data.water = [];
      if (missing.has("weight")) data.weights = [];
      if (missing.has("activities")) data.activities = [];
      if (pushCount(data) > 0) pushed = await adapter.push(accessToken, data);
      lastPushedAt = nextMark;
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "CONNECTED", lastSyncedAt: new Date(), lastPushedAt, lastError: null },
    });
    return { delivered, pushed };
  } catch (error) {
    await prisma.integration
      .updateMany({ where: { userId, provider: adapter.provider }, data: { status: "ERROR", lastError: errorMessage(error) } })
      .catch(() => {});
    throw error;
  }
}

// POST — henter nye data og sender Hello Cal-data (brugerens egen knap).
export async function sync(adapter: OAuthProviderAdapter) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
  try {
    const result = await runIntegrationSync(user.id, adapter);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(`${adapter.label} sync failed`, errorMessage(error));
    return NextResponse.json({ message: `${adapter.label}-synkronisering fejlede` }, { status: 502 });
  }
}

// Baggrundsjob (src/lib/scheduler.ts): alle forbundne cloud-integrationer
// synkroniseres, så data kommer frem uden at brugeren åbner siden.
export async function syncAllIntegrations() {
  const rows = await prisma.integration.findMany({
    where: { status: { in: ["CONNECTED", "ERROR"] }, accessToken: { not: null }, provider: { in: OAUTH_PROVIDERS.map((p) => p.provider) } },
    select: { userId: true, provider: true },
  });
  for (const row of rows) {
    const adapter = OAUTH_PROVIDERS.find((p) => p.provider === row.provider);
    if (!adapter || !isConfigured(adapter)) continue;
    await runIntegrationSync(row.userId, adapter).catch((error) =>
      console.error(`[scheduler] ${adapter.label}-sync fejlede`, errorMessage(error))
    );
  }
}

export async function disconnect(adapter: OAuthProviderAdapter) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
    await prisma.integration.updateMany({
      where: { userId: user.id, provider: adapter.provider },
      data: { status: "DISCONNECTED", accessToken: null, refreshToken: null, expiresAt: null, lastError: null, lastPushedAt: null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`${adapter.label} disconnect failed`, errorMessage(error));
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
