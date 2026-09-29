import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ADMIN_MFA_COOKIE, ADMIN_MFA_MAX_AGE, signAdminMfaPending } from "@/lib/admin-auth";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { checkAdminLoginAllowed, logAdminLogin, requestInfo } from "@/lib/admin-access";

// A generic failure message avoids telling an attacker whether the email
// exists at all.
const GENERIC_FAILURE = { message: "Forkert email eller password" };
const LOCKED_FAILURE = { message: "For mange forsøg. Prøv igen senere." };

// A bcrypt hash of an unguessable placeholder, used only to keep the compare
// timing similar whether or not the email exists — so the response time
// doesn't leak which emails are valid admin accounts.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-used-for-timing-only", 12);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }

  const rateLimitKey = `login:${email}`;
  if (isLocked(rateLimitKey)) {
    return NextResponse.json(LOCKED_FAILURE, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const isValidAdmin = Boolean(user && user.role === "ADMIN" && user.passwordHash && user.totpSecret);
  const ok = await bcrypt.compare(password, isValidAdmin ? user!.passwordHash! : DUMMY_HASH);

  const info = requestInfo(req.headers);
  if (!isValidAdmin || !ok || !user) {
    recordFailure(rateLimitKey);
    if (isValidAdmin && user) await logAdminLogin(user.id, "PASSWORD_FAILED", "password", info);
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }
  recordSuccess(rateLimitKey);

  // Deaktiveret bruger eller IP uden for brugerens liste: samme generiske svar,
  // så det ikke afslører hvorfor (forsøget logges dog).
  if (!(await checkAdminLoginAllowed(user, info, "password"))) {
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }

  const mfaToken = await signAdminMfaPending(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_MFA_COOKIE, mfaToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MFA_MAX_AGE,
  });
  return response;
}
