import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { queueMessage } from "@/lib/messaging";

// Bekræft e-mail ved tilmelding (docs/DECISIONS.md 2026-09-25): blød model —
// brugeren kommer ind med det samme, men emailVerifiedAt sættes først, når
// linket i mailen er åbnet. Tokenet er et signeret JWT (bruger-ID + e-mail),
// så der ikke skal gemmes noget; skifter e-mailen, bliver gamle links ugyldige.
const TOKEN_TTL = "7d";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://hellocal.packroff.dk";

function secretKey() {
  const secret = process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("USER_SESSION_SECRET mangler eller er for kort");
  return new TextEncoder().encode(secret);
}

export async function sendEmailVerification(user: { id: string; email: string; displayName: string }) {
  const token = await new SignJWT({ sub: user.id, email: user.email, purpose: "email-verify" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey());
  await queueMessage("EMAIL_VERIFICATION", {
    userId: user.id,
    vars: { displayName: user.displayName, verificationLink: `${APP_BASE_URL}/verify-email?token=${token}` },
  });
}

// Returnerer true hvis e-mailen nu er bekræftet (også hvis den var det i forvejen).
export async function confirmEmailVerification(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== "email-verify" || typeof payload.sub !== "string") return false;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.forgottenAt || user.email !== payload.email) return false;
    if (!user.emailVerifiedAt) {
      await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    }
    return true;
  } catch {
    return false;
  }
}
