// Strava API v3 (OAuth2, developers.strava.com). Træningspas.
// Env: STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET.

import type { IntegrationItem } from "@/lib/integrations/store-items";
import { getSportMeta } from "@/lib/sport-icons";
import { clientCredentials, getJson, postForm, type OAuthProviderAdapter, type OAuthTokens } from "./types";

const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API = "https://www.strava.com/api/v3";
// Hello Cal-sportstyper (src/lib/sport-icons.ts) → Stravas sport_type.
const STRAVA_SPORT: Record<string, string> = {
  running: "Run",
  cycling: "Ride",
  walking: "Walk",
  swimming: "Swim",
  ski: "NordicSki",
  strength: "WeightTraining",
  yoga: "Yoga",
  football: "Soccer",
  cardio: "Workout",
};
// Strava vil have lokal tid uden zone; Hello Cal er en dansk app.
const localTime = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen", dateStyle: "short", timeStyle: "medium" })
    .format(new Date(iso))
    .replace(" ", "T");
// Strava tillader 100 kald pr. 15 min; detaljeopslag for kalorier begrænses.
const MAX_DETAIL_LOOKUPS = 20;

type SummaryActivity = {
  id: number;
  sport_type?: string;
  type?: string;
  start_date: string;
  moving_time: number;
  kilojoules?: number;
};

async function tokenCall(params: Record<string, string>) {
  const { clientId, clientSecret } = clientCredentials("STRAVA");
  return postForm<OAuthTokens>(TOKEN_URL, { client_id: clientId, client_secret: clientSecret, ...params }, "Strava token-kald");
}

export const strava: OAuthProviderAdapter = {
  provider: "STRAVA",
  slug: "strava",
  label: "Strava",
  envPrefix: "STRAVA",
  initialDays: 90,
  buildAuthorizeUrl(state, redirectUri, settings) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", clientCredentials("STRAVA").clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("approval_prompt", "auto");
    url.searchParams.set("scope", settings.write.activities ? "activity:read_all,activity:write" : "activity:read_all");
    url.searchParams.set("state", state);
    return url.toString();
  },
  exchangeCode(code) {
    return tokenCall({ code, grant_type: "authorization_code" });
  },
  refresh(refreshToken) {
    return tokenCall({ refresh_token: refreshToken, grant_type: "refresh_token" });
  },
  async fetchItems(accessToken, since) {
    const activities: SummaryActivity[] = [];
    for (let page = 1; page <= 10; page++) {
      const url = new URL(`${API}/athlete/activities`);
      url.searchParams.set("after", String(Math.floor(since.getTime() / 1000)));
      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      const batch = await getJson<SummaryActivity[]>(url, accessToken, "Strava aktivitets-opslag");
      activities.push(...batch);
      if (batch.length < 100) break;
    }

    let lookups = 0;
    const items: IntegrationItem[] = [];
    for (const a of activities) {
      // Stravas oversigt har kun kalorier via kilojoule (cykling); ellers
      // hentes detaljen, der har "calories".
      let calories = a.kilojoules;
      if (calories === undefined && lookups < MAX_DETAIL_LOOKUPS) {
        lookups++;
        const detail = await getJson<{ calories?: number }>(`${API}/activities/${a.id}`, accessToken, "Strava detalje-opslag").catch(
          () => null
        );
        calories = detail?.calories;
      }
      items.push({
        kind: "activity",
        payload: {
          source: "STRAVA",
          sportType: (a.sport_type ?? a.type ?? "workout").toLowerCase(),
          startedAt: new Date(a.start_date).toISOString(),
          durationMinutes: Math.round(a.moving_time / 60),
          caloriesBurned: Math.round(calories ?? 0),
        },
      });
    }
    return items;
  },
  writeScopes: { activities: "activity:write" },
  // Træning, brugeren har registreret i Hello Cal, oprettes som manuelle
  // aktiviteter i Strava (POST /activities).
  async push(accessToken, data) {
    let sent = 0;
    for (const a of data.activities) {
      const response = await fetch(`${API}/activities`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          name: `${getSportMeta(a.sportType).label} (Hello Cal)`,
          sport_type: STRAVA_SPORT[a.sportType] ?? "Workout",
          start_date_local: localTime(a.startedAt),
          elapsed_time: String(Math.max(60, a.durationMinutes * 60)),
          description: `${a.caloriesBurned} kcal · registreret i Hello Cal`,
        }),
      });
      if (!response.ok) throw new Error(`Strava aktivitets-oprettelse fejlede (${response.status}): ${(await response.text()).slice(0, 300)}`);
      sent++;
    }
    return sent;
  },
};
