import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { USER_SESSION_COOKIE, USER_SESSION_MAX_AGE, signUserSession } from "@/lib/user-auth";

// Rigtig e-mail-tilmelding (kalder ikke admin-login-koden). Der er endnu ikke
// sat SMTP op til at sende en verifikationsmail (se docs/STATUS.md "Next
// work"), så kontoen registreres og markeres som verificeret med det samme —
// den rigtige verifikationsmail eftermonteres, når SMTP findes.
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
      emailVerifiedAt: new Date(),
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

  const token = await signUserSession(user.id);
  const response = NextResponse.json({ user }, { status: 201 });
  response.cookies.set(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE,
  });
  return response;
}
