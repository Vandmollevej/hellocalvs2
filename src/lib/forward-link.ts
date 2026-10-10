// Server-only: krypteret videresend-link (docs/DECISIONS.md 2026-10-09).
// Linket /forward/<segl> indeholder forwardens token og udløbstidspunkt
// AES-256-GCM-krypteret, så intet kan læses eller ændres i linket, og
// udløbet ikke kan forlænges af modtageren. Nøglen afledes af
// ADMIN_SESSION_SECRET med eget formål (samme mønster som
// src/lib/family-invite-token.ts). Gamle, almindelige tokens virker stadig.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { APP_BASE_URL } from "@/lib/transient-mail";

function key() {
  const master = process.env.ADMIN_SESSION_SECRET;
  if (!master || master.length < 16) throw new Error("ADMIN_SESSION_SECRET mangler — kan ikke kryptere videresend-links");
  return Buffer.from(hkdfSync("sha256", master, "hellocal-forward", "forward-link-v1", 32));
}

/** Krypterer token + udløb (ms siden epoch, null = udløber aldrig). */
export function sealForwardToken(token: string, expiresAt: Date | null) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const json = JSON.stringify({ t: token, x: expiresAt ? expiresAt.getTime() : null });
  const data = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

/** Åbner et segl; null hvis det ikke er et gyldigt segl (så behandles det som et gammelt almindeligt token). */
export function openForwardToken(sealed: string): { token: string; expiresAt: Date | null } | null {
  try {
    const raw = Buffer.from(sealed, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(json) as { t?: unknown; x?: unknown };
    if (typeof parsed.t !== "string") return null;
    return { token: parsed.t, expiresAt: typeof parsed.x === "number" ? new Date(parsed.x) : null };
  } catch {
    return null;
  }
}

export function forwardUrl(token: string, expiresAt: Date | null) {
  return `${APP_BASE_URL.replace(/\/$/, "")}/forward/${sealForwardToken(token, expiresAt)}`;
}
