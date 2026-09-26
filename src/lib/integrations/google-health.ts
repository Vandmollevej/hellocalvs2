// Google Health API (health.googleapis.com, v4) — Googles cloud-API, der
// afløser Fitbit Web API (Fitbit, Pixel Watch m.fl.). Ikke det samme som
// Health Connect, der kun kan læses på Android-telefonen.
// Env: GOOGLE_HEALTH_CLIENT_ID/GOOGLE_HEALTH_CLIENT_SECRET (Google Cloud OAuth-klient).

import type { IntegrationItem } from "@/lib/integrations/store-items";
import { DAY_MS, clientCredentials, getJson, postForm, postJson, type OAuthProviderAdapter, type OAuthTokens } from "./types";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://health.googleapis.com/v4/users/me/dataTypes";
const SCOPE = "https://www.googleapis.com/auth/googlehealth";
const READ_SCOPES = [`${SCOPE}.activity_and_fitness.readonly`, `${SCOPE}.health_metrics_and_measurements.readonly`];
// Skriveadgang pr. datatype, der sendes fra Hello Cal (developers.google.com/health/scopes).
const WRITE_SCOPES = {
  nutrition: `${SCOPE}.nutrition.writeonly`,
  water: `${SCOPE}.nutrition.writeonly`,
  weight: `${SCOPE}.health_metrics_and_measurements.writeonly`,
};

type Interval = { startTime: string; endTime: string; startUtcOffset?: string };
type DataPoint = {
  weight?: { sampleTime: { physicalTime: string }; weightGrams: number };
  steps?: { interval: Interval; count: string | number };
  exercise?: {
    interval: Interval;
    exerciseType?: string;
    displayName?: string;
    activeDuration?: string; // fx "3600s"
    metricsSummary?: { caloriesKcal?: number };
  };
};

async function listDataPoints(accessToken: string, dataType: string, filter: string, pageSize: number) {
  const points: DataPoint[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 40; page++) {
    const url = new URL(`${API}/${dataType}/dataPoints`);
    url.searchParams.set("filter", filter);
    url.searchParams.set("pageSize", String(pageSize));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await getJson<{ dataPoints?: DataPoint[]; nextPageToken?: string }>(
      url,
      accessToken,
      `Google Health ${dataType}-opslag`
    );
    points.push(...(data.dataPoints ?? []));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return points;
}

const seconds = (duration: string | undefined) => {
  const match = duration?.match(/^(-?\d+(?:\.\d+)?)s$/);
  return match ? Number(match[1]) : null;
};

async function weights(accessToken: string, since: Date): Promise<IntegrationItem[]> {
  const points = await listDataPoints(
    accessToken,
    "weight",
    `weight.sample_time.physical_time >= "${since.toISOString()}"`,
    1000
  );
  return points.flatMap((p) =>
    p.weight
      ? [
          {
            kind: "weight",
            payload: {
              source: "GOOGLE_HEALTH",
              weightKg: p.weight.weightGrams / 1000,
              weighedAt: new Date(p.weight.sampleTime.physicalTime).toISOString(),
            },
          },
        ]
      : []
  );
}

async function exercises(accessToken: string, since: Date): Promise<IntegrationItem[]> {
  const points = await listDataPoints(accessToken, "exercise", `exercise.interval.start_time >= "${since.toISOString()}"`, 25);
  return points.flatMap((p) => {
    const e = p.exercise;
    if (!e) return [];
    const start = new Date(e.interval.startTime);
    const durationSeconds = seconds(e.activeDuration) ?? (new Date(e.interval.endTime).getTime() - start.getTime()) / 1000;
    return [
      {
        kind: "activity",
        payload: {
          source: "GOOGLE_HEALTH",
          sportType: (e.displayName || e.exerciseType || "exercise").toLowerCase(),
          startedAt: start.toISOString(),
          durationMinutes: Math.round(durationSeconds / 60),
          caloriesBurned: Math.round(e.metricsSummary?.caloriesKcal ?? 0),
        },
      },
    ];
  });
}

// Skridt kommer som mange korte intervaller; de lægges sammen pr. lokal dag.
// Første (muligvis ufuldstændige) dag springes over, så en senere
// synkronisering aldrig overskriver en hel dag med en delvis sum.
async function dailySteps(accessToken: string, since: Date): Promise<IntegrationItem[]> {
  const from = new Date(Math.floor(since.getTime() / DAY_MS) * DAY_MS - DAY_MS);
  const points = await listDataPoints(accessToken, "steps", `steps.interval.start_time >= "${from.toISOString()}"`, 10000);
  const byDay = new Map<string, number>();
  for (const p of points) {
    if (!p.steps) continue;
    const offset = seconds(p.steps.interval.startUtcOffset) ?? 0;
    const day = new Date(new Date(p.steps.interval.startTime).getTime() + offset * 1000).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + Number(p.steps.count));
  }
  const days = [...byDay.keys()].sort().slice(1);
  return days.map((day) => ({
    kind: "metric",
    payload: { source: "GOOGLE_HEALTH", type: "STEPS", value: byDay.get(day), recordedAt: `${day}T00:00:00.000Z` },
  }));
}

