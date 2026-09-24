import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashEmail, normalizeEmail } from "@/lib/email-hash";
import { setUserSessionCookie } from "@/lib/user-session-cookie";

// Midlertidigt login med e-mail + kode (docs/DECISIONS.md 2026-09-24), indtil
// rigtig adgangskode-login er bygget. E-mail og kode ligger i miljøet
// (CODE_LOGIN_EMAIL, CODE_LOGIN_CODE); mangler de, er login slået fra. Boksens
// hovednøgle afledes af sessionshemmeligheden, så den er den samme på alle enheder.

function masterKeyFor(userId: string): string {
  const secret = process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("USER_SESSION_SECRET mangler eller er for kort");
  return createHmac("sha256", secret).update(`code-login-vault:${userId}`).digest("base64url");
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; code?: unknown } | null;
  const allowedEmail = normalizeEmail(process.env.CODE_LOGIN_EMAIL ?? "");
  const allowedCode = process.env.CODE_LOGIN_CODE ?? "";
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  if (!allowedEmail || !allowedCode || email !== allowedEmail || body?.code !== allowedCode) {
    return NextResponse.json({ message: "Forkert e-mail eller kode" }, { status: 401 });
  }

  const emailHash = hashEmail(email);
  const user = await prisma.user.upsert({ where: { emailHash }, update: {}, create: { emailHash } });

  const response = NextResponse.json({ userId: user.id, masterKey: masterKeyFor(user.id) });
  await setUserSessionCookie(response, user.id);
  return response;
}
