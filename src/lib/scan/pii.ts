import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Kryptering i hvile af medarbejderes CPR-nummer og bank-reg.nr./konto
// (docs/OPRETTELSES-APP.md). Server-side AES-256-GCM — admin skal kunne læse
// felterne for at afregne løn, så dette er bevidst IKKE klient-boksen.
//
// Nøglen afledes af SCAN_PII_KEY (egen hemmelighed, genereres af deployet).
// Felter krypteret før SCAN_PII_KEY fandtes, blev krypteret med
// ADMIN_SESSION_SECRET; de kan stadig læses (reserve-nøgle) og krypteres med
// SCAN_PII_KEY, næste gang admin gemmer dem. SCAN_PII_KEY må aldrig skiftes.

const PREFIX = "v1:";

function deriveKey(secret: string) {
  return createHash("sha256").update(`hellocal-scan-pii:${secret}`).digest();
}

function getKey() {
  const secret = process.env.SCAN_PII_KEY || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SCAN_PII_KEY (eller ADMIN_SESSION_SECRET) mangler");
  return deriveKey(secret);
}

function decryptionKeys() {
  const keys = [getKey()];
  const legacy = process.env.ADMIN_SESSION_SECRET;
  if (process.env.SCAN_PII_KEY && legacy && legacy.length >= 16) keys.push(deriveKey(legacy));
  return keys;
}

export function encryptPii(value: string | null | undefined): string | null {
  const clean = value?.trim();
  if (!clean) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(clean, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptPii(value: string | null | undefined): string | null {
  if (!value || !value.startsWith(PREFIX)) return null;
  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  for (const key of decryptionKeys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    } catch {
      // Prøv næste nøgle.
    }
  }
  return null;
}

// Til visning for medarbejderen selv: kun de sidste 4 tegn.
export function maskTail(value: string | null, visible = 4) {
  if (!value) return null;
  const clean = value.replace(/\s/g, "");
  if (clean.length <= visible) return clean;
  return `${"•".repeat(clean.length - visible)}${clean.slice(-visible)}`;
}
