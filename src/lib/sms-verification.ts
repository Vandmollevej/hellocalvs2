import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isSmsConfigured, sendSms } from "@/lib/teammessage";

// 6-cifret SMS-kode ved tilmelding og glemt adgangskode (docs/DECISIONS.md
// 2026-10-02). Koden gemmes kun som HMAC-hash, gælder i 10 minutter, giver 5
// forsøg og kan kun bruges én gang.
export type SmsPurpose = "SIGNUP" | "PASSWORD_RESET";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_PER_PHONE_PER_HOUR = 5;

function secret() {
  const value = process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 16) throw new Error("USER_SESSION_SECRET mangler eller er for kort");
  return value;
}

function hashCode(verificationId: string, code: string) {
  return createHmac("sha256", secret()).update(`${verificationId}:${code}`).digest("hex");
}

export type SendCodeResult =
  | { ok: true; verificationId: string }
  | { ok: false; reason: "not-configured" | "too-soon" | "too-many" | "send-failed" };

export async function sendVerificationCode(input: {
  purpose: SmsPurpose;
  phone: string;
  userId?: string;
  resetTokenHash?: string;
}): Promise<SendCodeResult> {
  const now = Date.now();
  const recent = await prisma.smsVerification.findMany({
    where: { phone: input.phone, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, reason: "too-soon" };
  }
  if (recent.length >= MAX_PER_PHONE_PER_HOUR) return { ok: false, reason: "too-many" };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  // Uden TeamMessage-opsætning logges koden kun lokalt (aldrig i produktion).
  if (!isSmsConfigured() && process.env.NODE_ENV === "production") {
    return { ok: false, reason: "not-configured" };
  }

  const record = await prisma.smsVerification.create({
    data: {
      purpose: input.purpose,
      phone: input.phone,
      userId: input.userId ?? null,
      resetTokenHash: input.resetTokenHash ?? null,
      codeHash: "pending",
      expiresAt: new Date(now + CODE_TTL_MS),
    },
    select: { id: true },
  });
  await prisma.smsVerification.update({
    where: { id: record.id },
    data: { codeHash: hashCode(record.id, code) },
  });

  if (!isSmsConfigured()) {
    console.warn(`[dev] SMS-kode til ${input.phone}: ${code}`);
    return { ok: true, verificationId: record.id };
  }

  const result = await sendSms(
    input.phone,
    `Din Hello Cal-kode er ${code}. Den udløber om 10 minutter. Del den aldrig med nogen.`
  );
  if (!result.ok) {
    await prisma.smsVerification.delete({ where: { id: record.id } }).catch(() => undefined);
    return { ok: false, reason: "send-failed" };
  }
  return { ok: true, verificationId: record.id };
}

// Kontrollerer koden og forbruger den. Forkert kode tæller som forsøg.
export async function checkVerificationCode(input: {
  verificationId: string;
  code: string;
  purpose: SmsPurpose;
  phone?: string;
  resetTokenHash?: string;
}): Promise<boolean> {
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code) || !input.verificationId) return false;

  const record = await prisma.smsVerification.findUnique({ where: { id: input.verificationId } });
  if (
    !record ||
    record.purpose !== input.purpose ||
    record.usedAt ||
    record.expiresAt < new Date() ||
    record.attempts >= MAX_ATTEMPTS ||
    (input.phone !== undefined && record.phone !== input.phone) ||
    (input.resetTokenHash !== undefined && record.resetTokenHash !== input.resetTokenHash)
  ) {
    return false;
  }

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode(record.id, code), "hex");
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!match) {
    await prisma.smsVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  // updateMany med usedAt: null gør forbruget atomisk (ingen dobbelt-brug).
  const consumed = await prisma.smsVerification.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return consumed.count === 1;
}

export function smsFailureMessage(reason: Exclude<SendCodeResult, { ok: true }>["reason"]) {
  switch (reason) {
    case "too-soon":
      return "Vent et minut, før du beder om en ny kode.";
    case "too-many":
      return "For mange koder er sendt til dette nummer. Prøv igen senere.";
    case "not-configured":
      return "SMS-bekræftelse er ikke slået til endnu. Prøv igen senere.";
    default:
      return "Vi kunne ikke sende SMS-koden. Tjek nummeret og prøv igen.";
  }
}
