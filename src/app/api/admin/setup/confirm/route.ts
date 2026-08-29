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

// Step 2 of admin setup: proves the QR code from /api/admin/setup was
// actually scanned correctly before anything is persisted to the database.
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
    return NextResponse.json({ message: "Opsætningen er udløbet, prøv igen" }, { status: 400 });
  }

  const valid = await verifyTotpCode(pending.totpSecret, code);
  if (!valid) {
    return NextResponse.json({ message: "Forkert kode" }, { status: 401 });
  }

  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN", passwordHash: { not: null } } });
  if (existingAdmin) {
    return NextResponse.json({ message: "En administrator findes allerede" }, { status: 409 });
  }

  const admin = await prisma.user.upsert({
    where: { email: pending.email },
    update: { role: "ADMIN", passwordHash: pending.passwordHash, totpSecret: pending.totpSecret },
    create: {
      email: pending.email,
      displayName: "Administrator",
      role: "ADMIN",
      passwordHash: pending.passwordHash,
      totpSecret: pending.totpSecret,
    },
  });

  // Log the new admin straight in so they can immediately add a passkey
  // (Face ID etc., see /admin/passkeys) without a separate login round-trip.
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
