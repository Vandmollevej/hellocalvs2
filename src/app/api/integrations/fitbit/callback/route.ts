import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { exchangeFitbitCode } from "@/lib/integrations/fitbit";

const STATE_COOKIE = "fitbit_oauth_state";
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
    return redirectWithClearedState("error=fitbit_authorize_failed");
  }

  try {
    const tokens = await exchangeFitbitCode(code);
    const user = await getDemoUser();
    await prisma.integration.upsert({
      where: { userId_provider: { userId: user.id, provider: "FITBIT" } },
      create: {
        userId: user.id,
        provider: "FITBIT",
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
    console.error("Fitbit callback failed", err);
    return redirectWithClearedState("error=fitbit_token_exchange_failed");
  }

  return redirectWithClearedState("connected=fitbit");
}
