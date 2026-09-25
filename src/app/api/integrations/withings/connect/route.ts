import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { buildWithingsAuthorizeUrl, isWithingsConfigured } from "@/lib/integrations/withings";

const STATE_COOKIE = "withings_oauth_state";

export async function GET() {
  if (!isWithingsConfigured()) {
    return NextResponse.json(
      { message: "WITHINGS_CLIENT_ID/WITHINGS_CLIENT_SECRET er ikke sat på serveren endnu" },
      { status: 503 }
    );
  }

  const state = randomUUID();
  const response = NextResponse.redirect(buildWithingsAuthorizeUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
