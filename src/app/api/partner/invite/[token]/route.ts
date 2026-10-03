import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ADMIN_PASSWORD_REQUIREMENTS_MESSAGE, isAdminPasswordValid } from "@/lib/admin-password-policy";
import { PARTNER_COOKIE_OPTIONS, PARTNER_SESSION_COOKIE, signPartnerSession } from "@/lib/partner/auth";
import { findUsablePartnerInvite } from "@/lib/partner/invites";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

// Accept af invitation til partnerportalen (docs/DECISIONS.md 2026-10-02):
// gyldigt engangstoken + valgt adgangskode. Tokenet nulstilles i samme
// opdatering, så linket kun kan bruges én gang, og brugeren logges ind.
// Dette er den ENESTE vej til en B2B-konto — invitationen er udstedt af en
// administrator, og uden gyldigt token oprettes intet.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const password = typeof body.password === "string" ? body.password : "";

  const key = `partner-invite:${token.slice(0, 16)}`;
  if (isLocked(key)) return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });

  const invite = await findUsablePartnerInvite(token);
  if (!invite) {
    recordFailure(key);
    return NextResponse.json({ message: "Invitationen er udløbet eller allerede brugt" }, { status: 410 });
  }
  if (!isAdminPasswordValid(password)) {
    return NextResponse.json({ message: ADMIN_PASSWORD_REQUIREMENTS_MESSAGE }, { status: 400 });
  }
  recordSuccess(key);

  const now = new Date();
  // Kun ét samtidigt forsøg må bruge tokenet: opdateringen rammer kun rækken,
  // hvis den stadig er uaccepteret med netop dette token.
  const claimed = await prisma.partnerUser.updateMany({
    where: { id: invite.id, acceptedAt: null, inviteTokenHash: invite.inviteTokenHash },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      acceptedAt: now,
      lastLoginAt: now,
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
  });
  if (claimed.count !== 1) return NextResponse.json({ message: "Invitationen er allerede brugt" }, { status: 410 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(PARTNER_SESSION_COOKIE, await signPartnerSession(invite.id), PARTNER_COOKIE_OPTIONS);
  return response;
}
