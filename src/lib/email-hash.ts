import { createHmac } from "node:crypto";

// docs/PRIVACY.md "Login og e-mail": almindelige brugeres e-mail gemmes kun
// som HMAC-SHA256 med en hemmelig server-pepper. Uden pepperen kan hashet
// ikke brute-forces ud fra lister over e-mailadresser. Pepperen må aldrig
// ændres, når der findes brugere — så kan ingen længere findes via e-mail.

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function getPepper(): string {
  const pepper = process.env.EMAIL_HASH_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error("EMAIL_HASH_PEPPER mangler eller er for kort (mindst 32 tegn)");
  }
  return pepper;
}

export function hashEmail(email: string): string {
  return createHmac("sha256", getPepper()).update(`email:${normalizeEmail(email)}`).digest("base64url");
}
