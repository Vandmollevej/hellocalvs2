import type { IntegrationProvider, Prisma } from "@prisma/client";
import type { IntegrationItem } from "@/lib/integrations/store-items";

// Hvad der synkroniseres med hver integration (docs/DECISIONS.md 2026-09-26).
// Brugeren vælger det på integrationens egen side — før tilkobling og når
// som helst bagefter. Valget ligger på Integration.syncSettings.
// - "read": data, Hello Cal henter fra appen.
// - "write": data, Hello Cal sender fra sig til appen.

export type ReadType = "weight" | "bodyFat" | "activities" | "steps" | "energy" | "heart" | "sleep" | "water" | "body";
export type WriteType = "nutrition" | "water" | "weight" | "activities";

export type SyncSettings = { read: Partial<Record<ReadType, boolean>>; write: Partial<Record<WriteType, boolean>> };

export type ProviderSyncCapabilities = { read: ReadType[]; write: WriteType[] };

// Hvad hver app teknisk kan levere og modtage. Apple Health og Health
// Connect skrives af Hello Cal-appen på telefonen; Google Health og Strava
// skrives af serveren. Withings, Polar og Garmin tager ikke imod data fra
// andre apps.
export const SYNC_CAPABILITIES: Partial<Record<IntegrationProvider, ProviderSyncCapabilities>> = {
  APPLE_HEALTH: {
    read: ["weight", "bodyFat", "activities", "steps", "energy", "heart", "sleep", "water", "body"],
    write: ["nutrition", "water", "weight", "activities"],
  },
  HEALTH_CONNECT: {
    read: ["weight", "bodyFat", "activities", "steps", "energy", "heart", "sleep", "water", "body"],
    write: ["nutrition", "water", "weight", "activities"],
  },
  GOOGLE_HEALTH: { read: ["weight", "activities", "steps"], write: ["nutrition", "water", "weight"] },
  STRAVA: { read: ["activities"], write: ["activities"] },
  WITHINGS: { read: ["weight", "bodyFat"], write: [] },
  POLAR: { read: ["activities"], write: [] },
  FITBIT: { read: ["weight", "activities"], write: [] },
};

export function capabilitiesFor(provider: IntegrationProvider): ProviderSyncCapabilities {
  return SYNC_CAPABILITIES[provider] ?? { read: [], write: [] };
}

// Alt, appen kan, er slået til, indtil brugeren slår det fra.
// Kun typer, appen understøtter, er med som nøgler.
export function resolveSyncSettings(provider: IntegrationProvider, stored: unknown): SyncSettings {
  const caps = capabilitiesFor(provider);
  const raw = (stored && typeof stored === "object" ? stored : {}) as { read?: unknown; write?: unknown };
  const pick = <T extends string>(all: T[], value: unknown) => {
    const saved = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return Object.fromEntries(all.map((key) => [key, typeof saved[key] === "boolean" ? saved[key] : true])) as Partial<
      Record<T, boolean>
    >;
  };
  return { read: pick(caps.read, raw.read), write: pick(caps.write, raw.write) };
}

// Renser et indsendt valg til kun de typer, appen understøtter.
export function sanitizeSyncSettings(provider: IntegrationProvider, input: unknown): Prisma.InputJsonObject {
  const resolved = resolveSyncSettings(provider, input);
  return { read: resolved.read as Prisma.InputJsonObject, write: resolved.write as Prisma.InputJsonObject };
}

// Skrivetyper, brugeren har slået til, men ikke gav adgang til ved tilkobling
// (writeScopes = appens OAuth-scope pr. skrivetype).
export function missingWriteScopes(
  provider: IntegrationProvider,
  writeScopes: Partial<Record<WriteType, string>> | undefined,
  storedSettings: unknown,
  grantedScope: string | null
): WriteType[] {
  const { write } = resolveSyncSettings(provider, storedSettings);
  return (Object.entries(writeScopes ?? {}) as [WriteType, string][])
    .filter(([type, scope]) => write[type] && !(grantedScope ?? "").includes(scope))
    .map(([type]) => type);
}

// Hvilken læsetype en HealthMetricType hører under.
const METRIC_READ_TYPE: Record<string, ReadType> = {
  STEPS: "steps",
  DISTANCE_KM: "steps",
  FLOORS_CLIMBED: "steps",
  ACTIVE_ENERGY_KCAL: "energy",
  RESTING_ENERGY_KCAL: "energy",
  EXERCISE_MINUTES: "activities",
  STAND_MINUTES: "activities",
  ACTIVE_ZONE_MINUTES: "activities",
  CARDIO_LOAD: "activities",
  VO2_MAX: "heart",
  SLEEP_MINUTES: "sleep",
  BODY_FAT_PERCENT: "bodyFat",
  HEIGHT_CM: "body",
  BMI: "body",
  WATER_ML: "water",
};

export function readTypeOf(item: IntegrationItem): ReadType {
  if (item.kind === "weight") return "weight";
  if (item.kind === "activity") return "activities";
  const type = String((item.payload as { type?: unknown } | null)?.type ?? "");
  return METRIC_READ_TYPE[type] ?? (type.includes("HEART") || type.includes("RESPIRATORY") || type.includes("OXYGEN") ? "heart" : "body");
}

// Fjerner data, brugeren har slået fra, før de gemmes.
export function filterItemsBySettings(provider: IntegrationProvider, stored: unknown, items: IntegrationItem[]) {
  const { read } = resolveSyncSettings(provider, stored);
  return items.filter((item) => read[readTypeOf(item)] === true);
}
