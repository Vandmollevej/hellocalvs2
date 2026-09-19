import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/password-reset";
import { queueMessage } from "@/lib/messaging";
import { isLocked, recordFailure } from "@/lib/rate-limit";

const APP_BASE_URL = process.env.APP_BASE_URL || "https://hellocal.packroff.dk";

// Afslører aldrig om en e-mail findes i systemet (samme generiske svar altid),
// så flowet ikke kan bruges til at liste registrerede konti.
const GENERIC_RESPONSE = { message: "Hvis kontoen findes, har vi sendt en mail med et link til at nulstille adgangskoden." };

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

  const rateLimitKey = `forgot-password:${email}`;
  if (isLocked(rateLimitKey)) {
    return NextResponse.json(GENERIC_RESPONSE);
  }
  recordFailure(rateLimitKey);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.passwordHash && !user.forgottenAt) {
    const rawToken = await createPasswordResetToken(user.id);
    const resetLink = `${APP_BASE_URL}/reset-password?token=${rawToken}`;
    await queueMessage("PASSWORD_RESET", {
      userId: user.id,
      vars: { displayName: user.displayName, resetLink },
    });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
