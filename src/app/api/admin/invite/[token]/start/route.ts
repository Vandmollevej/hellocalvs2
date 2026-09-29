import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ADMIN_PASSWORD_REQUIREMENTS_MESSAGE, isAdminPasswordValid } from "@/lib/admin-password-policy";
import { createTotpQrCode, createTotpSecret } from "@/lib/admin-totp";
import { ADMIN_INVITE_COOKIE, ADMIN_SETUP_MAX_AGE, signAdminInvitePending } from "@/lib/admin-auth";
import { findUsableAdminInvite } from "@/lib/admin-invites";

// Trin 1 af tilmelding via invitation: gyldigt token + valgt adgangskode.
// Intet gemmes i databasen, før 2-faktor-koden er bekræftet i /confirm.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const invite = await findUsableAdminInvite(token);
  if (!invite) {
    return NextResponse.json({ message: "Invitationen er udløbet eller ikke gyldig" }, { status: 410 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!isAdminPasswordValid(password)) {
    return NextResponse.json({ message: ADMIN_PASSWORD_REQUIREMENTS_MESSAGE }, { status: 400 });
  }
  if (await prisma.user.findUnique({ where: { email: invite.email } })) {
    return NextResponse.json({ message: "Der findes allerede en bruger med denne e-mail" }, { status: 409 });
  }

  const totpSecret = createTotpSecret();
  const qrCodeDataUrl = await createTotpQrCode(invite.email, totpSecret);
  const pending = await signAdminInvitePending({
    inviteId: invite.id,
    passwordHash: await bcrypt.hash(password, 12),
    totpSecret,
  });

  const response = NextResponse.json({ qrCodeDataUrl, secret: totpSecret });
  response.cookies.set(ADMIN_INVITE_COOKIE, pending, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SETUP_MAX_AGE,
  });
  return response;
}
