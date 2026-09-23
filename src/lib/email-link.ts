import { createHash, randomBytes } from "node:crypto";
import type { EmailLinkPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Engangslinks til en e-mail, som brugeren netop har tastet (tilmelding og
// gendannelse). Kun emailHash og tokenets hash gemmes.

const TTL_MS = 30 * 60 * 1000;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("base64url");
}

export async function createEmailLinkToken(purpose: EmailLinkPurpose, emailHash: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.emailLinkToken.create({
    data: { purpose, emailHash, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return raw;
}

// Finder et gyldigt, ubrugt token uden at forbruge det.
export async function findEmailLinkToken(purpose: EmailLinkPurpose, raw: string) {
  if (!raw) return null;
  const token = await prisma.emailLinkToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!token || token.purpose !== purpose || token.usedAt || token.expiresAt < new Date()) return null;
  return token;
}

export async function consumeEmailLinkToken(id: string) {
  const result = await prisma.emailLinkToken.updateMany({
    where: { id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return result.count === 1;
}
