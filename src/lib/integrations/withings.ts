// Withings Health API (OAuth2, developer.withings.com). Alt, en tilknyttet
// smart-vægt måler: vægt, højde, fedt, muskler, fedtfri masse, kropsvand,
// knogler, visceralt fedt, puls m.m. (withings-items.ts).
// Env: WITHINGS_CLIENT_ID/WITHINGS_CLIENT_SECRET.

import { WITHINGS_MEASURE, WITHINGS_MEASURE_TYPES, withingsItems, type WithingsMeasureGroup } from "./withings-items";
import { clientCredentials, postForm, type OAuthProviderAdapter, type OAuthTokens } from "./types";

const AUTHORIZE_URL = "https://account.withings.com/oauth2_user/authorize2";
const TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2";
const MEASURE_URL = "https://wbsapi.withings.net/measure";
const SCOPES = "user.info,user.metrics";

type WithingsEnvelope<T> = { status: number; body: T; error?: string };

async function callOAuth(params: Record<string, string>): Promise<OAuthTokens> {
  const { clientId, clientSecret } = clientCredentials("WITHINGS");
  const data = await postForm<WithingsEnvelope<OAuthTokens>>(
    TOKEN_URL,
    { action: "requesttoken", client_id: clientId, client_secret: clientSecret, ...params },
    "Withings token-kald"
  );
  if (data.status !== 0) throw new Error(`Withings returnerede status ${data.status}: ${data.error ?? "ukendt fejl"}`);
  return data.body;
}

type MeasureBody = { measuregrps?: WithingsMeasureGroup[]; more?: number; offset?: number };

// sinceUnixSeconds = null henter hele historikken (bruges til højde, som
// typisk er indtastet i Withings for længe siden).
async function fetchMeasureGroups(accessToken: string, meastypes: readonly number[], sinceUnixSeconds: number | null) {
  const groups: WithingsMeasureGroup[] = [];
  let offset: number | undefined;
  for (let page = 0; page < 20; page++) {
    const params: Record<string, string> = {
      action: "getmeas",
      meastypes: meastypes.join(","),
      category: "1",
    };
    if (sinceUnixSeconds !== null) params.lastupdate = String(sinceUnixSeconds);
    if (offset) params.offset = String(offset);
    const data = await postForm<WithingsEnvelope<MeasureBody>>(MEASURE_URL, params, "Withings måling-opslag", {
      Authorization: `Bearer ${accessToken}`,
    });
    if (data.status !== 0) throw new Error(`Withings returnerede status ${data.status}`);
    groups.push(...(data.body.measuregrps ?? []));
    if (!data.body.more || !data.body.offset) break;
    offset = data.body.offset;
  }
  return groups;
}

export const withings: OAuthProviderAdapter = {
  provider: "WITHINGS",
  slug: "withings",
  label: "Withings",
  envPrefix: "WITHINGS",
  initialDays: 365,
  buildAuthorizeUrl(state, redirectUri) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientCredentials("WITHINGS").clientId);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("redirect_uri", redirectUri);
    return url.toString();
  },
  exchangeCode(code, redirectUri) {
    return callOAuth({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  },
  // Withings udsteder et nyt refresh-token ved hver fornyelse.
  refresh(refreshToken) {
    return callOAuth({ grant_type: "refresh_token", refresh_token: refreshToken });
  },
  async fetchItems(accessToken, since) {
    const [groups, heights] = await Promise.all([
      fetchMeasureGroups(accessToken, WITHINGS_MEASURE_TYPES, Math.floor(since.getTime() / 1000)),
      // Højden er ofte indtastet én gang for år tilbage; hent den altid, så
      // den låste profilhøjde følger Withings (dubletter springes over).
      fetchMeasureGroups(accessToken, [WITHINGS_MEASURE.HEIGHT], null).catch(() => []),
    ]);
    return withingsItems([...groups, ...heights]);
  },
};
