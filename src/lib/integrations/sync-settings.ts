import type { IntegrationProvider, Prisma } from "@prisma/client";
import type { IntegrationItem } from "@/lib/integrations/store-items";

// Hvad der synkroniseres med hver integration (docs/DECISIONS.md 2026-09-26).
// Brugeren vælger det på integrationens egen side — før tilkobling og når
// som helst bagefter. Valget ligger på Integration.syncSettings.
// - "read": data, Hello Cal henter fra appen.
// - "write": data, Hello Cal sender fra sig til appen.

// Kropssammensætningen er delt op, så hver måling har sin egen række
// (docs/DECISIONS.md 2026-10-03): fedt, muskler, fedtfri masse, kropsvand,
// knogler og visceralt fedt.
export type ReadType =
  | "weight"
  | "bodyFat"
  | "muscleMass"
  | "fatFreeMass"
  | "bodyWater"
  | "boneMass"
  | "visceralFat"
  | "activities"
  | "steps"
  | "energy"
  | "heart"
  | "sleep"
  | "water"
  | "body";
export type WriteType = "nutrition" | "water" | "weight" | "activities";

export type SyncSettings = { read: Partial<Record<ReadType, boolean>>; write: Partial<Record<WriteType, boolean>> };

export type ProviderSyncCapabilities = { read: ReadType[]; write: WriteType[] };

// Hvad hver app teknisk kan levere og modtage. Apple Health og Health
// Connect skrives af Hello Cal-appen på telefonen; Google Health og Strava
// skrives af serveren. Withings, Polar, Garmin, WHOOP og Huawei Health er
// kun til læsning — Hello Cal sender ingen data om brugeren til dem
// (docs/DECISIONS.md 2026-10-02). Eufy, Renpho, Xiaomi, Tuya og Samsung
// Health har ingen egne valg: deres data kommer via Health Connect/Apple
// Health og følger valgene dér.
export const SYNC_CAPABILITIES: Partial<Record<IntegrationProvider, ProviderSyncCapabilities>> = {
  APPLE_HEALTH: {
    read: ["weight", "bodyFat", "muscleMass", "bodyWater", "activities", "steps", "energy", "heart", "sleep", "water", "body"],
    write: ["nutrition", "water", "weight", "activities"],
  },
  HEALTH_CONNECT: {
    read: [
      "weight",
      "bodyFat",
      "fatFreeMass",
      "bodyWater",
      "boneMass",
      "activities",
      "steps",
      "energy",
      "heart",
      "sleep",
      "water",
      "body",
    ],
    write: ["nutrition", "water", "weight", "activities"],
  },
  GOOGLE_HEALTH: {
    read: ["weight", "bodyFat", "activities", "steps", "heart", "body"],
    write: ["nutrition", "water", "weight"],
  },
  STRAVA: { read: ["activities"], write: ["activities"] },
  WITHINGS: {
    read: ["weight", "bodyFat", "muscleMass", "fatFreeMass", "bodyWater", "boneMass", "visceralFat", "activities", "steps", "energy", "heart", "sleep", "body"],
    write: [],
  },
  POLAR: { read: ["activities", "steps", "energy", "heart", "sleep"], write: [] },
  FITBIT: { read: ["weight", "bodyFat", "activities", "steps", "energy", "heart", "sleep", "body"], write: [] },
  GARMIN: {
    read: ["weight", "bodyFat", "muscleMass", "bodyWater", "boneMass", "activities", "steps", "energy", "heart", "sleep", "body"],
    write: [],
  },
  WHOOP: { read: ["activities", "heart", "sleep", "body"], write: [] },
  HUAWEI_HEALTH: {
    read: ["weight", "bodyFat", "muscleMass", "activities", "steps", "energy", "heart", "sleep", "body"],
    write: [],
  },
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

// Læsetyper, brugeren har slået til, men hvor appen kræver en OAuth-tilladelse,
// der ikke blev givet ved tilkobling (fx Withings' user.activity, tilføjet
// 2026-10-03). Uden kendt scope antages alt givet.
export function missingReadScopes(
  provider: IntegrationProvider,
  readScopes: Partial<Record<ReadType, string>> | undefined,
  storedSettings: unknown,
  grantedScope: string | null
): ReadType[] {
  if (!grantedScope) return [];
  const { read } = resolveSyncSettings(provider, storedSettings);
  return (Object.entries(readScopes ?? {}) as [ReadType, string][])
    .filter(([type, scope]) => read[type] && !grantedScope.includes(scope))
    .map(([type]) => type);
}

// Alt, der kræver at brugeren forbinder igen (skrive- og læseadgang).
export function typesNeedingReconnect(
  provider: IntegrationProvider,
  scopes: { writeScopes?: Partial<Record<WriteType, string>>; readScopes?: Partial<Record<ReadType, string>> },
  storedSettings: unknown,
  grantedScope: string | null
): (ReadType | WriteType)[] {
  return [
    ...new Set([
      ...missingWriteScopes(provider, scopes.writeScopes, storedSettings, grantedScope),
      ...missingReadScopes(provider, scopes.readScopes, storedSettings, grantedScope),
    ]),
  ];
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
  // Kropssammensætning fra smartvægte hører alle under "bodyFat".
  BODY_FAT_PERCENT: "bodyFat",
  FAT_MASS_KG: "bodyFat",
  MUSCLE_MASS_KG: "muscleMass",
  FAT_FREE_MASS_KG: "fatFreeMass",
  BODY_WATER_PERCENT: "bodyWater",
  BONE_MASS_KG: "boneMass",
  VISCERAL_FAT_INDEX: "visceralFat",
  TEMPERATURE_C: "body",
  HEIGHT_CM: "body",
  BMI: "body",
  WATER_ML: "water",
};

export function readTypeOf(item: IntegrationItem): ReadType {
  if (item.kind === "weight") return "weight";
  if (item.kind === "activity") return "activities";
  const type = String((item.payload as { type?: unknown } | null)?.type ?? "");
  if (METRIC_READ_TYPE[type]) return METRIC_READ_TYPE[type];
  if (type.startsWith("SLEEP_")) return "sleep";
  return type.includes("HEART") || type.includes("RESPIRATORY") || type.includes("OXYGEN") || type === "STRESS_SCORE" ? "heart" : "body";
}

// Fjerner data, brugeren har slået fra, før de gemmes.
export function filterItemsBySettings(provider: IntegrationProvider, stored: unknown, items: IntegrationItem[]) {
  const { read } = resolveSyncSettings(provider, stored);
  return items.filter((item) => read[readTypeOf(item)] === true);
}
