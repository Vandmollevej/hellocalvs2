import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";

// Password-reset-tokens: kun hash gemmes i databasen (samme mønster som
// DeviceToken.tokenHash) — den rå værdi findes kun i selve mail-linket.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 time

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function createPasswordResetToken(userId: string) {
  const rawToken = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  return rawToken;
}

export async function consumePasswordResetToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date() || record.user.forgottenAt) {
    return null;
  }
  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record.user;
}
