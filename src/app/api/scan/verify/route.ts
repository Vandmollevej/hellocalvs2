import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/admin-totp";
import {
  SCAN_COOKIE_OPTIONS,
  SCAN_MFA_COOKIE,
  SCAN_SESSION_COOKIE,
  SCAN_SESSION_MAX_AGE,
  signScanSession,
  verifyScanMfaPending,
} from "@/lib/scan/auth";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code : "";
  const store = await cookies();
  const token = store.get(SCAN_MFA_COOKIE)?.value;
  const workerId = token ? await verifyScanMfaPending(token) : null;
  if (!workerId) return NextResponse.json({ message: "Login-sessionen er udløbet, prøv igen" }, { status: 401 });

  const key = `scan-verify:${workerId}`;
  if (isLocked(key)) return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });

  const worker = await prisma.scanWorker.findUnique({ where: { id: workerId } });
  if (!worker || worker.status !== "ACTIVE" || !worker.totpSecret || !(await verifyTotpCode(worker.totpSecret, code))) {
    recordFailure(key);
    return NextResponse.json({ message: "Forkert kode" }, { status: 401 });
  }
  recordSuccess(key);
  await prisma.scanWorker.update({ where: { id: worker.id }, data: { lastLoginAt: new Date() } });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SCAN_SESSION_COOKIE, await signScanSession(worker.id), { ...SCAN_COOKIE_OPTIONS, maxAge: SCAN_SESSION_MAX_AGE });
  response.cookies.delete(SCAN_MFA_COOKIE);
  return response;
}
