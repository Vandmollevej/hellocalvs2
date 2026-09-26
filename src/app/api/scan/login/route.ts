import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SCAN_COOKIE_OPTIONS, SCAN_MFA_COOKIE, SCAN_MFA_MAX_AGE, signScanMfaPending } from "@/lib/scan/auth";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

const GENERIC_FAILURE = { message: "Forkert brugernavn eller adgangskode" };
// Samme timing-beskyttelse som admin-login: sammenlign altid mod en hash.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-used-for-timing-only", 12);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) return NextResponse.json(GENERIC_FAILURE, { status: 401 });

  const key = `scan-login:${username}`;
  if (isLocked(key)) return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });

  const worker = await prisma.scanWorker.findUnique({ where: { username } });
  const valid = Boolean(worker && worker.status === "ACTIVE" && worker.passwordHash && worker.totpSecret);
  const ok = await bcrypt.compare(password, valid ? worker!.passwordHash! : DUMMY_HASH);
  if (!valid || !ok || !worker) {
    recordFailure(key);
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }
  recordSuccess(key);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SCAN_MFA_COOKIE, await signScanMfaPending(worker.id), { ...SCAN_COOKIE_OPTIONS, maxAge: SCAN_MFA_MAX_AGE });
  return response;
}
