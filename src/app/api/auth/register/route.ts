import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { completeLogin } from "@/lib/user-login";
import { sendEmailVerification } from "@/lib/email-verification";

// Rigtig e-mail-tilmelding (kalder ikke admin-login-koden). Blød bekræftelse
// (docs/DECISIONS.md 2026-09-25): brugeren logges ind med det samme, men
// emailVerifiedAt sættes først, når linket i bekræftelsesmailen er åbnet.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const referralCode = typeof body.referralCode === "string" ? body.referralCode.trim() : "";

  if (!displayName) {
    return NextResponse.json({ message: "Angiv dit navn" }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ message: "Angiv en gyldig e-mailadresse" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { message: "Adgangskoden skal være mindst 8 tegn" },
      { status: 400 }
    );
  }

  // Udtrykkeligt samtykke til helbredsoplysninger (GDPR art. 9, docs/DECISIONS.md 2026-09-25).
  if (body.healthDataConsent !== true) {
    return NextResponse.json(
      { message: "Du skal give samtykke til behandling af helbredsoplysninger" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ message: "Der findes allerede en konto med den e-mail" }, { status: 409 });
  }

  const referrer = referralCode
    ? await prisma.user.findUnique({ where: { referralCode } })
    : null;

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      healthDataConsentAt: new Date(),
    },
    select: { id: true, email: true, displayName: true },
  });

  // "Invitér en ven" (docs/DECISIONS.md 2026-09-02): kun opret koblingen her.
  // Selve 300-points-belønningen gives først efter ventetiden, se
  // src/lib/referrals.ts og src/lib/scheduler.ts.
  if (referrer && referrer.id !== user.id) {
    await prisma.referral.create({
      data: { referrerId: referrer.id, referredUserId: user.id, referredRegisteredAt: new Date() },
    });
  }

  await sendEmailVerification(user);

  const response = NextResponse.json({ user }, { status: 201 });
  return completeLogin(req, response, user.id, "signup");
}
