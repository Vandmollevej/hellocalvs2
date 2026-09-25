// Fitbit Web API (OAuth2, dev.fitbit.com). Afløses af Google Health API;
// vises kun for brugere, der allerede har Fitbit forbundet.
// Env: FITBIT_CLIENT_ID/FITBIT_CLIENT_SECRET.

import type { InboxEnvelope } from "@/lib/vault/inbox-delivery";
import { basicAuth, clientCredentials, getJson, postForm, type OAuthProviderAdapter, type OAuthTokens } from "./types";

const AUTHORIZE_URL = "https://www.fitbit.com/oauth2/authorize";
const TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const SCOPES = "activity weight profile";

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

type ActivityLog = {
  activityName: string;
  startTime: string;
  originalStartTime?: string;
  duration: number; // ms
  calories: number;
};
type WeightLog = { date: string; time: string; weight: number };

export const fitbit: OAuthProviderAdapter = {
  provider: "FITBIT",
  slug: "fitbit",
  label: "Fitbit",
  envPrefix: "FITBIT",
  initialDays: 30,
  buildAuthorizeUrl(state, redirectUri) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", clientCredentials("FITBIT").clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  },
  exchangeCode(code, redirectUri) {
    return postForm<OAuthTokens>(
      TOKEN_URL,
      { client_id: clientCredentials("FITBIT").clientId, grant_type: "authorization_code", code, redirect_uri: redirectUri },
      "Fitbit token-udveksling",
      { Authorization: basicAuth("FITBIT") }
    );
  },
  refresh(refreshToken) {
    return postForm<OAuthTokens>(
      TOKEN_URL,
      { grant_type: "refresh_token", refresh_token: refreshToken },
      "Fitbit token-fornyelse",
      { Authorization: basicAuth("FITBIT") }
    );
  },
  async fetchItems(accessToken, since) {
    const activitiesUrl = new URL("https://api.fitbit.com/1/user/-/activities/list.json");
    activitiesUrl.searchParams.set("afterDate", formatDate(since));
    activitiesUrl.searchParams.set("sort", "asc");
    activitiesUrl.searchParams.set("offset", "0");
    activitiesUrl.searchParams.set("limit", "100");
    const weightUrl = `https://api.fitbit.com/1/user/-/body/log/weight/date/${formatDate(since)}/${formatDate(new Date())}.json`;

    const [activities, weights] = await Promise.all([
      getJson<{ activities?: ActivityLog[] }>(activitiesUrl, accessToken, "Fitbit aktivitets-opslag"),
      getJson<{ weight?: WeightLog[] }>(weightUrl, accessToken, "Fitbit vægt-opslag"),
    ]);

    const items: InboxEnvelope[] = [
      ...(activities.activities ?? []).map((log) => ({
        kind: "activity",
        payload: {
          source: "FITBIT",
          sportType: log.activityName.toLowerCase(),
          startedAt: new Date(log.originalStartTime ?? log.startTime).toISOString(),
          durationMinutes: Math.round(log.duration / 60000),
          caloriesBurned: log.calories,
        },
      })),
      ...(weights.weight ?? []).map((log) => ({
        kind: "weight",
        payload: { source: "FITBIT", weightKg: log.weight, weighedAt: new Date(`${log.date}T${log.time}`).toISOString() },
      })),
    ];
    return items;
  },
};
