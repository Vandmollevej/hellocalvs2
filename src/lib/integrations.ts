import { prisma } from "@/lib/prisma";
import type { Integration, IntegrationProvider } from "@prisma/client";

// Katalog over alle udbydere Integrationer-siden kan vise. Kun FITBIT og
// WITHINGS har en rigtig, selvstændig cloud-OAuth-API og kan derfor faktisk
// forbindes i denne omgang — se docs/DECISIONS.md for baggrunden. De øvrige
// tre vises kun statisk med en forklaring, uden nogen database-række.
export type IntegrationMeta = {
  provider: IntegrationProvider;
  label: string;
  description: string;
  connectable: boolean;
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
    description: "Apple tillader kun native apps at læse Health-data.",
    connectable: false,
    unavailableReason:
      "Kræver enten en companion-app eller et betalt tredjeparts-abonnement (fx Terra/Vital) — ikke tilkoblet endnu.",
  },
  {
    provider: "GOOGLE_HEALTH",
    label: "Google Health Connect",
    description: "Ligesom Apple Health kun tilgængeligt on-device for native apps.",
    connectable: false,
    unavailableReason:
      "Kræver enten en companion-app eller et betalt tredjeparts-abonnement (fx Terra/Vital) — ikke tilkoblet endnu.",
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

// Minimumsinterval mellem to synkroniseringer af samme udbyder (on-demand,
// ingen baggrunds-poller i denne omgang, jf. docs/DECISIONS.md).
export const SYNC_THROTTLE_MS = 15 * 60 * 1000;

export function shouldSync(lastSyncedAt: Date | null): boolean {
  if (!lastSyncedAt) return true;
  return Date.now() - lastSyncedAt.getTime() > SYNC_THROTTLE_MS;
}
