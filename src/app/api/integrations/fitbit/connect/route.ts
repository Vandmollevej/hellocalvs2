import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { buildFitbitAuthorizeUrl, isFitbitConfigured } from "@/lib/integrations/fitbit";

const STATE_COOKIE = "fitbit_oauth_state";

export async function GET() {
  if (!isFitbitConfigured()) {
    return NextResponse.json(
      { message: "FITBIT_CLIENT_ID/FITBIT_CLIENT_SECRET er ikke sat på serveren endnu" },
      { status: 503 }
    );
  }

  const state = randomUUID();
  const response = NextResponse.redirect(buildFitbitAuthorizeUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
