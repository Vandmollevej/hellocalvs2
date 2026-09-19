import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { USER_SESSION_COOKIE, USER_SESSION_MAX_AGE, signUserSession } from "@/lib/user-auth";

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
  if (password.length < 8) {
    return NextResponse.json({ message: "Adgangskoden skal være mindst 8 tegn" }, { status: 400 });
  }

  const user = await consumePasswordResetToken(token);
  if (!user) {
    return NextResponse.json(
      { message: "Linket er ugyldigt eller udløbet. Anmod om et nyt." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  const sessionToken = await signUserSession(user.id);
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
  response.cookies.set(USER_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE,
  });
  return response;
}
