// Withings Health API (OAuth2, developer.withings.com). Alt, Withings kan
// levere (2026-10-03): vægt og hele kropssammensætningen (fedtprocent,
// fedtmasse, muskel-, knogle- og vandmasse, visceralt fedt, BMR, metabolisk
// alder …), blodtryk, puls, SpO2, temperatur, karstivhed og EKG-intervaller
// samt dagsaktivitet, søvn og træning fra ure og søvnmåler.
// Env: WITHINGS_CLIENT_ID/WITHINGS_CLIENT_SECRET.

import type { IntegrationItem } from "@/lib/integrations/store-items";
import {
  WITHINGS_HEIGHT,
  WITHINGS_MEASURE_TYPES,
  withingsActivityItems,
  withingsMeasureItems,
  withingsSleepItems,
  withingsWorkoutItems,
  type WithingsActivity,
  type WithingsMeasureGroup,
  type WithingsSleep,
  type WithingsWorkout,
} from "./withings-items";
import { clientCredentials, postForm, type OAuthProviderAdapter, type OAuthTokens } from "./types";

const AUTHORIZE_URL = "https://account.withings.com/oauth2_user/authorize2";
const TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2";
const MEASURE_URL = "https://wbsapi.withings.net/measure";
const MEASURE_V2_URL = "https://wbsapi.withings.net/v2/measure";
const SLEEP_V2_URL = "https://wbsapi.withings.net/v2/sleep";
// user.activity giver aktivitet, søvn og træning. Brugere, der forbandt før
// 2026-10-03, har kun user.metrics og skal forbinde igen for at få dem med.
const SCOPES = "user.info,user.metrics,user.activity";
const MAX_PAGES = 20;

const ACTIVITY_FIELDS = "steps,distance,elevation,soft,moderate,intense,calories,hr_average,hr_min,hr_max";
const SLEEP_FIELDS = [
  "total_sleep_time",
  "total_timeinbed",
  "deepsleepduration",
  "lightsleepduration",
  "remsleepduration",
  "wakeupduration",
  "wakeupcount",
  "sleep_efficiency",
  "sleep_score",
  "rr_average",
].join(",");
const WORKOUT_FIELDS = "calories";

type WithingsEnvelope<T> = { status: number; body: T; error?: string };
type Paged = { more?: boolean | number; offset?: number };

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

// Henter alle sider af et Withings-kald (more/offset).
async function fetchPages<T extends Paged, R>(
  url: string,
  params: Record<string, string>,
  accessToken: string,
  what: string,
  pick: (body: T) => R[] | undefined
): Promise<R[]> {
  const rows: R[] = [];
  let offset: number | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await postForm<WithingsEnvelope<T>>(url, offset ? { ...params, offset: String(offset) } : params, what, {
      Authorization: `Bearer ${accessToken}`,
    });
    if (data.status !== 0) throw new Error(`${what}: Withings returnerede status ${data.status}`);
    rows.push(...(pick(data.body) ?? []));
    if (!data.body.more || !data.body.offset) break;
    offset = data.body.offset;
  }
  return rows;
}

const ymd = (date: Date) => date.toISOString().slice(0, 10);

export const withings: OAuthProviderAdapter = {
  provider: "WITHINGS",
  // Flere måletyper end før (2026-10-03): hent hele historikken igen én gang.
  fetchVersion: 1,
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
  readScopes: { activities: "user.activity", steps: "user.activity", energy: "user.activity", sleep: "user.activity" },
  // Målinger, aktivitet, søvn og træning hentes hver for sig: mangler
  // user.activity (ældre forbindelser), kommer målingerne stadig ind. Kun hvis
  // alt fejler, regnes synkroniseringen som fejlet.
  async fetchItems(accessToken, since) {
    const range = { startdateymd: ymd(since), enddateymd: ymd(new Date()) };
    const results = await Promise.allSettled([
      fetchPages<Paged & { measuregrps?: WithingsMeasureGroup[] }, WithingsMeasureGroup>(
        MEASURE_URL,
        { action: "getmeas", meastypes: WITHINGS_MEASURE_TYPES.join(","), category: "1", lastupdate: String(Math.floor(since.getTime() / 1000)) },
        accessToken,
        "Withings måling-opslag",
        (body) => body.measuregrps
      ).then(withingsMeasureItems),
      // Højden er ofte indtastet én gang for år tilbage; hent den altid uden
      // tidsgrænse, så den låste profilhøjde følger Withings (dubletter
      // springes over).
      fetchPages<Paged & { measuregrps?: WithingsMeasureGroup[] }, WithingsMeasureGroup>(
        MEASURE_URL,
        { action: "getmeas", meastypes: String(WITHINGS_HEIGHT), category: "1" },
        accessToken,
        "Withings højde-opslag",
        (body) => body.measuregrps
      ).then(withingsMeasureItems),
      fetchPages<Paged & { activities?: WithingsActivity[] }, WithingsActivity>(
        MEASURE_V2_URL,
        { action: "getactivity", data_fields: ACTIVITY_FIELDS, ...range },
        accessToken,
        "Withings aktivitets-opslag",
        (body) => body.activities
      ).then(withingsActivityItems),
      fetchPages<Paged & { series?: WithingsSleep[] }, WithingsSleep>(
        SLEEP_V2_URL,
        { action: "getsummary", data_fields: SLEEP_FIELDS, ...range },
        accessToken,
        "Withings søvn-opslag",
        (body) => body.series
      ).then(withingsSleepItems),
      fetchPages<Paged & { series?: WithingsWorkout[] }, WithingsWorkout>(
        MEASURE_V2_URL,
        { action: "getworkouts", data_fields: WORKOUT_FIELDS, ...range },
        accessToken,
        "Withings trænings-opslag",
        (body) => body.series
      ).then(withingsWorkoutItems),
    ]);
    const ok = results.filter((r): r is PromiseFulfilledResult<IntegrationItem[]> => r.status === "fulfilled");
    for (const r of results) {
      if (r.status === "rejected") console.error("Withings-delopslag fejlede", r.reason instanceof Error ? r.reason.message : "ukendt");
    }
    if (ok.length === 0) throw (results[0] as PromiseRejectedResult).reason;
    return ok.flatMap((r) => r.value);
  },
};
