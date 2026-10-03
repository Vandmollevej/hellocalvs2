import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/admin-totp";
import {
  PARTNER_COOKIE_OPTIONS,
  PARTNER_SESSION_COOKIE,
  PARTNER_SETUP_COOKIE,
  signPartnerSession,
  verifyPartnerInvitePending,
} from "@/lib/partner/auth";
import { findUsablePartnerInvite } from "@/lib/partner/invites";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

// Trin 2: 2-faktor-koden bekræftes, adgangskode og hemmelighed gemmes,
// tokenet nulstilles (engangsbrug), og brugeren logges ind.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code : "";

  const store = await cookies();
  const pendingToken = store.get(PARTNER_SETUP_COOKIE)?.value;
  const pending = pendingToken ? await verifyPartnerInvitePending(pendingToken) : null;
  const invite = await findUsablePartnerInvite(token);
  if (!pending || !invite || pending.partnerUserId !== invite.id) {
    return NextResponse.json({ message: "Tilmeldingen er udløbet, prøv igen" }, { status: 400 });
  }

  const key = `partner-invite-confirm:${invite.id}`;
  if (isLocked(key)) return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });
  if (!(await verifyTotpCode(pending.totpSecret, code))) {
    recordFailure(key);
    return NextResponse.json({ message: "Forkert kode" }, { status: 401 });
  }
  recordSuccess(key);

  const now = new Date();
  // Kun ét samtidigt forsøg må bruge tokenet.
  const claimed = await prisma.partnerUser.updateMany({
    where: { id: invite.id, acceptedAt: null, inviteTokenHash: invite.inviteTokenHash },
    data: {
      passwordHash: pending.passwordHash,
      totpSecret: pending.totpSecret,
      acceptedAt: now,
      lastLoginAt: now,
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
  });
  if (claimed.count !== 1) return NextResponse.json({ message: "Invitationen er allerede brugt" }, { status: 410 });

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(PARTNER_SETUP_COOKIE);
  response.cookies.set(PARTNER_SESSION_COOKIE, await signPartnerSession(invite.id), PARTNER_COOKIE_OPTIONS);
  return response;
}
