// WHOOP Developer Platform API v2 (OAuth2, developer.whoop.com). Træning,
// søvn og restitution. Appen oprettes selv i WHOOP's Developer Dashboard.
// Env: WHOOP_CLIENT_ID/WHOOP_CLIENT_SECRET.
// Kun læsning, og der bedes ikke om profil-adgang (navn/e-mail): Hello Cal
// sender ingen data om brugeren til WHOOP.

import { whoopItems, type Recovery, type Sleep, type Workout } from "./whoop-items";
import { clientCredentials, getJson, postForm, type OAuthProviderAdapter, type OAuthTokens } from "./types";

const AUTHORIZE_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API = "https://api.prod.whoop.com/developer/v2";
// "offline" giver et refresh-token.
const SCOPES = "offline read:workout read:sleep read:recovery";
const MAX_PAGES = 20;

type Page<T> = { records?: T[]; next_token?: string | null };

async function fetchAll<T>(path: string, accessToken: string, since: Date): Promise<T[]> {
  const records: T[] = [];
  let next: string | null | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${API}${path}`);
    url.searchParams.set("start", since.toISOString());
    url.searchParams.set("limit", "25");
    if (next) url.searchParams.set("nextToken", next);
    const data = await getJson<Page<T>>(url, accessToken, `WHOOP ${path}`);
    records.push(...(data.records ?? []));
    next = data.next_token;
    if (!next) break;
  }
  return records;
}

function tokenRequest(params: Record<string, string>) {
  const { clientId, clientSecret } = clientCredentials("WHOOP");
  return postForm<OAuthTokens>(TOKEN_URL, { client_id: clientId, client_secret: clientSecret, ...params }, "WHOOP token-kald");
}

export const whoop: OAuthProviderAdapter = {
  provider: "WHOOP",
  slug: "whoop",
  label: "WHOOP",
  envPrefix: "WHOOP",
  initialDays: 30,
  buildAuthorizeUrl(state, redirectUri) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientCredentials("WHOOP").clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    return url.toString();
  },
  exchangeCode(code, redirectUri) {
    return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  },
  refresh(refreshToken) {
    return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken, scope: "offline" });
  },
  async revoke(accessToken) {
    const response = await fetch(`${API}/user/access`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok && response.status !== 404) throw new Error(`WHOOP afmelding fejlede (${response.status})`);
  },
  async fetchItems(accessToken, since) {
    const [workouts, sleeps, recoveries] = await Promise.all([
      fetchAll<Workout>("/activity/workout", accessToken, since),
      fetchAll<Sleep>("/activity/sleep", accessToken, since),
      fetchAll<Recovery>("/recovery", accessToken, since),
    ]);
    return whoopItems(workouts, sleeps, recoveries);
  },
};
