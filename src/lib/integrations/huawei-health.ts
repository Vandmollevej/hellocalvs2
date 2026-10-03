// HUAWEI Health Kit REST API (OAuth2 med HUAWEI ID). Skridt, distance,
// forbrænding, hvilepuls, vægt/kropssammensætning, søvn og træning fra
// Huawei Health (ure, bånd og vægte). Kræver en app i AppGallery Connect med
// godkendt Health Kit-adgang til de læse-scopes, der bruges her.
// Env: HUAWEI_HEALTH_CLIENT_ID/HUAWEI_HEALTH_CLIENT_SECRET, evt.
// HUAWEI_HEALTH_API_BASE (Huawei kræver, at kaldet går til brugerens region).
// Kun læsning: Hello Cal sender ingen data om brugeren til Huawei.
//
// Datatype- og feltnavne følger Huaweis dokumentation, men er ikke prøvet mod
// et live-API endnu (fejl tåles pr. datatype).

import { randomUUID } from "crypto";
import type { IntegrationItem } from "@/lib/integrations/store-items";
import {
  huaweiActivityItems,
  huaweiDailyItems,
  huaweiSleepItems,
  huaweiTimeZone,
  huaweiWeightItems,
  yyyymmdd,
  type ActivityRecord,
  type Group,
  type HealthRecord,
} from "./huawei-items";
import { DAY_MS, clientCredentials, postForm, type OAuthProviderAdapter, type OAuthTokens } from "./types";

const AUTHORIZE_URL = "https://oauth-login.cloud.huawei.com/oauth2/v3/authorize";
const TOKEN_URL = "https://oauth-login.cloud.huawei.com/oauth2/v3/token";
const REVOKE_URL = "https://oauth-login.cloud.huawei.com/oauth2/v3/revoke";
const apiBase = () => (process.env.HUAWEI_HEALTH_API_BASE || "https://health-api.cloud.huawei.com/healthkit/v2").replace(/\/$/, "");

const SCOPES = ["step", "distance", "calories", "heartrate", "bodyweight", "sleep", "activityrecord"]
  .map((name) => `https://www.huawei.com/healthkit/${name}.read`)
  .join(" ");

async function call<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json;charset=utf-8",
      "x-client-id": clientCredentials("HUAWEI_HEALTH").clientId,
      "x-version": "1.0.0",
      "x-caller-trace-id": randomUUID(),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Huawei ${path} fejlede (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T;
}

// Fejl i én datatype stopper ikke resten.
async function tolerant<T>(what: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`Huawei ${what} fejlede`, error instanceof Error ? error.message : "ukendt");
    return fallback;
  }
}

// Dagssummer: skridt, distance, forbrænding og hvilepuls.
const DAILY_TYPES: { dataType: string; metric: string; fields: string[]; scale?: number }[] = [
  { dataType: "com.huawei.continuous.steps.delta", metric: "STEPS", fields: ["steps"] },
  { dataType: "com.huawei.continuous.distance.delta", metric: "DISTANCE_KM", fields: ["distance"], scale: 1 / 1000 },
  { dataType: "com.huawei.continuous.calories.burnt", metric: "ACTIVE_ENERGY_KCAL", fields: ["calories"] },
  { dataType: "com.huawei.instantaneous.resting_heart_rate", metric: "RESTING_HEART_RATE_BPM", fields: ["avg", "resting_heart_rate"] },
];

function tokenRequest(params: Record<string, string>) {
  const { clientId, clientSecret } = clientCredentials("HUAWEI_HEALTH");
  return postForm<OAuthTokens>(TOKEN_URL, { client_id: clientId, client_secret: clientSecret, ...params }, "Huawei token-kald");
}

export const huaweiHealth: OAuthProviderAdapter = {
  provider: "HUAWEI_HEALTH",
  slug: "huawei-health",
  label: "Huawei Health",
  envPrefix: "HUAWEI_HEALTH",
  initialDays: 30,
  buildAuthorizeUrl(state, redirectUri) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("client_id", clientCredentials("HUAWEI_HEALTH").clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    return url.toString();
  },
  exchangeCode(code, redirectUri) {
    return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  },
  refresh(refreshToken) {
    return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  },
  async revoke(accessToken) {
    await postForm<unknown>(REVOKE_URL, { token: accessToken }, "Huawei afmelding").catch(() => {});
  },
  async fetchItems(accessToken, since) {
    const now = new Date();
    // Huawei begrænser dagsopslag; højst 30 dage pr. kald.
    const from = new Date(Math.max(since.getTime(), now.getTime() - 30 * DAY_MS));
    const range = { startDay: yyyymmdd(from), endDay: yyyymmdd(now), timeZone: huaweiTimeZone(now) };
    const ms = { startTime: from.getTime(), endTime: now.getTime() };

    const daily = await Promise.all(
      DAILY_TYPES.map((type) =>
        tolerant(
          type.dataType,
          async () => {
            const data = await call<{ group?: Group[] }>("/sampleSet:dailyPolymerize", accessToken, {
              method: "POST",
              body: JSON.stringify({ dataTypes: [type.dataType], ...range }),
            });
            return huaweiDailyItems(type.metric, type.fields, data.group ?? [], type.scale);
          },
          [] as IntegrationItem[]
        )
      )
    );

    const weights = await tolerant(
      "vægt",
      async () => {
        const data = await call<{ group?: Group[] }>("/sampleSet:polymerize", accessToken, {
          method: "POST",
          body: JSON.stringify({ polymerizeWith: [{ dataTypeName: "com.huawei.instantaneous.body_weight" }], ...ms }),
        });
        return huaweiWeightItems((data.group ?? []).flatMap((g) => (g.sampleSet ?? []).flatMap((s) => s.samplePoints ?? [])));
      },
      [] as IntegrationItem[]
    );

    const sleep = await tolerant(
      "søvn",
      async () => {
        const query = new URLSearchParams({ ...Object.fromEntries(Object.entries(ms).map(([k, v]) => [k, String(v)])), dataType: "com.huawei.health.record.sleep" });
        const data = await call<{ healthRecords?: HealthRecord[] }>(`/healthRecords?${query}`, accessToken);
        return huaweiSleepItems(data.healthRecords ?? []);
      },
      [] as IntegrationItem[]
    );

    const activities = await tolerant(
      "træning",
      async () => {
        const query = new URLSearchParams({ startTime: String(ms.startTime), endTime: String(ms.endTime) });
        const data = await call<{ activityRecord?: ActivityRecord[] }>(`/activityRecords?${query}`, accessToken);
        return huaweiActivityItems(data.activityRecord ?? []);
      },
      [] as IntegrationItem[]
    );

    return [...daily.flat(), ...weights, ...sleep, ...activities];
  },
};
