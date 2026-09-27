import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { ADMIN_PASSWORD_REQUIREMENTS_MESSAGE, isAdminPasswordValid } from "@/lib/admin-password-policy";
import { createTotpQrCode, createTotpSecret } from "@/lib/admin-totp";
import { ADMIN_SETUP_COOKIE, ADMIN_SETUP_MAX_AGE, signAdminSetupPending } from "@/lib/admin-auth";

// Trin 1 af admin-nulstilling: bruger mail-linkets token, vælger ny adgangskode
// og får en ny authenticator-QR. Intet gemmes før koden er bekræftet i
// /api/admin/reset-password/confirm (samme mønster som /api/admin/setup).
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token) {
    return NextResponse.json({ message: "Nulstillingslinket er ugyldigt" }, { status: 400 });
  }
  if (!isAdminPasswordValid(password)) {
    return NextResponse.json({ message: ADMIN_PASSWORD_REQUIREMENTS_MESSAGE }, { status: 400 });
  }

  const user = await consumePasswordResetToken(token);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ message: "Linket er ugyldigt eller udløbet. Anmod om et nyt." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const totpSecret = createTotpSecret();
  const qrCodeDataUrl = await createTotpQrCode(user.email, totpSecret);

  const setupToken = await signAdminSetupPending({ email: user.email, passwordHash, totpSecret });
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
