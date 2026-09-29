import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/admin-totp";
import { ADMIN_MFA_COOKIE, verifyAdminMfaPending } from "@/lib/admin-auth";
import { finishAdminLogin, logAdminLogin, requestInfo } from "@/lib/admin-access";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const store = await cookies();
  const mfaToken = store.get(ADMIN_MFA_COOKIE)?.value;
  const userId = mfaToken ? await verifyAdminMfaPending(mfaToken) : null;
  if (!userId) {
    return NextResponse.json({ message: "Login-sessionen er udløbet, prøv igen" }, { status: 401 });
  }

  const rateLimitKey = `verify:${userId}`;
  if (isLocked(rateLimitKey)) {
    return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "ADMIN" || !user.totpSecret) {
    return NextResponse.json({ message: "Forkert kode" }, { status: 401 });
  }

  const valid = await verifyTotpCode(user.totpSecret, code);
  if (!valid) {
    recordFailure(rateLimitKey);
    await logAdminLogin(user.id, "CODE_FAILED", "password+totp", requestInfo(req.headers));
    return NextResponse.json({ message: "Forkert kode" }, { status: 401 });
  }
  recordSuccess(rateLimitKey);

  return finishAdminLogin(user, "password+totp", req, (response) => response.cookies.delete(ADMIN_MFA_COOKIE));
}
