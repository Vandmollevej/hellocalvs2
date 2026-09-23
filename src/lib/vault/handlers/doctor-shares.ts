"use client";

// Hello Doc på enheden (docs/PRIVACY.md; docs/DECISIONS.md 2026-09-12).
//
// Ejerens enhed bygger rapporten ud fra boksen, krypterer den med en
// tilfældig nøgle pr. deling og lægger den på serveren. Nøglen står kun i
// lægens link (#k=…). Lægens navn og e-mail ligger kun i ejerens boks, og
// invitationen sendes fra ejerens egen mail-app — så serveren aldrig ser
// nøglen eller adressen.

import { groupByDay } from "@/lib/daily-totals";
import {
  historyRangeToDays,
  sanitizeDoctorShareCategories,
  type DoctorShareCategory,
  type DoctorShareHistoryRange,
} from "@/lib/doctor-share";
import { aesKeyFrom, decryptJson, encryptJson, fromBase64Url, randomBytes, toBase64Url } from "@/lib/vault/crypto";
import type { VaultClient } from "@/lib/vault/client";
import { json, route } from "@/lib/vault/local-api";
import { listRegistrations } from "@/lib/vault/handlers/meals";
import { listWeightEntries } from "@/lib/vault/handlers/weight";
import { listHealth } from "@/lib/vault/handlers/tracking";
import { readPrivateProfile } from "@/lib/vault/handlers/profile";

export const DOCTOR_SHARES = "doctorShares";
const AAD = "hellocal-doctor-share";
const PUBLISH_INTERVAL_MS = 60 * 60 * 1000;

type LocalShare = { name: string; email: string; key: string; lastPublishedAt: string | null };

type ServerShare = {
  id: string;
  token: string;
  status: "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED";
  categories: unknown;
  historyRange: DoctorShareHistoryRange;
  sentAt: string;
  expiresAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  snapshotUpdatedAt: string | null;
};

// ---------- rapportens indhold (samme form som den tidligere server-rapport) ----------

function cutoffFor(range: DoctorShareHistoryRange): string | null {
  const days = historyRangeToDays(range);
  return days === null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function ownerData(vault: VaultClient, range: DoctorShareHistoryRange) {
  const cutoff = cutoffFor(range);
  const inRange = (iso: string) => !cutoff || iso >= cutoff;
  const profile = readPrivateProfile(vault);
  const registrations = listRegistrations(vault)
    .filter((r) => inRange(r.createdAt))
    .reverse();
  const weights = listWeightEntries(vault)
    .filter((w) => inRange(w.weighedAt))
    .reverse();
  const water = listHealth(vault)
    .filter((m) => m.type === "WATER_ML" && inRange(m.recordedAt))
    .reverse();
  const daily = groupByDay(registrations);
  return {
    profile: { displayName: profile.displayName, email: "", sex: profile.sex },
    startWeightKg: profile.weightKg,
    startWeightRecordedAt: profile.startWeightUpdatedAt ?? new Date().toISOString(),
    targetWeightKg: profile.targetWeightKg,
    sleep: { defaultBedtime: profile.defaultBedtime, defaultWakeTime: profile.defaultWakeTime },
    weightHistory: weights.map((w) => ({ date: w.weighedAt, weightKg: w.weightKg })),
    fluidHistory: water.map((m) => ({ date: m.recordedAt, valueMl: m.value })),
    daily,
  };
}

function buildReport(vault: VaultClient, share: ServerShare, doctorName: string) {
  const categories = sanitizeDoctorShareCategories(share.categories);
  const has = (c: DoctorShareCategory) => categories.includes(c);
  const data = ownerData(vault, share.historyRange);
  const needsNutrition = has("foodAndCalories") || has("vitaminsMinerals");
  return {
    ownerName: data.profile.displayName,
    doctorName,
    categories,
    historyRange: share.historyRange,
    profile: has("profile") ? { displayName: data.profile.displayName, email: "", sex: data.profile.sex } : null,
    weight: has("weight")
      ? { startWeightKg: data.startWeightKg, startWeightRecordedAt: data.startWeightRecordedAt, history: data.weightHistory }
      : null,
    goals: has("goals") ? { targetWeightKg: data.targetWeightKg } : null,
    sleep: has("sleep") ? data.sleep : null,
    dailyNutrition: needsNutrition ? data.daily : null,
    fluidHistory: has("fluid") ? data.fluidHistory : null,
  };
}

async function publish(vault: VaultClient, share: ServerShare, local: LocalShare) {
  const sealed = await encryptJson(await aesKeyFrom(fromBase64Url(local.key)), buildReport(vault, share, local.name), AAD);
  const res = await fetch(`/api/doctor-shares/${encodeURIComponent(share.id)}/snapshot`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sealed),
  });
  if (res.ok) await vault.put<LocalShare>(DOCTOR_SHARES, share.id, { ...local, lastPublishedAt: new Date().toISOString() });
}

