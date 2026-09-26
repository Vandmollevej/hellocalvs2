import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/admin-totp";
import { findWorkerByInviteToken } from "@/lib/scan/invites";
import {
  SCAN_COOKIE_OPTIONS,
  SCAN_SESSION_COOKIE,
  SCAN_SESSION_MAX_AGE,
  SCAN_SETUP_COOKIE,
  signScanSession,
  verifyScanSetupPending,
} from "@/lib/scan/auth";

// Trin 2: første TOTP-kode bekræfter autenticator-appen. Først nu gemmes
// brugernavn/adgangskode/TOTP, invitationen forbruges og kontoen aktiveres.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token : "";
  const code = typeof body.code === "string" ? body.code : "";

  const store = await cookies();
  const pendingToken = store.get(SCAN_SETUP_COOKIE)?.value;
  const pending = pendingToken ? await verifyScanSetupPending(pendingToken) : null;
  const worker = await findWorkerByInviteToken(token);
  if (!pending || !worker || pending.workerId !== worker.id) {
    return NextResponse.json({ message: "Opsætningen er udløbet — start forfra fra linket" }, { status: 400 });
  }
  if (!(await verifyTotpCode(pending.totpSecret, code))) {
    return NextResponse.json({ message: "Forkert kode" }, { status: 401 });
  }

  try {
    await prisma.scanWorker.update({
      where: { id: worker.id },
      data: {
        username: pending.username,
        passwordHash: pending.passwordHash,
        totpSecret: pending.totpSecret,
        status: "ACTIVE",
        activatedAt: worker.activatedAt ?? new Date(),
        lastLoginAt: new Date(),
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });
  } catch {
    return NextResponse.json({ message: "Brugernavnet er optaget" }, { status: 409 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SCAN_SESSION_COOKIE, await signScanSession(worker.id), { ...SCAN_COOKIE_OPTIONS, maxAge: SCAN_SESSION_MAX_AGE });
  response.cookies.delete(SCAN_SETUP_COOKIE);
  return response;
}
