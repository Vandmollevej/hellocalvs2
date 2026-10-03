import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PARTNER_COOKIE_OPTIONS, PARTNER_SESSION_COOKIE, signPartnerSession } from "@/lib/partner/auth";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

// Login til partnerportalen (docs/DECISIONS.md 2026-10-02): e-mail +
// adgangskode. Der findes ingen tilmelding — kontoen er oprettet af en
// administrator via invitation. Generisk fejl, så svaret ikke afslører, om
// e-mailen findes; bcrypt-sammenligning altid, så svartiden heller ikke gør.
const GENERIC_FAILURE = { message: "Forkert e-mail eller adgangskode" };
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-used-for-timing-only", 12);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json(GENERIC_FAILURE, { status: 401 });

  const key = `partner-login:${email}`;
  if (isLocked(key)) return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });

  const user = await prisma.partnerUser.findUnique({ where: { email } });
  const valid = Boolean(user && user.active && user.acceptedAt && user.passwordHash);
  const ok = await bcrypt.compare(password, valid ? user!.passwordHash! : DUMMY_HASH);
  if (!valid || !ok || !user) {
    recordFailure(key);
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }
  recordSuccess(key);

  await prisma.partnerUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PARTNER_SESSION_COOKIE, await signPartnerSession(user.id), PARTNER_COOKIE_OPTIONS);
  return response;
}
