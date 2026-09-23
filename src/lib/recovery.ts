import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/email-link";

// Gendannelse med delt nøgle (docs/PRIVACY.md "Gendannelse").
//
// Brugeren har F (gendannelsesfilen), Hello Cal har S (RecoveryShare).
// En sag oprettes, når brugeren har bekræftet sin e-mail og vist, at de har
// filen (SHA-256(F) matcher). Support bekræfter identiteten personligt og
// godkender; først da udleveres S via et hemmeligt "claim"-token, som kun
// den gendannende enhed kender.

export const CASE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

const CASE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateCaseCode(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => CASE_ALPHABET[b % CASE_ALPHABET.length]).join("");
  return `HC-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function generateClaim(): { claim: string; claimHash: string } {
  const claim = randomBytes(32).toString("base64url");
  return { claim, claimHash: hashToken(claim) };
}

export function sameHash(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function findRequestByClaim(claim: unknown) {
  if (typeof claim !== "string" || claim.length < 20) return null;
  const request = await prisma.recoveryRequest.findUnique({ where: { releaseTokenHash: hashToken(claim) } });
  if (!request) return null;
  if ((request.status === "PENDING" || request.status === "APPROVED") && request.expiresAt < new Date()) {
    await prisma.recoveryRequest.update({ where: { id: request.id }, data: { status: "EXPIRED" } });
    return { ...request, status: "EXPIRED" as const };
  }
  return request;
}
