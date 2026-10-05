// Field-level kryptering af persondata paa User (email, displayName).
// AES-256-GCM, tilfaeldig IV pr. vaerdi, versioneret praefiks. Se
// docs/DECISIONS.md (2026-10-04) og docs/DEPLOYMENT.md.
//
// Staar for sig selv (kun node:crypto) saa den kan testes med `npm test`.
// Noeglerne laeses fra miljoeet ved brug (aldrig ved import) og logges aldrig.
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

export const ENC_PREFIX = "enc:v1:";

export type CryptoKeys = { dataKey?: string; hashKey?: string };

function dataKeyBuffer(keys?: CryptoKeys): Buffer {
  const raw = keys?.dataKey ?? process.env.USER_DATA_KEY;
  if (!raw) throw new Error("USER_DATA_KEY mangler (32 bytes base64).");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("USER_DATA_KEY skal vaere 32 bytes base64.");
  return key;
}

function hashKeyBuffer(keys?: CryptoKeys): Buffer {
  const raw = keys?.hashKey ?? process.env.USER_EMAIL_HASH_KEY;
  if (!raw) throw new Error("USER_EMAIL_HASH_KEY mangler (base64, mindst 16 bytes).");
  const key = Buffer.from(raw, "base64");
  if (key.length < 16) throw new Error("USER_EMAIL_HASH_KEY er for kort (mindst 16 bytes base64).");
  return key;
}

// Falsk indtil begge noegler er sat i miljoeet. Saa skriver/slaar koden op i
// klartekst (som foer), saa en deploy foer env-noeglerne ikke braekker login.
// Backfill-scriptet krypterer raekkerne bagefter.
export function cryptoConfigured(): boolean {
  return Boolean(process.env.USER_DATA_KEY && process.env.USER_EMAIL_HASH_KEY);
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

export function encryptField(plain: string, keys?: CryptoKeys): string {
  if (isEncrypted(plain)) return plain; // allerede krypteret (idempotent)
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKeyBuffer(keys), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, ct]).toString("base64url");
}

// Uden praefiks = gammel klartekst (bagudkompatibel laesning).
export function decryptField(value: string, keys?: CryptoKeys): string {
  if (!isEncrypted(value)) return value;
  const buf = Buffer.from(value.slice(ENC_PREFIX.length), "base64url");
  if (buf.length < 28) throw new Error("Ugyldig krypteret vaerdi.");
  const decipher = createDecipheriv("aes-256-gcm", dataKeyBuffer(keys), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

export function normalizeEmailForHash(email: string): string {
  return email.trim().toLowerCase();
}

// Deterministisk opslagsnoegle (HMAC-SHA256, hex) til User.emailHash.
export function emailHash(email: string, keys?: CryptoKeys): string {
  return createHmac("sha256", hashKeyBuffer(keys)).update(normalizeEmailForHash(email)).digest("hex");
}
