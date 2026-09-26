import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createTotpQrCode, createTotpSecret } from "@/lib/admin-totp";
import { findWorkerByInviteToken } from "@/lib/scan/invites";
import { SCAN_COOKIE_OPTIONS, SCAN_SETUP_COOKIE, SCAN_SETUP_MAX_AGE, signScanSetupPending } from "@/lib/scan/auth";

// Trin 1 af opsætningen fra invitationslinket: valider brugernavn og
// adgangskode, lav en TOTP-hemmelighed og returnér QR-koden til
// autenticator-appen. Intet skrives på medarbejderen før trin 2 (confirm).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const worker = await findWorkerByInviteToken(token);
  if (!worker) return NextResponse.json({ message: "Invitationslinket er ugyldigt eller udløbet" }, { status: 400 });
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json({ message: "Brugernavn: 3-32 tegn (a-z, 0-9, punktum, bindestreg)" }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json({ message: "Adgangskoden skal være mindst 10 tegn" }, { status: 400 });
  }
  const taken = await prisma.scanWorker.findUnique({ where: { username } });
  if (taken && taken.id !== worker.id) {
    return NextResponse.json({ message: "Brugernavnet er optaget" }, { status: 409 });
  }

  const totpSecret = createTotpSecret();
  const pending = await signScanSetupPending({
    workerId: worker.id,
    username,
    passwordHash: await bcrypt.hash(password, 12),
    totpSecret,
  });
  const response = NextResponse.json({ qrCode: await createTotpQrCode(`${username} (Oprettelses-app)`, totpSecret), secret: totpSecret });
  response.cookies.set(SCAN_SETUP_COOKIE, pending, { ...SCAN_COOKIE_OPTIONS, maxAge: SCAN_SETUP_MAX_AGE });
  return response;
}
