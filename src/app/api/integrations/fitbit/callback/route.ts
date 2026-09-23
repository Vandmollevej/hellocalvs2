import { NextRequest, NextResponse } from "next/server";
import { exchangeFitbitCode } from "@/lib/integrations/fitbit";
import { readOAuthState, saveIntegrationTokens } from "@/lib/integrations-oauth";

const STATE_COOKIE = "fitbit_oauth_state";
const DONE_URL = "/settings/integrations";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = readOAuthState(req, STATE_COOKIE);
  const error = req.nextUrl.searchParams.get("error");

  function redirectWithClearedState(query?: string) {
    const url = new URL(DONE_URL, req.url);
    if (query) url.search = query;
    const response = NextResponse.redirect(url);
    response.cookies.delete(STATE_COOKIE);
    return response;
  }

  if (error || !code || !state || !expected || state !== expected.state) {
    return redirectWithClearedState("error=fitbit_authorize_failed");
  }

  try {
    await saveIntegrationTokens("FITBIT", expected.inboxId, await exchangeFitbitCode(code));
  } catch (err) {
    console.error("Fitbit callback failed", err instanceof Error ? err.message : "ukendt");
    return redirectWithClearedState("error=fitbit_token_exchange_failed");
  }

  return redirectWithClearedState("connected=fitbit");
}
