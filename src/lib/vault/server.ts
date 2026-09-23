import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// Serverdelen af boksen (docs/PRIVACY.md "Boks"). Serveren ser kun
// uigennemsigtige tags, tilfældige post-ID'er og ciphertext.
//
// Boksen findes via headeren x-vault-token: boks-ID = SHA-256(token).
// Kaldet kræver desuden en gyldig brugersession (mod misbrug af lagerplads),
// men koblingen konto ↔ boks gemmes ALDRIG og må ikke logges.

export const VAULT_TOKEN_HEADER = "x-vault-token";
export const INBOX_TOKEN_HEADER = "x-inbox-token";

const B64URL = /^[A-Za-z0-9_-]+$/;

export function idFromSecretToken(token: string | null): string | null {
  if (!token || token.length < 40 || token.length > 64 || !B64URL.test(token)) return null;
  return createHash("sha256").update(Buffer.from(token, "base64url")).digest("base64url");
}

export function isBase64Url(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && B64URL.test(value);
}

const ACCESS_TOUCH_MS = 24 * 60 * 60 * 1000;

// Returnerer boks-ID, hvis token og session er gyldige og boksen findes.
export async function resolveVault(req: Request): Promise<{ vaultId: string } | { error: string; status: number }> {
  const user = await getSessionUser();
  if (!user) return { error: "Ikke logget ind", status: 401 };
  const vaultId = idFromSecretToken(req.headers.get(VAULT_TOKEN_HEADER));
  if (!vaultId) return { error: "Ugyldig boks", status: 400 };
  const vault = await prisma.vault.findUnique({ where: { id: vaultId }, select: { id: true, lastAccessAt: true } });
  if (!vault) return { error: "Boksen findes ikke", status: 404 };
  if (Date.now() - vault.lastAccessAt.getTime() > ACCESS_TOUCH_MS) {
    await prisma.vault.update({ where: { id: vaultId }, data: { lastAccessAt: new Date() } });
  }
  return { vaultId };
}

// Max-størrelser for én post (base64url-tegn). Et billede hører ikke hjemme
// i en post; store data deles op af klienten.
export const MAX_CIPHERTEXT_CHARS = 512 * 1024;
export const MAX_BATCH = 500;
