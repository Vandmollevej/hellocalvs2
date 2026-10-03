// Server-only: krypteret indhold i familiens QR-koder (docs/DECISIONS.md
// 2026-10-03). QR-koden er et link med koden og e-mailen AES-256-GCM-
// krypteret, så hverken kode eller e-mail står i klartekst i linket, og
// linket ikke kan ændres uden at dekrypteringen fejler. Nøglen afledes af
// ADMIN_SESSION_SECRET med sit eget formål (samme mønster som
// src/lib/api-keys/store.ts).

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { APP_BASE_URL } from "@/lib/transient-mail";

function key() {
  const master = process.env.ADMIN_SESSION_SECRET;
  if (!master || master.length < 16) throw new Error("ADMIN_SESSION_SECRET mangler — kan ikke kryptere familiekoder");
  return Buffer.from(hkdfSync("sha256", master, "hellocal-family", "family-invite-v1", 32));
}

export function encryptFamilyValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

export function decryptFamilyValue(token: string): string | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function createInviteToken(code: string, email: string) {
  return encryptFamilyValue(JSON.stringify({ c: code, e: email }));
}

export function readInviteToken(token: string): { code: string; email: string } | null {
  const json = decryptFamilyValue(token);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as { c?: unknown; e?: unknown };
    return typeof parsed.c === "string" && typeof parsed.e === "string" ? { code: parsed.c, email: parsed.e } : null;
  } catch {
    return null;
  }
}

// Join-koder åbner tilknytningssiden; login-koder til en profil uden login
// åbner siden, hvor medlemmet vælger sin adgangskode.
export function inviteUrl(token: string, kind: "join" | "claim") {
  const base = APP_BASE_URL.replace(/\/$/, "");
  return `${base}/family-code${kind === "join" ? "/join" : ""}?t=${token}`;
}
