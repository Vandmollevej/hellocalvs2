import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { USER_SESSION_COOKIE, USER_SESSION_MAX_AGE, signUserSession } from "@/lib/user-auth";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

const GENERIC_FAILURE = { message: "Forkert e-mail eller adgangskode" };
const LOCKED_FAILURE = { message: "For mange forsøg. Prøv igen senere." };

// Samme timing-sikre mønster som src/app/api/admin/login/route.ts.
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

  const rateLimitKey = `user-login:${email}`;
  if (isLocked(rateLimitKey)) {
    return NextResponse.json(LOCKED_FAILURE, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const isValidUser = Boolean(user && user.passwordHash && !user.forgottenAt);
  const ok = await bcrypt.compare(password, isValidUser ? user!.passwordHash! : DUMMY_HASH);

  if (!isValidUser || !ok || !user) {
    recordFailure(rateLimitKey);
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }
  recordSuccess(rateLimitKey);

  const token = await signUserSession(user.id);
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
  response.cookies.set(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE,
  });
  return response;
}