// Kaldes når boksen åbnes: opdaterer aktive delinger højst én gang i timen.
export async function publishDoctorShares(vault: VaultClient, force = false) {
  const locals = vault.list<LocalShare>(DOCTOR_SHARES);
  if (locals.length === 0) return;
  const res = await fetch("/api/doctor-shares");
  if (!res.ok) return;
  const { shares } = (await res.json()) as { shares: ServerShare[] };
  for (const share of shares) {
    const local = vault.get<LocalShare>(DOCTOR_SHARES, share.id);
    if (!local || (share.status !== "ACTIVE" && share.status !== "PENDING")) continue;
    const last = local.lastPublishedAt ? new Date(local.lastPublishedAt).getTime() : 0;
    if (force || Date.now() - last > PUBLISH_INTERVAL_MS) await publish(vault, share, local).catch(() => undefined);
  }
}

function inviteLink(token: string, key: string) {
  return `${window.location.origin}/hello-doc/${token}#k=${key}`;
}

// Åbner ejerens mail-app med invitationen. Hverken adressen eller linkets
// nøgle sendes til Hello Cal.
export function openInviteMail(email: string, ownerName: string, link: string) {
  const subject = `${ownerName || "En Hello Cal-bruger"} deler sin fremgang med dig`;
  const body = `Hej,\n\n${ownerName || "Jeg"} vil gerne dele sin fremgang i Hello Cal med dig.\nÅbn linket her:\n${link}\n\nLinket virker i 14 dage, indtil du har accepteret.`;
  window.location.assign(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
}

function merge(share: ServerShare, local: LocalShare | undefined) {
  return {
    ...share,
    name: local?.name ?? "",
    email: local?.email ?? "",
    inviteLink: local ? inviteLink(share.token, local.key) : null,
  };
}

async function serverJson<T>(url: string, init?: RequestInit): Promise<{ res: Response; data: T }> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T;
  return { res, data };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

route("GET", "/api/doctor-shares", async ({ vault }) => {
  const { res, data } = await serverJson<{ shares?: ServerShare[]; message?: string }>("/api/doctor-shares");
  if (!res.ok) return json(data, res.status);
  return json({ shares: (data.shares ?? []).map((s) => merge(s, vault.get<LocalShare>(DOCTOR_SHARES, s.id))) });
});

route("GET", "/api/doctor-shares/preview", ({ vault, query }) => {
  const rangeParam = query.get("range") as DoctorShareHistoryRange | null;
  const range: DoctorShareHistoryRange =
    rangeParam && ["LAST_7_DAYS", "LAST_MONTH", "LAST_YEAR", "ALL"].includes(rangeParam) ? rangeParam : "ALL";
  const data = ownerData(vault as VaultClient, range);
  return json({
    profile: data.profile,
    startWeightKg: data.startWeightKg,
    startWeightRecordedAt: data.startWeightRecordedAt,
    targetWeightKg: data.targetWeightKg,
    sleep: data.sleep,
    weightHistory: data.weightHistory,
    fluidHistory: data.fluidHistory,
    dailyNutrition: data.daily.map((d) => ({
      dateKey: d.dateKey,
      kcal: d.kcal,
      vitaminA: d.vitaminA,
      vitaminC: d.vitaminC,
      calcium: d.calcium,
      iron: d.iron,
      potassium: d.potassium,
    })),
    range,
  });
});

route("GET", "/api/doctor-shares/:id", async ({ vault, params }) => {
  const { res, data } = await serverJson<{ share?: ServerShare; message?: string }>(
    `/api/doctor-shares/${encodeURIComponent(params.id)}`
  );
  if (!res.ok || !data.share) return json(data, res.status);
  return json({ share: merge(data.share, vault.get<LocalShare>(DOCTOR_SHARES, params.id)) });
});

route("POST", "/api/doctor-shares", async ({ vault, body }) => {
  const input = (await body()) as { name?: string; email?: string; categories?: unknown; historyRange?: unknown };
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  if (!name) return json({ message: "Angiv et navn" }, 400);
  if (!EMAIL_PATTERN.test(email)) return json({ message: "Angiv en gyldig e-mailadresse" }, 400);

  const { res, data } = await serverJson<{ share?: ServerShare; message?: string }>("/api/doctor-shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categories: input.categories, historyRange: input.historyRange }),
  });
  if (!res.ok || !data.share) return json(data, res.status);
  const local: LocalShare = { name, email, key: toBase64Url(randomBytes(32)), lastPublishedAt: null };
  await vault.put(DOCTOR_SHARES, data.share.id, local);
  await publish(vault as VaultClient, data.share, local);
  return json({ share: merge(data.share, local) });
});

