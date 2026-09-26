import type { IntegrationProvider } from "@prisma/client";
import { hasClientCredentials, type OAuthProviderAdapter } from "./types";
import { fitbit } from "./fitbit";
import { googleHealth } from "./google-health";
import { polar } from "./polar";
import { strava } from "./strava";
import { withings } from "./withings";

// Alle cloud-integrationer, der forbindes med OAuth fra serveren.
export const OAUTH_PROVIDERS: OAuthProviderAdapter[] = [withings, googleHealth, strava, polar, fitbit];

export function adapterBySlug(slug: string) {
  return OAUTH_PROVIDERS.find((p) => p.slug === slug) ?? null;
}

export function adapterByProvider(provider: IntegrationProvider) {
  return OAUTH_PROVIDERS.find((p) => p.provider === provider) ?? null;
}

export function isConfigured(adapter: OAuthProviderAdapter) {
  return hasClientCredentials(adapter.envPrefix);
}

function publicBase() {
  const base =
    process.env.INTEGRATIONS_REDIRECT_BASE_URL || process.env.APP_BASE_URL || "https://hellocal.packroff.dk";
  return base.replace(/\/$/, "");
}

// Adresse til redirects tilbage i appen. Bag Synology-proxyen peger req.url på
// containerens interne adresse (https://0.0.0.0:3000), så den kan ikke bruges.
export function publicUrl(path: string) {
  return new URL(path, publicBase());
}

// <PRÆFIKS>_REDIRECT_URI vinder, hvis den er sat (fx den URI, der er
// registreret hos Withings/Google). Ellers bruges standardstien.
export function redirectUri(adapter: OAuthProviderAdapter) {
  const explicit = process.env[`${adapter.envPrefix}_REDIRECT_URI`];
  if (explicit) return explicit;
  return `${publicBase()}/api/integrations/${adapter.slug}/callback`;
}
