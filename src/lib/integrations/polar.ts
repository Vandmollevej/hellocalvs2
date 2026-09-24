// Polar AccessLink API v3 (OAuth2, polar.com/accesslink-api). Træningspas.
// Adgangstokenet udløber ikke, og der findes intet refresh-token.
// Env: POLAR_CLIENT_ID/POLAR_CLIENT_SECRET.

import { randomUUID } from "crypto";
import type { InboxEnvelope } from "@/lib/vault/inbox-delivery";
import { basicAuth, clientCredentials, getJson, postForm, type OAuthProviderAdapter, type OAuthTokens } from "./types";

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

function isoDurationMinutes(value: string | undefined) {
  const m = value?.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) return 0;
  return Math.round(Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60);
}

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
    const items: InboxEnvelope[] = [];
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
    return items;
  },
};
