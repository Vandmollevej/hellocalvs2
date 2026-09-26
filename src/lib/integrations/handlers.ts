import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getUserSubscriptionTier } from "@/lib/subscription";
import { shouldSync } from "@/lib/integrations";
import { newOAuthState, readOAuthState, saveIntegrationTokens, setOAuthCookie } from "@/lib/integrations-oauth";
import { storeIntegrationItems } from "@/lib/integrations/store-items";
import { adapterBySlug, isConfigured, redirectUri } from "./registry";
import { DAY_MS, type OAuthProviderAdapter } from "./types";

// Fælles route-logik for alle OAuth-integrationer (/api/integrations/<slug>/…).
// Hentede data gemmes direkte på brugeren.

const DONE_URL = "/settings/integrations";
// Overlap ved gentagne synkroniseringer; dubletter fjernes i boksen via faste ID'er.
const OVERLAP_MS = DAY_MS;

const stateCookie = (adapter: OAuthProviderAdapter) => `${adapter.slug.replace(/-/g, "_")}_oauth_state`;
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Ukendt fejl");

export function resolveAdapter(slug: string) {
  return adapterBySlug(slug);
}

// GET — starter OAuth for den indloggede bruger.
export async function connect(_req: NextRequest, adapter: OAuthProviderAdapter) {
  if (!isConfigured(adapter)) {
    return NextResponse.json(
      { message: `${adapter.envPrefix}_CLIENT_ID/${adapter.envPrefix}_CLIENT_SECRET er ikke sat på serveren endnu` },
      { status: 503 }
    );
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
  // Integrationer er kun for Seriøs (docs/DECISIONS.md 2026-09-26).
  if ((await getUserSubscriptionTier(user.id)) !== "SERIOUS") {
    return NextResponse.json({ message: "Integrationer kræver Seriøs" }, { status: 403 });
  }

  const state = newOAuthState();
  const response = NextResponse.redirect(adapter.buildAuthorizeUrl(state, redirectUri(adapter)));
  setOAuthCookie(response, stateCookie(adapter), { state });
  return response;
}

export async function callback(req: NextRequest, adapter: OAuthProviderAdapter) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = readOAuthState(req, stateCookie(adapter));

  function done(query: string) {
    const url = new URL(DONE_URL, req.url);
    url.search = query;
    const response = NextResponse.redirect(url);
    response.cookies.delete(stateCookie(adapter));
    return response;
  }

  if (req.nextUrl.searchParams.get("error") || !code || !state || !expected || state !== expected.state) {
    return done(`error=${adapter.slug}`);
  }
  try {
    const tokens = await adapter.exchangeCode(code, redirectUri(adapter));
    await adapter.afterConnect?.(tokens);
    await saveIntegrationTokens(adapter.provider, tokens);
  } catch (error) {
    console.error(`${adapter.label} callback failed`, errorMessage(error));
    return done(`error=${adapter.slug}`);
  }
  return done(`connected=${adapter.slug}`);
}

// POST — henter nye data og gemmer dem på brugeren.
export async function sync(adapter: OAuthProviderAdapter) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
  const where = { userId_provider: { userId: user.id, provider: adapter.provider } };
  try {
    const integration = await prisma.integration.findUnique({ where });
    if (!integration || integration.status === "DISCONNECTED" || !integration.accessToken) {
      return NextResponse.json({ message: `${adapter.label} er ikke tilkoblet` }, { status: 400 });
    }
    if (integration.status === "CONNECTED" && !shouldSync(integration.lastSyncedAt)) {
      return NextResponse.json({ ok: true, skipped: "throttled" });
    }

    let accessToken = integration.accessToken;
    const expiresSoon = integration.expiresAt && integration.expiresAt.getTime() < Date.now() + 60_000;
    if (expiresSoon && integration.refreshToken && adapter.refresh) {
      const refreshed = await adapter.refresh(integration.refreshToken);
      accessToken = refreshed.access_token;
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token ?? integration.refreshToken,
          expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
        },
      });
    }

    const since = integration.lastSyncedAt
      ? new Date(integration.lastSyncedAt.getTime() - OVERLAP_MS)
      : new Date(Date.now() - adapter.initialDays * DAY_MS);
    const delivered = await storeIntegrationItems(user.id, await adapter.fetchItems(accessToken, since));

    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "CONNECTED", lastSyncedAt: new Date(), lastError: null },
    });
    return NextResponse.json({ ok: true, delivered });
  } catch (error) {
    console.error(`${adapter.label} sync failed`, errorMessage(error));
    await prisma.integration
      .updateMany({ where: { userId: user.id, provider: adapter.provider }, data: { status: "ERROR", lastError: errorMessage(error) } })
      .catch(() => {});
    return NextResponse.json({ message: `${adapter.label}-synkronisering fejlede` }, { status: 502 });
  }
}

export async function disconnect(adapter: OAuthProviderAdapter) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
    await prisma.integration.updateMany({
      where: { userId: user.id, provider: adapter.provider },
      data: { status: "DISCONNECTED", accessToken: null, refreshToken: null, expiresAt: null, lastError: null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`${adapter.label} disconnect failed`, errorMessage(error));
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
