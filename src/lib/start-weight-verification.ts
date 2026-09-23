import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// Låst start-vægt (docs/DECISIONS.md 2026-09-22). Start-vægten ligger nu
// krypteret i brugerens boks (docs/PRIVACY.md), så serveren kan hverken se
// eller gemme den. Serveren står kun for selve e-mailverificeringen: et
// engangslink, der beviser, at brugeren har adgang til kontoens e-mail.
// Når linket er forbrugt, skriver klienten den nye vægt i boksen.
const START_WEIGHT_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutter

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function createStartWeightChangeToken(userId: string) {
  const rawToken = randomBytes(32).toString("hex");
  const now = new Date();

  // Kun det senest udstedte link skal kunne bruges.
  await prisma.$transaction([
    prisma.startWeightChangeToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.startWeightChangeToken.create({
      data: { userId, tokenHash: hashToken(rawToken), expiresAt: new Date(now.getTime() + START_WEIGHT_TOKEN_TTL_MS) },
    }),
  ]);
  return rawToken;
}

async function findValidToken(rawToken: string, userId: string) {
  if (!rawToken) return null;
  const record = await prisma.startWeightChangeToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!record || record.userId !== userId || record.usedAt || record.expiresAt <= new Date()) return null;
  return record;
}

// Kontrollerer linket uden at forbruge det. Linket gælder kun for den
// bruger, der er logget ind — det er kun hendes/hans boks, der kan ændres.
export async function isStartWeightTokenValid(rawToken: string, userId: string) {
  return Boolean(await findValidToken(rawToken, userId));
}

// Forbruger tokenet atomisk. true = klienten må skrive den nye start-vægt.
export async function consumeStartWeightToken(rawToken: string, userId: string) {
  const record = await findValidToken(rawToken, userId);
  if (!record) return false;
  const consumed = await prisma.startWeightChangeToken.updateMany({
    where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return consumed.count === 1;
}
