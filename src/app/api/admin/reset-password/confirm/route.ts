import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/admin-totp";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  ADMIN_SETUP_COOKIE,
  signAdminSession,
  verifyAdminSetupPending,
} from "@/lib/admin-auth";

// Trin 2 af admin-nulstilling: beviser at den nye QR-kode er scannet, gemmer
// ny adgangskode + authenticator-hemmelighed og logger admin ind, så en ny
// passkey kan tilføjes med det samme.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const store = await cookies();
  const setupToken = store.get(ADMIN_SETUP_COOKIE)?.value;
  const pending = setupToken ? await verifyAdminSetupPending(setupToken) : null;
  if (!pending) {
    return NextResponse.json({ message: "Nulstillingen er udløbet, anmod om et nyt link" }, { status: 400 });
  }

  const valid = await verifyTotpCode(pending.totpSecret, code);
  if (!valid) {
    return NextResponse.json({ message: "Forkert kode" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({ where: { email: pending.email } });
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ message: "Kontoen findes ikke" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash: pending.passwordHash, totpSecret: pending.totpSecret },
  });

  const sessionToken = await signAdminSession(admin.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_SETUP_COOKIE);
  response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return response;
}
