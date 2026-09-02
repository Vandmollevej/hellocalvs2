import { prisma } from "@/lib/prisma";
import type { Integration, IntegrationProvider } from "@prisma/client";

// Catalog of all providers the Integrations page can show.
// - FITBIT/WITHINGS: real, standalone cloud OAuth API — connects directly.
// - APPLE_HEALTH/GOOGLE_HEALTH: cannot be accessed from a web app at all
//   (native-only), but are prepared to receive data from a future
//   companion app via a device token (`ingestOnly`) — see
//   docs/HEALTHKIT_COMPANION.md and docs/DECISIONS.md.
// - GARMIN: awaiting separate partner approval, fully unavailable until then.
export type IntegrationMeta = {
  provider: IntegrationProvider;
  label: string;
  description: string;
  connectable: boolean;
  ingestOnly?: boolean;
  unavailableReason?: string;
};

export const INTEGRATION_CATALOG: IntegrationMeta[] = [
  {
    provider: "FITBIT",
    label: "Fitbit",
    description: "Henter aktivitet, forbrænding og sport fra din Fitbit-konto.",
    connectable: true,
  },
  {
    provider: "WITHINGS",
    label: "Withings (smart-vægt)",
    description: "Henter vægtmålinger automatisk fra en tilknyttet Withings smart-vægt.",
    connectable: true,
  },
  {
    provider: "GARMIN",
    label: "Garmin",
    description:
      "Kræver Garmins egen partnergodkendelse (Garmin Health API) — ikke tilkoblet endnu.",
    connectable: false,
    unavailableReason:
      "Garmin kræver en separat ansøgning om partneradgang, som ikke er afsluttet endnu.",
  },
  {
    provider: "APPLE_HEALTH",
    label: "Apple Health",
    description:
      "Apple tillader kun native apps at læse Health-data — kræver en companion-app (forberedt, ikke bygget endnu).",
    connectable: false,
    ingestOnly: true,
    unavailableReason:
      "Backend er klar (enhedstoken + modtagelse), men der findes endnu ingen iOS-app der sender data.",
  },
  {
    provider: "GOOGLE_HEALTH",
    label: "Google Health Connect",
    description:
      "Ligesom Apple Health kun tilgængeligt on-device — kræver en companion-app (forberedt, ikke bygget endnu).",
    connectable: false,
    ingestOnly: true,
    unavailableReason:
      "Backend er klar (enhedstoken + modtagelse), men der findes endnu ingen Android-app der sender data.",
  },
];

export type IntegrationCardStatus = IntegrationMeta & {
  status: "DISCONNECTED" | "CONNECTED" | "ERROR";
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export async function listIntegrationStatuses(userId: string): Promise<IntegrationCardStatus[]> {
  const rows = await prisma.integration.findMany({ where: { userId } });
  const byProvider = new Map<IntegrationProvider, Integration>(rows.map((row) => [row.provider, row]));

  return INTEGRATION_CATALOG.map((meta) => {
    const row = byProvider.get(meta.provider);
    return {
      ...meta,
      status: row?.status ?? "DISCONNECTED",
      connectedAt: row?.connectedAt?.toISOString() ?? null,
      lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
    };
  });
}

// Minimum interval between two syncs of the same provider (on-demand,
// no background poller for now, per docs/DECISIONS.md).
export const SYNC_THROTTLE_MS = 15 * 60 * 1000;

export function shouldSync(lastSyncedAt: Date | null): boolean {
  if (!lastSyncedAt) return true;
  return Date.now() - lastSyncedAt.getTime() > SYNC_THROTTLE_MS;
}