export const googleHealth: OAuthProviderAdapter = {
  provider: "GOOGLE_HEALTH",
  slug: "google-health",
  label: "Google Health",
  envPrefix: "GOOGLE_HEALTH",
  initialDays: 90,
  buildAuthorizeUrl(state, redirectUri, settings) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", clientCredentials("GOOGLE_HEALTH").clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    const writes = Object.entries(WRITE_SCOPES).filter(([type]) => settings.write[type as keyof typeof WRITE_SCOPES]);
    url.searchParams.set("scope", [...new Set([...READ_SCOPES, ...writes.map(([, scope]) => scope)])].join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return url.toString();
  },
  exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = clientCredentials("GOOGLE_HEALTH");
    return postForm<OAuthTokens>(
      TOKEN_URL,
      { code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" },
      "Google token-udveksling"
    );
  },
  // Google returnerer normalt ikke et nyt refresh-token; det gamle beholdes.
  refresh(refreshToken) {
    const { clientId, clientSecret } = clientCredentials("GOOGLE_HEALTH");
    return postForm<OAuthTokens>(
      TOKEN_URL,
      { refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" },
      "Google token-fornyelse"
    );
  },
  // Brugeren kan fravælge enkelte tilladelser; hver datatype hentes for sig,
  // og kun hvis alle fejler, regnes synkroniseringen som fejlet.
  async fetchItems(accessToken, since) {
    const results = await Promise.allSettled([
      weights(accessToken, since),
      exercises(accessToken, since),
      dailySteps(accessToken, since),
    ]);
    const ok = results.filter((r): r is PromiseFulfilledResult<IntegrationItem[]> => r.status === "fulfilled");
    if (ok.length === 0) throw (results[0] as PromiseRejectedResult).reason;
    return ok.flatMap((r) => r.value);
  },
  writeScopes: WRITE_SCOPES,
  // Måltider som nutrition-log, vand som hydration-log og manuelle
  // vejninger som weight (developers.google.com/health/data-types/nutrition).
  async push(accessToken, data) {
    const post = (dataType: string, body: unknown) =>
      postJson(`${API}/${dataType}/dataPoints`, accessToken, body, `Google Health ${dataType}-skrivning`);
    let sent = 0;
    for (const n of data.nutrition) {
      const start = new Date(n.loggedAt);
      await post("nutrition-log", {
        nutritionLog: {
          interval: { startTime: start.toISOString(), endTime: new Date(start.getTime() + 1000).toISOString() },
          foodDisplayName: n.title,
          energy: { kcal: n.kcal },
          totalCarbohydrate: { grams: n.carbsG },
          totalFat: { grams: n.fatG },
          nutrients: [{ nutrient: "PROTEIN", quantity: { grams: n.proteinG } }],
          serving: { amount: 1 },
        },
      });
      sent++;
    }
    for (const w of data.water) {
      const start = new Date(w.loggedAt);
      await post("hydration-log", {
        hydrationLog: {
          interval: { startTime: start.toISOString(), endTime: new Date(start.getTime() + 1000).toISOString() },
          amountConsumed: { milliliters: w.ml },
        },
      });
      sent++;
    }
    for (const w of data.weights) {
      await post("weight", { weight: { sampleTime: { physicalTime: w.weighedAt }, weightGrams: Math.round(w.weightKg * 1000) } });
      sent++;
    }
    return sent;
  },
};
