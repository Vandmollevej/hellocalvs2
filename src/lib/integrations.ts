import { prisma } from "@/lib/prisma";
import type { Integration, IntegrationProvider } from "@prisma/client";
import { adapterByProvider, isConfigured } from "@/lib/integrations/registry";
import { capabilitiesFor, missingWriteScopes, resolveSyncSettings, type ProviderSyncCapabilities, type SyncSettings, type WriteType } from "@/lib/integrations/sync-settings";

// Katalog over integrationerne på siden Integrationer (docs/DECISIONS.md
// 2026-09-24). Alle data forsegles til brugerens boks (docs/PRIVACY.md).
// - kind "oauth": cloud-API, som serveren forbinder til med OAuth
//   (Withings, Google Health, Strava, Polar, Fitbit).
// - kind "companion": data ligger kun på telefonen (Apple Health, Health
//   Connect, Samsung Health) og kræver Hello Cal-appen, der sender dem ind
//   med en enhedskode (docs/HEALTHKIT_COMPANION.md).
// - kind "unavailable": kræver en partneraftale (Garmin).
export type IntegrationKind = "oauth" | "companion" | "unavailable";

export type IntegrationMeta = {
  provider: IntegrationProvider;
  label: string;
  icon: string;
  kind: IntegrationKind;
  description: string;
  // Bevares af hensyn til statistik (sport vises kun ved en forbundet cloud-integration).
  connectable: boolean;
  ingestOnly?: boolean;
  // Companion-kort, der selv udsteder enhedskoder (Samsung Health går via Health Connect).
  issuesDeviceTokens?: boolean;
  // Vises kun, hvis brugeren allerede har den forbundet (Fitbit afløses af Google Health).
  legacy?: boolean;
};

const icon = (slug: string) => `/integrations/${slug}.png`;

// Rækkefølgen er visningsrækkefølgen (docs/DECISIONS.md 2026-09-25).
export const INTEGRATION_CATALOG: IntegrationMeta[] = [
  {
    provider: "APPLE_HEALTH",
    label: "Apple Health",
    icon: icon("apple-health"),
    kind: "companion",
    description: "Vægt, skridt og træning fra Apple Health på din iPhone.",
    connectable: false,
    ingestOnly: true,
    issuesDeviceTokens: true,
      },
  {
    provider: "GOOGLE_HEALTH",
    label: "Google Health",
    icon: icon("google-health"),
    kind: "oauth",
    description: "Vægt, skridt og træning fra Fitbit, Pixel Watch og Google Health.",
    connectable: true,
  },
  {
    provider: "STRAVA",
    label: "Strava",
    icon: icon("strava"),
    kind: "oauth",
    description: "Træningspas og forbrænding fra Strava.",
    connectable: true,
  },
  {
    provider: "HEALTH_CONNECT",
    label: "Health Connect",
    icon: icon("health-connect"),
    kind: "companion",
    description: "Vægt, skridt og træning fra Android-telefonen.",
    connectable: false,
    ingestOnly: true,
    issuesDeviceTokens: true,
      },
  {
    provider: "FITBIT",
    label: "Fitbit",
    icon: icon("google-health"),
    kind: "oauth",
    description: "Fitbit flytter til Google Health. Forbind Google Health i stedet.",
    connectable: true,
    legacy: true,
  },
  {
    provider: "WITHINGS",
    label: "Withings",
    icon: icon("withings"),
    kind: "oauth",
    description: "Vægt og fedtprocent fra din Withings-vægt.",
    connectable: true,
  },
  {
    provider: "GARMIN",
    label: "Garmin",
    icon: icon("garmin"),
    kind: "unavailable",
    description: "Træning og skridt fra Garmin Connect.",
    connectable: false,
  },
  {
    provider: "SAMSUNG_HEALTH",
    label: "Samsung Health",
    icon: icon("samsung-health"),
    kind: "companion",
    description: "Vægt, skridt og træning fra Samsung Health.",
    connectable: false,
    ingestOnly: true,
      },
  {
    provider: "POLAR",
    label: "Polar Flow",
    icon: icon("polar-flow"),
    kind: "oauth",
    description: "Træningspas og forbrænding fra Polar Flow.",
    connectable: true,
  },
];

// Adresse-segment for integrationens egen side, fx APPLE_HEALTH → "apple-health".
export function integrationSlug(provider: IntegrationProvider) {
  return provider.toLowerCase().replace(/_/g, "-");
}

export function metaBySlug(slug: string) {
  return INTEGRATION_CATALOG.find((meta) => integrationSlug(meta.provider) === slug) ?? null;
}

export type IntegrationCardStatus = IntegrationMeta & {
  // Slug til OAuth-ruterne (kun "oauth"); pageSlug til integrationens side.
  slug: string | null;
  pageSlug: string;
  capabilities: ProviderSyncCapabilities;
  settings: SyncSettings;
  // Skrivetyper, der er slået til, men kræver at brugeren forbinder igen.
  needsReconnect: WriteType[];
  lastPushedAt: string | null;
  // Om serverens nøgler til integrationen er sat (kun "oauth").
  configured: boolean;
  status: "DISCONNECTED" | "CONNECTED" | "ERROR";
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export async function listIntegrationStatuses(userId: string): Promise<IntegrationCardStatus[]> {
  const rows = await prisma.integration.findMany({ where: { userId } });
  const byProvider = new Map<IntegrationProvider, Integration>(rows.map((row) => [row.provider, row]));

  return INTEGRATION_CATALOG.filter((meta) => !meta.legacy || byProvider.get(meta.provider)?.status === "CONNECTED").map(
    (meta) => {
      const row = byProvider.get(meta.provider);
      const adapter = adapterByProvider(meta.provider);
      return {
        ...meta,
        slug: adapter?.slug ?? null,
        pageSlug: integrationSlug(meta.provider),
        capabilities: capabilitiesFor(meta.provider),
        settings: resolveSyncSettings(meta.provider, row?.syncSettings),
        needsReconnect:
          adapter && row?.status && row.status !== "DISCONNECTED" ? missingWriteScopes(meta.provider, adapter.writeScopes, row.syncSettings, row.scope) : [],
        lastPushedAt: row?.lastPushedAt?.toISOString() ?? null,
        configured: adapter ? isConfigured(adapter) : false,
        status: row?.status ?? "DISCONNECTED",
        connectedAt: row?.connectedAt?.toISOString() ?? null,
        lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
        lastError: row?.lastError ?? null,
      };
    }
  );
}

// Minimum interval between two syncs of the same provider (on-demand,
// no background poller for now, per docs/DECISIONS.md).
export const SYNC_THROTTLE_MS = 15 * 60 * 1000;

export function shouldSync(lastSyncedAt: Date | null): boolean {
  if (!lastSyncedAt) return true;
  return Date.now() - lastSyncedAt.getTime() > SYNC_THROTTLE_MS;
}
