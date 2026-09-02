import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({ user }, { status: 201 });
}
