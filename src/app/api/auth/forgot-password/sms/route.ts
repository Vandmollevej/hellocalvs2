import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetSms } from "@/lib/password-reset-sms";
import { isLocked, recordFailure } from "@/lib/rate-limit";

// Glemt adgangskode via SMS, trin 1: send kode. Svaret er altid det samme,
// så flowet ikke afslører, om kontoen eller et mobilnummer findes.
const GENERIC_RESPONSE = {
  message: "Hvis kontoen findes og har et mobilnummer, har vi sendt en kode på SMS.",
};

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

  // Hver SMS koster penge: højst 5 pr. konto pr. 15 minutter.
  const rateLimitKey = `forgot-password-sms:${email}`;
  if (isLocked(rateLimitKey)) {
    return NextResponse.json(GENERIC_RESPONSE);
  }
  recordFailure(rateLimitKey);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.forgottenAt && user.phone) {
    await sendPasswordResetSms({ id: user.id, phone: user.phone });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
