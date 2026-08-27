import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createTotpQrCode, createTotpSecret } from "@/lib/admin-totp";
import { ADMIN_SETUP_COOKIE, ADMIN_SETUP_MAX_AGE, signAdminSetupPending } from "@/lib/admin-auth";

// Step 1 of admin setup: only allowed while no admin account exists yet.
// Generates a TOTP secret and stores it (with the password hash) in a
// short-lived signed cookie — nothing is written to the database until the
// user proves they scanned the QR code correctly in /api/admin/setup/confirm.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !email.includes("@") || password.length < 12) {
    return NextResponse.json(
      { message: "Angiv en gyldig email og et password på mindst 12 tegn" },
      { status: 400 }
    );
  }

  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN", passwordHash: { not: null } } });
  if (existingAdmin) {
    return NextResponse.json({ message: "En administrator findes allerede" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const totpSecret = createTotpSecret();
  const qrCodeDataUrl = await createTotpQrCode(email, totpSecret);

  const setupToken = await signAdminSetupPending({ email, passwordHash, totpSecret });
  const response = NextResponse.json({ qrCodeDataUrl, secret: totpSecret });
  response.cookies.set(ADMIN_SETUP_COOKIE, setupToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SETUP_MAX_AGE,
  });
  return response;
}
