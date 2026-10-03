// Garmin Connect Developer Program — Health API + Activity API (OAuth 2.0 med
// PKCE). Kræver godkendelse som Garmin-partner; nøglerne fås først derefter.
// Env: GARMIN_CLIENT_ID/GARMIN_CLIENT_SECRET.
//
// Garmin sender en ping-notifikation til /api/integrations/garmin/webhook,
// når der er nye data (src/lib/integrations/garmin-webhook.ts). Den
// almindelige synkronisering henter desuden de seneste døgn efter
// upload-tidspunkt, så intet går tabt, hvis en ping udebliver.
// Kun læsning: Hello Cal sender ingen data om brugeren til Garmin.
//
// Feltnavne følger Garmins Health API-dokumentation; de er ikke prøvet mod
// et live-API endnu (fejl tåles pr. datatype).

import type { IntegrationItem } from "@/lib/integrations/store-items";
import { GARMIN_SUMMARY_KINDS, garminItems } from "./garmin-items";
import { DAY_MS, clientCredentials, getJson, postForm, type OAuthProviderAdapter, type OAuthTokens } from "./types";

const AUTHORIZE_URL = "https://connect.garmin.com/oauth2Confirm";
const TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
export const GARMIN_API = "https://apis.garmin.com/wellness-api/rest";

// Garmin tillader højst 24 timers upload-vindue pr. kald.
const WINDOW_SECONDS = 86_400;
// Den almindelige synkronisering henter højst så mange døgn tilbage; ældre
// data kommer via backfill (pings) efter tilkobling.
const MAX_PULL_DAYS = 3;

function tokenRequest(params: Record<string, string>) {
  const { clientId, clientSecret } = clientCredentials("GARMIN");
  return postForm<OAuthTokens>(TOKEN_URL, { client_id: clientId, client_secret: clientSecret, ...params }, "Garmin token-kald");
}

export const garmin: OAuthProviderAdapter = {
  provider: "GARMIN",
  slug: "garmin",
  label: "Garmin",
  envPrefix: "GARMIN",
  initialDays: MAX_PULL_DAYS,
  pkce: true,
  buildAuthorizeUrl(state, redirectUri, _settings, codeChallenge) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientCredentials("GARMIN").clientId);
    url.searchParams.set("code_challenge", codeChallenge ?? "");
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  },
  exchangeCode(code, redirectUri, codeVerifier) {
    return tokenRequest({ grant_type: "authorization_code", code, code_verifier: codeVerifier ?? "", redirect_uri: redirectUri });
  },
  refresh(refreshToken) {
    return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  },
  // Garmins bruger-ID er pseudonymt; det bruges kun til at koble pings til
  // den rigtige bruger. Bagefter bedes om historik (leveres via pings).
  async afterConnect(tokens) {
    const { userId } = await getJson<{ userId?: string }>(`${GARMIN_API}/user/id`, tokens.access_token, "Garmin bruger-ID");
    const end = Math.floor(Date.now() / 1000);
    const start = end - 30 * 86_400;
    await Promise.all(
      GARMIN_SUMMARY_KINDS.map((kind) =>
        fetch(`${GARMIN_API}/backfill/${kind}?summaryStartTimeInSeconds=${start}&summaryEndTimeInSeconds=${end}`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }).catch(() => null)
      )
    );
    return { externalUserId: userId };
  },
  async revoke(accessToken) {
    const response = await fetch(`${GARMIN_API}/user/registration`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok && response.status !== 404) throw new Error(`Garmin afmelding fejlede (${response.status})`);
  },
  async fetchItems(accessToken, since) {
    const end = Math.floor(Date.now() / 1000);
    const start = Math.max(Math.floor(since.getTime() / 1000), end - Math.round((MAX_PULL_DAYS * DAY_MS) / 1000));
    const items: IntegrationItem[] = [];
    for (const kind of GARMIN_SUMMARY_KINDS) {
      for (let from = start; from < end; from += WINDOW_SECONDS) {
        const to = Math.min(from + WINDOW_SECONDS, end);
        const url = `${GARMIN_API}/${kind}?uploadStartTimeInSeconds=${from}&uploadEndTimeInSeconds=${to}`;
        const records = await getJson<unknown[]>(url, accessToken, `Garmin ${kind}`).catch((error) => {
          console.error(`Garmin ${kind} fejlede`, error instanceof Error ? error.message : "ukendt");
          return [];
        });
        items.push(...garminItems(kind, Array.isArray(records) ? records : []));
      }
    }
    return items;
  },
};
