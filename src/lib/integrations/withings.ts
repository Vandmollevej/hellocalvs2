// Withings Health API (OAuth2, developer.withings.com). Vægt og fedtprocent
// fra en tilknyttet smart-vægt. Env: WITHINGS_CLIENT_ID/WITHINGS_CLIENT_SECRET.

import type { InboxEnvelope } from "@/lib/vault/inbox-delivery";
import { clientCredentials, postForm, type OAuthProviderAdapter, type OAuthTokens } from "./types";

const AUTHORIZE_URL = "https://account.withings.com/oauth2_user/authorize2";
const TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2";
const MEASURE_URL = "https://wbsapi.withings.net/measure";
const SCOPES = "user.info,user.metrics";

// Withings-måletyper: 1 = vægt (kg), 6 = fedtprocent. Værdi = value * 10^unit.
const WEIGHT = 1;
const FAT_RATIO = 6;

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

type MeasureGroup = { date: number; measures: { value: number; type: number; unit: number }[] };
type MeasureBody = { measuregrps?: MeasureGroup[]; more?: number; offset?: number };

async function fetchMeasureGroups(accessToken: string, sinceUnixSeconds: number) {
  const groups: MeasureGroup[] = [];
  let offset: number | undefined;
  for (let page = 0; page < 20; page++) {
    const params: Record<string, string> = {
      action: "getmeas",
      meastypes: `${WEIGHT},${FAT_RATIO}`,
      category: "1",
      lastupdate: String(sinceUnixSeconds),
    };
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
    const groups = await fetchMeasureGroups(accessToken, Math.floor(since.getTime() / 1000));
    const items: InboxEnvelope[] = [];
    for (const group of groups) {
      const at = new Date(group.date * 1000).toISOString();
      for (const m of group.measures) {
        const value = m.value * Math.pow(10, m.unit);
        if (m.type === WEIGHT) {
          items.push({ kind: "weight", payload: { source: "WITHINGS", weightKg: value, weighedAt: at } });
        } else if (m.type === FAT_RATIO) {
          items.push({ kind: "metric", payload: { source: "WITHINGS", type: "BODY_FAT_PERCENT", value, recordedAt: at } });
        }
      }
    }
    return items;
  },
};
