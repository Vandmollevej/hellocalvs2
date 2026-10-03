import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendSms } from "@/lib/sms";

// Glemt adgangskode via SMS (docs/DECISIONS.md 2026-10-02). En 6-cifret kode
// sendes til brugerens mobilnummer. Godkendes koden, udstedes et almindeligt
// PasswordResetToken, og brugeren vælger ny adgangskode på /reset-password —
// samme slutflow som mail-linket.
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// HMAC med serverhemmelighed: en 6-cifret kode kan ellers brute-forces
// offline ud fra en ren SHA-256, hvis databasen lækker.
function hashCode(userId: string, code: string) {
  const secret = process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "hellocal-sms";
  return createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");
}

export async function sendPasswordResetSms(user: { id: string; phone: string }) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  // Kun den nyeste kode gælder.
  await prisma.passwordResetSmsCode.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.passwordResetSmsCode.create({
    data: { userId: user.id, codeHash: hashCode(user.id, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });
  return sendSms(user.phone, `Din Hello Cal-kode er ${code}. Den virker i 10 minutter. Har du ikke bedt om den, kan du se bort fra beskeden.`);
}

// Returnerer et reset-token ved korrekt kode, ellers null.
export async function verifyPasswordResetSmsCode(email: string, code: string) {
  if (!/^\d{6}$/.test(code)) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.forgottenAt) return null;

  const record = await prisma.passwordResetSmsCode.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.attempts >= MAX_ATTEMPTS) return null;

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode(user.id, code), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await prisma.passwordResetSmsCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return null;
  }

  // Engangsbrug: markér kun som brugt, hvis ingen anden anmodning nåede først.
  const claimed = await prisma.passwordResetSmsCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  return createPasswordResetToken(user.id);
}