route("PATCH", "/api/doctor-shares/:id", async ({ vault, params, body }) => {
  const input = (await body()) as { name?: string; email?: string; categories?: unknown; historyRange?: unknown };
  const local = vault.get<LocalShare>(DOCTOR_SHARES, params.id);
  if (!local) return json({ message: "Ikke fundet" }, 404);
  const next = { ...local };
  if (input.name !== undefined) {
    if (!input.name.trim()) return json({ message: "Angiv et navn" }, 400);
    next.name = input.name.trim();
  }
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return json({ message: "Angiv en gyldig e-mailadresse" }, 400);
    next.email = email;
  }
  const { res, data } = await serverJson<{ share?: ServerShare; message?: string }>(
    `/api/doctor-shares/${encodeURIComponent(params.id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: input.categories, historyRange: input.historyRange }),
    }
  );
  if (!res.ok || !data.share) return json(data, res.status);
  await vault.put(DOCTOR_SHARES, params.id, next);
  await publish(vault as VaultClient, data.share, next);
  return json({ share: merge(data.share, next) });
});

route("POST", "/api/doctor-shares/:id/resend", async ({ vault, params }) => {
  const { res, data } = await serverJson<{ share?: ServerShare; message?: string }>(
    `/api/doctor-shares/${encodeURIComponent(params.id)}/resend`,
    { method: "POST" }
  );
  if (!res.ok || !data.share) return json(data, res.status);
  return json({ share: merge(data.share, vault.get<LocalShare>(DOCTOR_SHARES, params.id)) });
});

route("POST", "/api/doctor-shares/:id/revoke", async ({ vault, params }) => {
  const { res, data } = await serverJson<{ share?: ServerShare; message?: string }>(
    `/api/doctor-shares/${encodeURIComponent(params.id)}/revoke`,
    { method: "POST" }
  );
  if (res.ok && vault.get(DOCTOR_SHARES, params.id)) await vault.remove(DOCTOR_SHARES, params.id);
  return json(data, res.status);
});

// ---------- lægens side (ingen boks, ingen login) ----------

export async function fetchHelloDoc(token: string, keyText: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`/api/hello-doc/${encodeURIComponent(token)}`);
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    expiresAt?: string | null;
    snapshot?: { iv: string; ciphertext: string } | null;
  };
  if (!res.ok || !data.snapshot || !keyText) return { status: res.status, body: data };
  try {
    const report = await decryptJson<Record<string, unknown>>(
      await aesKeyFrom(fromBase64Url(keyText)),
      data.snapshot,
      AAD
    );
    // En invitation, der endnu ikke er accepteret, viser kun hvad der deles.
    if (data.status === "PENDING") {
      const { ownerName, doctorName, categories, historyRange } = report;
      return { status: 200, body: { status: data.status, expiresAt: data.expiresAt, ownerName, doctorName, categories, historyRange } };
    }
    return { status: 200, body: { ...report, status: data.status } };
  } catch {
    return { status: 400, body: { status: "NOT_FOUND" } };
  }
}

// Samme svarform som fetch(`/api/hello-doc/${token}`) før, men dekrypteret i
// lægens browser med nøglen fra URL-fragmentet.
export async function helloDocFetch(token: string): Promise<Response> {
  const key = new URLSearchParams(window.location.hash.slice(1)).get("k") ?? "";
  const { status, body } = await fetchHelloDoc(token, key);
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
