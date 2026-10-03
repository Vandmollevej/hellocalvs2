// Polar AccessLink API v3 (OAuth2, polar.com/accesslink-api). Træningspas,
// søvn, Nightly Recharge (hvilepuls, HRV, vejrtrækning), dagsaktivitet og
// cardio load (2026-10-03).
// Adgangstokenet udløber ikke, og der findes intet refresh-token.
// Env: POLAR_CLIENT_ID/POLAR_CLIENT_SECRET.

import { randomUUID } from "crypto";
import type { IntegrationItem } from "@/lib/integrations/store-items";
import {
  isoDurationMinutes,
  polarCardioLoadItems,
  polarDailyActivityItems,
  polarRechargeItems,
  polarSleepItems,
  type PolarCardioLoad,
  type PolarDailyActivity,
  type PolarNight,
  type PolarRecharge,
} from "./polar-items";
import { DAY_MS, basicAuth, clientCredentials, getJson, postForm, type OAuthProviderAdapter, type OAuthTokens } from "./types";

const AUTHORIZE_URL = "https://flow.polar.com/oauth2/authorization";
const TOKEN_URL = "https://polarremote.com/v2/oauth2/token";
const API = "https://www.polaraccesslink.com/v3";

type Exercise = {
  start_time: string; // lokal tid uden zone
  start_time_utc_offset?: number; // minutter
  duration?: string; // ISO 8601, fx "PT1H2M3.5S"
  calories?: number;
  sport?: string;
  detailed_sport_info?: string;
};

export const polar: OAuthProviderAdapter = {
  provider: "POLAR",
  slug: "polar",
  label: "Polar Flow",
  envPrefix: "POLAR",
  initialDays: 30,
  buildAuthorizeUrl(state, redirectUri) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientCredentials("POLAR").clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "accesslink.read_all");
    url.searchParams.set("state", state);
    return url.toString();
  },
  exchangeCode(code, redirectUri) {
    return postForm<OAuthTokens>(
      TOKEN_URL,
      { grant_type: "authorization_code", code, redirect_uri: redirectUri },
      "Polar token-udveksling",
      { Authorization: basicAuth("POLAR") }
    );
  },
  // Polar kræver, at brugeren registreres hos klienten før data kan hentes.
  // member-id er et tilfældigt ID uden kobling til Hello Cal-kontoen.
  async afterConnect(tokens) {
    const response = await fetch(`${API}/users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ "member-id": randomUUID() }),
    });
    if (!response.ok && response.status !== 409) {
      throw new Error(`Polar brugerregistrering fejlede (${response.status})`);
    }
  },
  // /v3/exercises returnerer de seneste 30 dages træningspas.
  async fetchItems(accessToken, since) {
    const exercises = await getJson<Exercise[]>(`${API}/exercises`, accessToken, "Polar trænings-opslag");
    const extra = await polarExtras(accessToken, since);
    const items: IntegrationItem[] = [];
    for (const e of exercises) {
      const local = Date.parse(`${e.start_time.replace(/Z$/, "")}Z`);
      if (Number.isNaN(local)) continue;
      const start = new Date(local - (e.start_time_utc_offset ?? 0) * 60000);
      if (start < since) continue;
      items.push({
        kind: "activity",
        payload: {
          source: "POLAR",
          sportType: (e.detailed_sport_info ?? e.sport ?? "workout").toLowerCase(),
          startedAt: start.toISOString(),
          durationMinutes: isoDurationMinutes(e.duration),
          caloriesBurned: Math.round(e.calories ?? 0),
        },
      });
    }
    return [...items, ...extra];
  },
};

// Søvn, Nightly Recharge, dagsaktivitet og cardio load hentes hver for sig;
// en fejl i ét af dem vælter ikke træningspassene.
async function polarExtras(accessToken: string, since: Date): Promise<IntegrationItem[]> {
  const from = new Date(Math.max(since.getTime(), Date.now() - 28 * DAY_MS)).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const tolerant = async <T>(what: string, run: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await run();
    } catch (error) {
      console.error(`Polar ${what} fejlede`, error instanceof Error ? error.message : "ukendt");
      return [];
    }
  };
  const [nights, recharges, days, loads] = await Promise.all([
    tolerant("søvn", async () => (await getJson<{ nights?: PolarNight[] }>(`${API}/users/sleep`, accessToken, "Polar søvn")).nights ?? []),
    tolerant("Nightly Recharge", async () =>
      (await getJson<{ recharges?: PolarRecharge[] }>(`${API}/users/nightly-recharge`, accessToken, "Polar Nightly Recharge")).recharges ?? []
    ),
    tolerant("dagsaktivitet", async () => {
      const data = await getJson<PolarDailyActivity[] | { activities?: PolarDailyActivity[] }>(
        `${API}/users/activities?from=${from}&to=${to}`,
        accessToken,
        "Polar dagsaktivitet"
      );
      return Array.isArray(data) ? data : (data.activities ?? []);
    }),
    tolerant("cardio load", async () => {
      const data = await getJson<PolarCardioLoad[]>(`${API}/users/cardio-load/date?from=${from}&to=${to}`, accessToken, "Polar cardio load");
      return Array.isArray(data) ? data : [];
    }),
  ]);
  const fromKey = `${from}T00:00:00.000Z`;
  return [...polarSleepItems(nights), ...polarRechargeItems(recharges), ...polarDailyActivityItems(days), ...polarCardioLoadItems(loads)].filter(
    (item) => String((item.payload as { recordedAt?: string }).recordedAt) >= fromKey
  );
}
