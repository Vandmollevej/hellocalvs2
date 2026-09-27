import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/password-reset";
import { queueMessage } from "@/lib/messaging";
import { isLocked, recordFailure } from "@/lib/rate-limit";

const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || "https://admin.hellocal.io";

// Samme generiske svar altid, så flowet ikke afslører om en admin-mail findes.
const GENERIC_RESPONSE = { message: "Hvis kontoen findes, har vi sendt en mail med et link til at nulstille adgangen." };

// Glemt adgangskode for admin: mailer et engangslink (1 time) til admin-mailen.
// Linket lader admin vælge ny adgangskode OG ny authenticator-kode, så 2-trins
// stadig kræves bagefter.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ message: "Angiv en gyldig e-mailadresse" }, { status: 400 });
  }

  const rateLimitKey = `admin-forgot-password:${email}`;
  if (isLocked(rateLimitKey)) {
    return NextResponse.json(GENERIC_RESPONSE);
  }
  recordFailure(rateLimitKey);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.role === "ADMIN" && !user.forgottenAt) {
    const rawToken = await createPasswordResetToken(user.id);
    const resetLink = `${ADMIN_BASE_URL}/admin/reset-password?token=${rawToken}`;
    await queueMessage("PASSWORD_RESET", {
      userId: user.id,
      vars: { displayName: user.displayName, resetLink },
    });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
