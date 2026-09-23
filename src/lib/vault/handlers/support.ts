"use client";

// Supportpakke (docs/PRIVACY.md "Support"). Når brugeren gemmer en
// tilladelse, bygger enheden en pakke med de valgte datatyper fra boksen og
// forsegler den til Supports offentlige nøgle. Kun admins browser kan åbne
// den, og kun inden for adgangsperioden; serveren sletter den, når
// tilladelsen tilbagekaldes eller udløber. Pakken indeholder hele
// historikken i de valgte kategorier — brugeren vælger kategorier, og
// perioden styrer, hvornår Support må se dem.

import { groupByDay } from "@/lib/daily-totals";
import { readSupportPermissions, type SupportPermissionKey } from "@/lib/support-permissions";
import { sealToPublicKey } from "@/lib/vault/crypto";
import type { VaultClient } from "@/lib/vault/client";
import { json, route } from "@/lib/vault/local-api";
import { listRegistrations, DISHES, FAVORITES } from "@/lib/vault/handlers/meals";
import { listWeightEntries } from "@/lib/vault/handlers/weight";
import {
  listActivities,
  listBody,
  listHealth,
  listMenstrual,
  listShifts,
  listSleep,
  listWater,
} from "@/lib/vault/handlers/tracking";
import { readPrivateProfile } from "@/lib/vault/handlers/profile";
import { SEARCH_HISTORY } from "@/lib/vault/handlers/search";
import { GOALS } from "@/lib/vault/handlers/goals";
import { DOCTOR_SHARES } from "@/lib/vault/handlers/doctor-shares";

const STEP_TYPES = ["STEPS"];
const STRESS_TYPES = ["STRESS_SCORE"];

function dataFor(vault: VaultClient, key: SupportPermissionKey): unknown {
  const registrations = () => listRegistrations(vault);
  const health = (types?: string[], exclude?: string[]) =>
    listHealth(vault).filter((m) => (types ? types.includes(m.type) : !exclude?.includes(m.type)));
  switch (key) {
    case "profile":
      return readPrivateProfile(vault);
    case "calendar":
      return { registrations: registrations(), workShifts: listShifts(vault), sleepSchedule: listSleep(vault) };
    case "foodIntake":
      return registrations();
    case "calories":
      return groupByDay(registrations()).map((d) => ({ dateKey: d.dateKey, kcal: d.kcal }));
    case "energyDistribution":
      return groupByDay(registrations()).map((d) => ({
        dateKey: d.dateKey,
        protein: d.protein,
        carbs: d.carbs,
        fat: d.fat,
      }));
    case "nutrients":
    case "statistics":
      return groupByDay(registrations());
    case "favorites":
      return vault.list(FAVORITES);
    case "recipes":
      return vault.list(DISHES);
    case "searchHistory":
      return vault.list(SEARCH_HISTORY);
    case "weight":
      return listWeightEntries(vault);
    case "bodyMeasurements":
      return listBody(vault);
    case "activity":
      return listActivities(vault);
    case "steps":
      return health(STEP_TYPES);
    case "stress":
      return health(STRESS_TYPES);
    case "heartAndHealthMetrics":
      return health(undefined, [...STEP_TYPES, ...STRESS_TYPES]);
    case "sleep":
      return listSleep(vault);
    case "water":
      return listWater(vault);
    case "menstrualCycle":
      return listMenstrual(vault);
    case "goals":
      return vault.list(GOALS);
    case "helloDoc":
      // Lægernes navne/e-mail — aldrig delingsnøglerne.
      return vault
        .list<{ name: string; email: string }>(DOCTOR_SHARES)
        .map(({ id, value }) => ({ id, name: value.name, email: value.email }));
    // Ligger på serveren, ikke i boksen: Support kan se dem direkte i admin.
    case "productSubmissions":
    case "integrations":
    case "messages":
    case "subscription":
      return null;
  }
}

type Grant = { id: string; permissions: unknown; active: boolean } | null;

export async function uploadSupportPackage(vault: VaultClient, grant: Grant) {
  if (!grant) return false;
  const keyRes = await fetch("/api/support/key");
  const { key } = (await keyRes.json().catch(() => ({}))) as { key?: { id: string; publicKey: string } | null };
  if (!key) return false;
  const permissions = readSupportPermissions(grant.permissions);
  const categories = Object.fromEntries(
    (Object.keys(permissions) as SupportPermissionKey[])
      .filter((k) => permissions[k])
      .map((k) => [k, dataFor(vault, k)])
  );
  const box = await sealToPublicKey(key.publicKey, { createdAt: new Date().toISOString(), categories });
  const res = await fetch("/api/support/packages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grantId: grant.id, keyId: key.id, ...box }),
  });
  return res.ok;
}

// Gem tilladelse: gem på serveren, og læg derefter den forseglede pakke.
route("PUT", "/api/support/access", async ({ vault, body }) => {
  const res = await fetch("/api/support/access", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await body()),
  });
  const data = (await res.json().catch(() => ({}))) as { grant?: Grant };
  if (res.ok && data.grant) await uploadSupportPackage(vault as VaultClient, data.grant).catch(() => false);
  return json(data, res.status);
});

// Kontakt os: opdatér pakken med de nyeste data, før beskeden sendes.
route("POST", "/api/support/requests", async ({ vault, body }) => {
  const input = await body();
  const current = await fetch("/api/support/access", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (current?.grant) await uploadSupportPackage(vault as VaultClient, current.grant).catch(() => false);
  return fetch("/api/support/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
});
