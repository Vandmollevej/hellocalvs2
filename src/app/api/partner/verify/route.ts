import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/admin-totp";
import {
  PARTNER_COOKIE_OPTIONS,
  PARTNER_MFA_COOKIE,
  PARTNER_SESSION_COOKIE,
  signPartnerSession,
  verifyPartnerMfaPending,
} from "@/lib/partner/auth";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

// Trin 2 af login (docs/DECISIONS.md 2026-10-02): 2-faktor-kode efter korrekt
// adgangskode. Først her udstedes sessionen.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code : "";

  const store = await cookies();
  const mfaToken = store.get(PARTNER_MFA_COOKIE)?.value;
  const userId = mfaToken ? await verifyPartnerMfaPending(mfaToken) : null;
  if (!userId) return NextResponse.json({ message: "Login-sessionen er udløbet, prøv igen" }, { status: 401 });

  const key = `partner-verify:${userId}`;
  if (isLocked(key)) return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });

  const user = await prisma.partnerUser.findUnique({ where: { id: userId } });
  if (!user || !user.active || !user.acceptedAt || !user.totpSecret || !(await verifyTotpCode(user.totpSecret, code))) {
    recordFailure(key);
    return NextResponse.json({ message: "Forkert kode" }, { status: 401 });
  }
  recordSuccess(key);

  await prisma.partnerUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(PARTNER_MFA_COOKIE);
  response.cookies.set(PARTNER_SESSION_COOKIE, await signPartnerSession(user.id), PARTNER_COOKIE_OPTIONS);
  return response;
}
