import { NextResponse, type NextRequest } from "next/server";
import { buildFitbitAuthorizeUrl, isFitbitConfigured } from "@/lib/integrations/fitbit";
import { isValidInbox, newOAuthState, setOAuthCookie } from "@/lib/integrations-oauth";
import { getSessionUser } from "@/lib/session";

const STATE_COOKIE = "fitbit_oauth_state";

// GET ?inbox=<VaultInbox.id> — starter OAuth. Indbakken er oprettet af
// klienten (docs/PRIVACY.md), så hentede data kan forsegles til boksen.
export async function GET(req: NextRequest) {
  if (!isFitbitConfigured()) {
    return NextResponse.json(
      { message: "FITBIT_CLIENT_ID/FITBIT_CLIENT_SECRET er ikke sat på serveren endnu" },
      { status: 503 }
    );
  }
  if (!(await getSessionUser())) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
  const inboxId = req.nextUrl.searchParams.get("inbox");
  if (!(await isValidInbox(inboxId))) return NextResponse.json({ message: "inbox mangler" }, { status: 400 });

  const state = newOAuthState();
  const response = NextResponse.redirect(buildFitbitAuthorizeUrl(state));
  setOAuthCookie(response, STATE_COOKIE, { state, inboxId: inboxId as string });
  return response;
}
