import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isEditableKey } from "@/lib/api-keys/catalog";

// API-nøgler rettet fra admin (docs/DECISIONS.md 2026-09-25 "API-nøgler i
// admin"). Gemmes AES-256-GCM-krypteret i app_secrets og lægges oven på
// process.env — resten af koden læser stadig process.env som før, så en
// rettet nøgle virker med det samme uden genstart. Slettes rækken, gælder
// værdien fra .env.production igen.
//
// Tilstanden ligger på globalThis, fordi instrumentation.ts og route-
// handlerne bundtes hver for sig og ellers ville have hver deres kopi.

type SecretState = {
  loaded: boolean;
  // Værdien fra .env, før admin-værdien blev lagt ovenpå.
  baseline: Map<string, string | undefined>;
  overrides: Map<string, { updatedAt: Date }>;
  // Rækker, der ikke kunne dekrypteres (fx fordi ADMIN_SESSION_SECRET er skiftet).
  unreadable: Set<string>;
};

const globalState = globalThis as typeof globalThis & { __helloCalSecrets?: SecretState };

function state(): SecretState {
  globalState.__helloCalSecrets ??= {
    loaded: false,
    baseline: new Map(),
    overrides: new Map(),
    unreadable: new Set(),
  };
  return globalState.__helloCalSecrets;
}

function encryptionKey() {
  const master = process.env.ADMIN_SESSION_SECRET;
  if (!master || master.length < 16) throw new Error("ADMIN_SESSION_SECRET mangler — kan ikke kryptere API-nøgler");
  return Buffer.from(hkdfSync("sha256", master, "hellocal-app-secrets", "api-keys-v1", 32));
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64")}`;
}

function decrypt(cipherText: string) {
  if (!cipherText.startsWith("v1:")) throw new Error("Ukendt format");
  const raw = Buffer.from(cipherText.slice(3), "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

function applyOverride(key: string, value: string, updatedAt: Date) {
  const s = state();
  if (!s.baseline.has(key)) s.baseline.set(key, process.env[key]);
  process.env[key] = value;
  s.overrides.set(key, { updatedAt });
  s.unreadable.delete(key);
}

// Kaldes ved opstart (instrumentation.ts) og igen af admin-siden, hvis
// opstarten ikke nåede databasen.
export async function loadStoredSecrets() {
  const s = state();
  const rows = await prisma.appSecret.findMany();
  for (const row of rows) {
    if (!isEditableKey(row.key)) continue;
    try {
      applyOverride(row.key, decrypt(row.cipherText), row.updatedAt);
    } catch {
      s.unreadable.add(row.key);
    }
  }
  s.loaded = true;
}

export async function ensureSecretsLoaded() {
  if (!state().loaded) await loadStoredSecrets();
}

export async function saveSecret(key: string, value: string, adminId: string) {
  if (!isEditableKey(key)) throw new Error("Nøglen kan ikke rettes fra admin");
  const cipherText = encrypt(value);
  const row = await prisma.appSecret.upsert({
    where: { key },
    create: { key, cipherText, updatedById: adminId },
    update: { cipherText, updatedById: adminId },
  });
  applyOverride(key, value, row.updatedAt);
}

// Fjerner admin-værdien, så .env.production gælder igen.
export async function resetSecret(key: string) {
  if (!isEditableKey(key)) throw new Error("Nøglen kan ikke rettes fra admin");
  await prisma.appSecret.deleteMany({ where: { key } });
  const s = state();
  if (s.baseline.has(key)) {
    const original = s.baseline.get(key);
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
    s.baseline.delete(key);
  }
  s.overrides.delete(key);
  s.unreadable.delete(key);
}

export type KeySource = "admin" | "env" | "missing";

export function keySource(key: string): { source: KeySource; updatedAt: Date | null; unreadable: boolean } {
  const s = state();
  const override = s.overrides.get(key);
  if (override) return { source: "admin", updatedAt: override.updatedAt, unreadable: false };
  return { source: process.env[key] ? "env" : "missing", updatedAt: null, unreadable: s.unreadable.has(key) };
}

// Samme kryptering til andre hemmeligheder, appen selv modtager fra en
// udbyder (fx MobilePay's webhook-hemmelighed, src/lib/payments).
export function encryptAppSecret(value: string) {
  return encrypt(value);
}

export function decryptAppSecret(cipherText: string) {
  return decrypt(cipherText);
}
