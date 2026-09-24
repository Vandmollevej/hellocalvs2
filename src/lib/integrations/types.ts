import type { IntegrationProvider } from "@prisma/client";
import type { InboxEnvelope } from "@/lib/vault/inbox-delivery";

// Fælles kontrakt for cloud-integrationer med OAuth (Withings, Google Health,
// Strava, Polar, Fitbit). Serveren henter data og forsegler dem straks til
// brugerens anonyme indbakke (docs/PRIVACY.md); intet gemmes i klartekst.

export type OAuthTokens = {
  access_token: string;
  refresh_token?: string | null;
  // Sekunder til udløb. Mangler den, udløber tokenet ikke (Polar).
  expires_in?: number | null;
  scope?: string;
};

export type OAuthProviderAdapter = {
  provider: IntegrationProvider;
  // URL-segmentet under /api/integrations/<slug>/…
  slug: string;
  label: string;
  // Env-præfikset, fx "GOOGLE_HEALTH" → GOOGLE_HEALTH_CLIENT_ID.
  envPrefix: string;
  // Hvor langt tilbage første synkronisering henter.
  initialDays: number;
  buildAuthorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  refresh?(refreshToken: string): Promise<OAuthTokens>;
  // Kører én gang efter tilkobling (Polar kræver brugerregistrering).
  afterConnect?(tokens: OAuthTokens): Promise<void>;
  fetchItems(accessToken: string, since: Date): Promise<InboxEnvelope[]>;
};

export function clientCredentials(envPrefix: string) {
  const clientId = process.env[`${envPrefix}_CLIENT_ID`];
  const clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) throw new Error(`${envPrefix}_CLIENT_ID/${envPrefix}_CLIENT_SECRET er ikke sat`);
  return { clientId, clientSecret };
}

export function basicAuth(envPrefix: string) {
  const { clientId, clientSecret } = clientCredentials(envPrefix);
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export async function postForm<T>(
  url: string,
  params: Record<string, string>,
  what: string,
  headers: Record<string, string> = {}
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...headers },
    body: new URLSearchParams(params),
  });
  if (!response.ok) throw new Error(`${what} fejlede (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T;
}

export async function getJson<T>(url: string | URL, accessToken: string, what: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  if (!response.ok) throw new Error(`${what} fejlede (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
