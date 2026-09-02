import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { exchangeWithingsCode } from "@/lib/integrations/withings";

const STATE_COOKIE = "withings_oauth_state";
const DONE_URL = "/settings/integrations";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;
  const error = req.nextUrl.searchParams.get("error");

  function redirectWithClearedState(query?: string) {
    const url = new URL(DONE_URL, req.url);
    if (query) url.search = query;
    const response = NextResponse.redirect(url);
    response.cookies.delete(STATE_COOKIE);
    return response;
  }

  if (error || !code || !state || !expectedState || state !== expectedState) {
    return redirectWithClearedState("error=withings_authorize_failed");
  }

  try {
    const tokens = await exchangeWithingsCode(code);
    const user = await getDemoUser();
    await prisma.integration.upsert({
      where: { userId_provider: { userId: user.id, provider: "WITHINGS" } },
      create: {
        userId: user.id,
        provider: "WITHINGS",
        status: "CONNECTED",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
        connectedAt: new Date(),
      },
      update: {
        status: "CONNECTED",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
        connectedAt: new Date(),
        lastError: null,
      },
    });
  } catch (err) {
    console.error("Withings callback failed", err);
    return redirectWithClearedState("error=withings_token_exchange_failed");
  }

  return redirectWithClearedState("connected=withings");
}
