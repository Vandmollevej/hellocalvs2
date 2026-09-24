"use client";

// Profilen (docs/PRIVACY.md). Private felter ligger i boksen (samling
// "profile", post "me"); serverfelterne (SERVER_PROFILE_FIELDS) hentes fra
// /api/profile. GET/PATCH /api/profile svarer med den samlede profil i samme
// form som før.

import { SERVER_PROFILE_FIELDS } from "@/lib/profile-fields";
import { isValidStartWeight, parseWeightInput } from "@/lib/start-weight-rules";
import { json, route } from "@/lib/vault/local-api";
import type { VaultClient } from "@/lib/vault/client";

export const PROFILE = "profile";
const ME = "me";

export const PRIVATE_PROFILE_DEFAULTS = {
  displayName: "",
  weightKg: null as number | null,
  startWeightUpdatedAt: null as string | null,
  targetWeightKg: null as number | null,
  heightCm: null as number | null,
  birthDate: null as string | null,
  sex: null as "FEMALE" | "MALE" | null,
  defaultBedtime: null as string | null,
  defaultWakeTime: null as string | null,
  shiftWorkEnabled: false,
  dailyLogPreference: null as "WORK_HOURS" | "SLEEP_TIMES" | null,
  workHoursInCalendarEnabled: false,
  healthImportRequested: false,
  onboardingStep: 0,
  onboardingCompletedAt: null as string | null,
  onboardingRemindLaterAt: null as string | null,
  onboardingDismissed: false,
  showAllergens: false,
  allergenVisibility: null as Record<string, boolean> | null,
  showExtendedNutrition: false,
  // HelloFresh-opskrifter i "Søg i delte retter" (Indstillinger → Integrationer).
  helloFreshEnabled: false,
  warnOnRecommendedLimits: false,
  photoDiaryRequiresPasscode: false,
  cycleTrackingEnabled: false,
  averageCycleLengthDays: 28,
  averagePeriodLengthDays: 5,
};

export type PrivateProfile = typeof PRIVATE_PROFILE_DEFAULTS;
type PrivateKey = keyof PrivateProfile;
const PRIVATE_KEYS = Object.keys(PRIVATE_PROFILE_DEFAULTS) as PrivateKey[];

type Vault = Pick<VaultClient, "get" | "put">;

export function readPrivateProfile(vault: Vault): PrivateProfile {
  return { ...PRIVATE_PROFILE_DEFAULTS, ...(vault.get<Partial<PrivateProfile>>(PROFILE, ME) ?? {}) };
}

export async function updatePrivateProfile(vault: Vault, patch: Partial<PrivateProfile>) {
  const next = { ...readPrivateProfile(vault), ...patch };
  await vault.put(PROFILE, ME, next);
  return next;
}

async function serverProfile(init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch("/api/profile", init);
  if (!res.ok) return {};
  return ((await res.json()) as { user?: Record<string, unknown> }).user ?? {};
}

function merged(server: Record<string, unknown>, priv: PrivateProfile) {
  return { ...server, ...priv, email: null };
}

route("GET", "/api/profile", async ({ vault }) => {
  return json({ user: merged(await serverProfile(), readPrivateProfile(vault)) });
});

route("PATCH", "/api/profile", async ({ vault, body }) => {
  const input = (await body()) as Record<string, unknown>;
  const current = readPrivateProfile(vault);
  const patch: Partial<PrivateProfile> = {};

  // Start-vægten er låst (docs/DECISIONS.md 2026-09-22): kan kun sættes
  // første gang. Senere ændringer går via e-mailverificeringen.
  if (input.weightKg !== undefined) {
    if (current.weightKg !== null) {
      return json({ message: "Startvægten er låst og kan kun ændres via verificeringsmail." }, 403);
    }
    const parsed = parseWeightInput(input.weightKg);
    if (!isValidStartWeight(parsed)) return json({ message: "Angiv en gyldig startvægt." }, 400);
    patch.weightKg = parsed;
    patch.startWeightUpdatedAt = new Date().toISOString();
  }
  for (const key of PRIVATE_KEYS) {
    if (key === "weightKg" || key === "startWeightUpdatedAt" || input[key] === undefined) continue;
    (patch as Record<string, unknown>)[key] = input[key];
  }

  const serverPatch = Object.fromEntries(
    SERVER_PROFILE_FIELDS.filter((key) => input[key] !== undefined).map((key) => [key, input[key]])
  );
  const server =
    Object.keys(serverPatch).length > 0
      ? await serverProfile({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(serverPatch),
        })
      : await serverProfile();

  const priv = Object.keys(patch).length > 0 ? await updatePrivateProfile(vault, patch) : current;
  return json({ user: merged(server, priv) });
});

// Start-vægt via e-mailverificeret link: serveren forbruger linket, og
// vægten skrives kun i boksen.
route("GET", "/api/profile/start-weight", async ({ vault, query }) => {
  const res = await fetch(`/api/profile/start-weight?token=${encodeURIComponent(query.get("token") ?? "")}`);
  if (!res.ok) return json({ valid: false }, 400);
  return json({ valid: true, currentWeightKg: readPrivateProfile(vault).weightKg });
});

route("POST", "/api/profile/start-weight", async ({ vault, body }) => {
  const input = (await body()) as { token?: string; weightKg?: unknown };
  const weightKg = parseWeightInput(input.weightKg);
  if (!isValidStartWeight(weightKg)) {
    return json({ message: "Angiv en gyldig startvægt.", code: "invalid_weight" }, 400);
  }
  const res = await fetch("/api/profile/start-weight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: input.token ?? "" }),
  });
  if (!res.ok) return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
  const startWeightUpdatedAt = new Date().toISOString();
  await updatePrivateProfile(vault, { weightKg, startWeightUpdatedAt });
  return json({ ok: true, weightKg, startWeightUpdatedAt });
});
