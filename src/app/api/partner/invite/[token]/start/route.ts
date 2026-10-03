import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ADMIN_PASSWORD_REQUIREMENTS_MESSAGE, isAdminPasswordValid } from "@/lib/admin-password-policy";
import { createTotpQrCode, createTotpSecret } from "@/lib/admin-totp";
import {
  PARTNER_COOKIE_OPTIONS,
  PARTNER_SETUP_COOKIE,
  PARTNER_SETUP_MAX_AGE,
  signPartnerInvitePending,
} from "@/lib/partner/auth";
import { findUsablePartnerInvite } from "@/lib/partner/invites";
import { isLocked, recordFailure } from "@/lib/rate-limit";

// Trin 1 af tilmelding via invitation (docs/DECISIONS.md 2026-10-02): gyldigt
// engangstoken + valgt adgangskode. Intet gemmes i databasen, før 2-faktor-
// koden er bekræftet i /confirm. Dette er den ENESTE vej til en B2B-konto, og
// invitationen er udstedt af en administrator.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const password = typeof body.password === "string" ? body.password : "";

  const key = `partner-invite:${token.slice(0, 16)}`;
  if (isLocked(key)) return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });

  const invite = await findUsablePartnerInvite(token);
  if (!invite) {
    recordFailure(key);
    return NextResponse.json({ message: "Invitationen er udløbet eller allerede brugt" }, { status: 410 });
  }
  if (!isAdminPasswordValid(password)) {
    return NextResponse.json({ message: ADMIN_PASSWORD_REQUIREMENTS_MESSAGE }, { status: 400 });
  }

  const totpSecret = createTotpSecret();
  const qrCodeDataUrl = await createTotpQrCode(invite.email, totpSecret, "HELLO CAL Partner");
  const pending = await signPartnerInvitePending({
    partnerUserId: invite.id,
    passwordHash: await bcrypt.hash(password, 12),
    totpSecret,
  });

  const response = NextResponse.json({ qrCodeDataUrl, secret: totpSecret });
  response.cookies.set(PARTNER_SETUP_COOKIE, pending, { ...PARTNER_COOKIE_OPTIONS, maxAge: PARTNER_SETUP_MAX_AGE });
  return response;
}
