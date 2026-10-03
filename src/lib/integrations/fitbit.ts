// Fitbit Web API (OAuth2, dev.fitbit.com). Afløses af Google Health API;
// vises kun for brugere, der allerede har Fitbit forbundet.
// Env: FITBIT_CLIENT_ID/FITBIT_CLIENT_SECRET.

import type { IntegrationItem } from "@/lib/integrations/store-items";
import { fitbitSeriesItems, fitbitSleepItems, type FitbitSeriesPoint, type FitbitSleep } from "./fitbit-items";
import { basicAuth, clientCredentials, getJson, postForm, type OAuthProviderAdapter, type OAuthTokens } from "./types";

const AUTHORIZE_URL = "https://www.fitbit.com/oauth2/authorize";
const TOKEN_URL = "https://api.fitbit.com/oauth2/token";
// heartrate, sleep, oxygen_saturation, respiratory_rate og cardio_fitness kom
// til 2026-10-03; ældre forbindelser skal forbinde igen for at få dem med.
const SCOPES = "activity weight profile heartrate sleep oxygen_saturation respiratory_rate cardio_fitness";
const API = "https://api.fitbit.com";

type Series = Record<string, FitbitSeriesPoint[] | undefined>;
type Value = Record<string, unknown> | undefined;
const field = (name: string) => (value: unknown) => (value as Value)?.[name];

// Dagsserier: [URL-sti, svarnøgle, Hello Cal-type, felt i value, skala].
const DAY_SERIES: [string, string, string, ((value: unknown) => unknown)?, number?][] = [
  ["1/user/-/activities/steps", "activities-steps", "STEPS"],
  ["1/user/-/activities/distance", "activities-distance", "DISTANCE_KM"],
  ["1/user/-/activities/floors", "activities-floors", "FLOORS_CLIMBED"],
  ["1/user/-/activities/activityCalories", "activities-activityCalories", "ACTIVE_ENERGY_KCAL"],
  ["1/user/-/activities/heart", "activities-heart", "RESTING_HEART_RATE_BPM", field("restingHeartRate")],
  ["1/user/-/activities/active-zone-minutes", "activities-active-zone-minutes", "ACTIVE_ZONE_MINUTES", field("activeZoneMinutes")],
  ["1/user/-/hrv", "hrv", "HEART_RATE_VARIABILITY_MS", field("dailyRmssd")],
  ["1/user/-/br", "br", "RESPIRATORY_RATE_BPM", field("breathingRate")],
  ["1/user/-/cardioscore", "cardioScore", "VO2_MAX", field("vo2Max")],
];

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

type ActivityLog = {
  activityName: string;
  startTime: string;
  originalStartTime?: string;
  duration: number; // ms
  calories: number;
};
type WeightLog = { date: string; time: string; weight: number; bmi?: number };

export const fitbit: OAuthProviderAdapter = {
  provider: "FITBIT",
  // Flere måletyper end før (2026-10-03): hent hele historikken igen én gang.
  fetchVersion: 1,
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
  readScopes: { heart: "heartrate", sleep: "sleep" },
  async fetchItems(accessToken, since) {
    const activitiesUrl = new URL("https://api.fitbit.com/1/user/-/activities/list.json");
    activitiesUrl.searchParams.set("afterDate", formatDate(since));
    activitiesUrl.searchParams.set("sort", "asc");
    activitiesUrl.searchParams.set("offset", "0");
    activitiesUrl.searchParams.set("limit", "100");
    const weightUrl = `https://api.fitbit.com/1/user/-/body/log/weight/date/${formatDate(since)}/${formatDate(new Date())}.json`;

    const fatUrl = `https://api.fitbit.com/1/user/-/body/log/fat/date/${formatDate(since)}/${formatDate(new Date())}.json`;

    const [activities, weights, fats] = await Promise.all([
      getJson<{ activities?: ActivityLog[] }>(activitiesUrl, accessToken, "Fitbit aktivitets-opslag"),
      getJson<{ weight?: WeightLog[] }>(weightUrl, accessToken, "Fitbit vægt-opslag"),
      // Fedtprocent er valgfri (kræver en Aria-vægt/manuel log) — fejl må ikke vælte synkroniseringen.
      getJson<{ fat?: { date: string; time: string; fat: number }[] }>(fatUrl, accessToken, "Fitbit fedt-opslag").catch(() => ({
        fat: [],
      })),
    ]);

    const range = `${formatDate(since)}/${formatDate(new Date())}`;
    // Hver serie for sig: mangler en tilladelse eller en enhed, fejler kun den.
    const optional = <T>(url: string, what: string, fallback: T) => getJson<T>(url, accessToken, what).catch(() => fallback);
    const [series, sleep, spo2] = await Promise.all([
      Promise.all(
        DAY_SERIES.map(([path, key, type, pick, scale]) =>
          optional<Series>(`${API}/${path}/date/${range}.json`, `Fitbit ${key}`, {}).then((data) =>
            fitbitSeriesItems(type, data[key], pick, scale)
          )
        )
      ),
      optional<{ sleep?: FitbitSleep[] }>(`${API}/1.2/user/-/sleep/date/${range}.json`, "Fitbit søvn", {}),
      optional<FitbitSeriesPoint[]>(`${API}/1/user/-/spo2/date/${range}.json`, "Fitbit SpO2", []),
    ]);

    const items: IntegrationItem[] = [
      ...series.flat(),
      ...fitbitSleepItems(sleep.sleep),
      ...fitbitSeriesItems("OXYGEN_SATURATION_PERCENT", Array.isArray(spo2) ? spo2 : [], field("avg")),
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
      ...(weights.weight ?? []).flatMap((log) =>
        log.bmi
          ? [{ kind: "metric", payload: { source: "FITBIT", type: "BMI", value: log.bmi, recordedAt: new Date(`${log.date}T${log.time}`).toISOString() } }]
          : []
      ),
      ...(fats.fat ?? []).map((log) => ({
        kind: "metric",
        payload: {
          source: "FITBIT",
          type: "BODY_FAT_PERCENT",
          value: log.fat,
          recordedAt: new Date(`${log.date}T${log.time}`).toISOString(),
        },
      })),
    ];
    return items;
  },
};
