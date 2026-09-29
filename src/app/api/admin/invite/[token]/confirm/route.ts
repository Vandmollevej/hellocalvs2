import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/admin-totp";
import { ADMIN_INVITE_COOKIE, ADMIN_SESSION_COOKIE, signAdminSession, verifyAdminInvitePending } from "@/lib/admin-auth";
import { findUsableAdminInvite, notifyInviteAccepted } from "@/lib/admin-invites";
import {
  logAdminLogin,
  readDeviceId,
  registerDevice,
  requestInfo,
  sessionCookieOptions,
  setDeviceCookie,
} from "@/lib/admin-access";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

// Trin 2: 2-faktor-koden bekræftes, brugeren oprettes, invitationen markeres
// som brugt, den der inviterede får besked, og den nye bruger logges ind.
// Enheden, invitationen accepteres fra, er godkendt fra start.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";

  const store = await cookies();
  const pendingToken = store.get(ADMIN_INVITE_COOKIE)?.value;
  const pending = pendingToken ? await verifyAdminInvitePending(pendingToken) : null;
  const invite = await findUsableAdminInvite(token);
  if (!pending || !invite || pending.inviteId !== invite.id) {
    return NextResponse.json({ message: "Tilmeldingen er udløbet, prøv igen" }, { status: 400 });
  }

  const rateLimitKey = `admin-invite:${invite.id}`;
  if (isLocked(rateLimitKey)) {
    return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });
  }
  if (!(await verifyTotpCode(pending.totpSecret, code))) {
    recordFailure(rateLimitKey);
    return NextResponse.json({ message: "Forkert kode" }, { status: 401 });
  }
  recordSuccess(rateLimitKey);

  if (await prisma.user.findUnique({ where: { email: invite.email } })) {
    return NextResponse.json({ message: "Der findes allerede en bruger med denne e-mail" }, { status: 409 });
  }

  const now = new Date();
  const user = await prisma.$transaction(async (tx) => {
    // Kun ét samtidigt forsøg må bruge invitationen.
    const claimed = await tx.adminInvite.updateMany({
      where: { id: invite.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: now },
    });
    if (claimed.count !== 1) return null;
    const created = await tx.user.create({
      data: {
        email: invite.email,
        displayName: invite.name,
        role: "ADMIN",
        adminAccessLevel: invite.accessLevel,
        passwordHash: pending.passwordHash,
        totpSecret: pending.totpSecret,
        emailVerifiedAt: now,
      },
    });
    await tx.adminInvite.update({ where: { id: invite.id }, data: { acceptedUserId: created.id } });
    return created;
  });
  if (!user) return NextResponse.json({ message: "Invitationen er allerede brugt" }, { status: 410 });

  const info = requestInfo(req.headers);
  const { deviceId } = await readDeviceId();
  await registerDevice(user.id, deviceId, info);
  await logAdminLogin(user.id, "SUCCESS", "invite", info);
  await notifyInviteAccepted(invite.id, info);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_INVITE_COOKIE);
  response.cookies.set(ADMIN_SESSION_COOKIE, await signAdminSession(user.id, user.adminAccessLevel), sessionCookieOptions());
  setDeviceCookie(response, deviceId);
  return response;
}
