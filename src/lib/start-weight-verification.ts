import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// Låst start-vægt (docs/DECISIONS.md 2026-09-22): User.weightKg kan efter
// første indtastning kun ændres via et e-mailverificeret engangslink. Kun
// hash af tokenet gemmes — den rå værdi findes kun i selve mail-linket
// (samme mønster som src/lib/password-reset.ts).
const START_WEIGHT_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutter

export const MIN_START_WEIGHT_KG = 25;
export const MAX_START_WEIGHT_KG = 400;

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function isValidStartWeight(weightKg: number) {
  return (
    Number.isFinite(weightKg) &&
    weightKg >= MIN_START_WEIGHT_KG &&
    weightKg <= MAX_START_WEIGHT_KG
  );
}

export function parseWeightInput(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value.trim().replace(",", "."));
  return Number.NaN;
}

export async function createStartWeightChangeToken(userId: string) {
  const rawToken = randomBytes(32).toString("hex");
  const now = new Date();

  // Kun det senest udstedte link skal kunne bruges.
  await prisma.$transaction([
    prisma.startWeightChangeToken.deleteMany({
      where: { userId, usedAt: null },
    }),
    prisma.startWeightChangeToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(now.getTime() + START_WEIGHT_TOKEN_TTL_MS),
      },
    }),
  ]);

  return rawToken;
}

export async function inspectStartWeightChangeToken(rawToken: string) {
  if (!rawToken) return null;

  const record = await prisma.startWeightChangeToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { weightKg: true, forgottenAt: true } } },
  });

  if (!record || record.usedAt || record.expiresAt <= new Date() || record.user.forgottenAt) {
    return null;
  }

  return { currentWeightKg: record.user.weightKg };
}

// Validerer tokenet igen, opdaterer User.weightKg og markerer tokenet brugt
// i én transaktion. Opretter bevidst IKKE en WeightEntry — start-vægt og
// dagsvægt holdes adskilt.
export async function changeStartWeightWithToken(rawToken: string, weightKg: number) {
  if (!rawToken || !isValidStartWeight(weightKg)) return null;

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const record = await tx.startWeightChangeToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { forgottenAt: true } } },
    });

    if (!record || record.usedAt || record.expiresAt <= now || record.user.forgottenAt) {
      return null;
    }

    // Betinget update: kun ét samtidigt request kan forbruge tokenet.
    const consumed = await tx.startWeightChangeToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) return null;

    return tx.user.update({
      where: { id: record.userId },
      data: { weightKg, startWeightUpdatedAt: now },
      select: { weightKg: true, startWeightUpdatedAt: true },
    });
  });
}
