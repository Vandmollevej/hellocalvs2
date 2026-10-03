import { prisma } from "@/lib/prisma";
import { sendTransientMail, APP_BASE_URL } from "@/lib/transient-mail";
import { INVITE_FROM } from "@/lib/mail-senders";
import { escapeHtml, hashToken, newToken } from "@/lib/admin-access";

// Invitation af B2B-brugere (docs/DECISIONS.md 2026-10-02). Kun en
// administrator med fuld adgang kan udstede en invitation (server actions i
// src/app/admin/partners/users/actions.ts); der findes ingen offentlig
// tilmelding til partnerportalen. Kun tokenets hash gemmes; linket gælder
// 72 timer og kan kun bruges én gang (tokenet nulstilles ved accept).

export const PARTNER_INVITE_TTL_HOURS = 72;
export const PARTNER_INVITE_LINK_COOKIE = "hc_partner_invite_link";

const PARTNER_BASE_URL = process.env.PARTNER_BASE_URL || APP_BASE_URL;

export function partnerInviteLink(token: string) {
  return `${PARTNER_BASE_URL}/partner/invite/${token}`;
}

export type PartnerUserStatus = "PENDING" | "EXPIRED" | "ACTIVE" | "DISABLED";

export function partnerUserStatus(user: {
  acceptedAt: Date | null;
  active: boolean;
  inviteExpiresAt: Date | null;
}): PartnerUserStatus {
  if (!user.acceptedAt) return user.inviteExpiresAt && user.inviteExpiresAt > new Date() ? "PENDING" : "EXPIRED";
  return user.active ? "ACTIVE" : "DISABLED";
}

export const PARTNER_USER_STATUS_LABEL: Record<PartnerUserStatus, string> = {
  PENDING: "Afventer invitation",
  EXPIRED: "Invitation udløbet",
  ACTIVE: "Aktiv",
  DISABLED: "Deaktiveret",
};

async function sendInviteMail({ name, email, partnerName, inviterName, link }: {
  name: string;
  email: string;
  partnerName: string;
  inviterName: string;
  link: string;
}) {
  await sendTransientMail({
    from: INVITE_FROM,
    to: email,
    subject: `Invitation til Hello Cals partnerportal — ${partnerName}`,
    devLink: link,
    html: `<p>Hej ${escapeHtml(name)}</p>
<p>${escapeHtml(inviterName)} fra Hello Cal har oprettet en adgang til jer hos <strong>${escapeHtml(partnerName)}</strong> i Hello Cals partnerportal. Her kan I følge visninger og klik på jeres placeringer og se de rapporter, vi sender.</p>
<p>Åbn linket for at vælge en adgangskode:</p>
<p><a href="${link}">${link}</a></p>
<p>Linket udløber om ${PARTNER_INVITE_TTL_HOURS} timer og kan kun bruges én gang. Har du ikke bedt om adgang, kan du se bort fra denne mail.</p>`,
  });
}

// Opretter en ny B2B-bruger som invitation (eller fornyer invitationen til en
// eksisterende, ikke-accepteret bruger) og returnerer linket, så det også kan
// gives videre manuelt, hvis mailen ikke kan sendes.
export async function issuePartnerInvite({
  partnerId,
  name,
  email,
  invitedById,
  inviterName,
}: {
  partnerId: string;
  name: string;
  email: string;
  invitedById: string;
  inviterName: string;
}) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId }, select: { id: true, name: true } });
  if (!partner) return { error: "partner" as const };

  const existing = await prisma.partnerUser.findUnique({ where: { email } });
  // En accepteret bruger kan ikke inviteres igen — så ville man kunne
  // overtage en eksisterende adgang ved at sende et nyt link.
  if (existing && existing.acceptedAt) return { error: "exists" as const };

  const token = newToken();
  const expiresAt = new Date(Date.now() + PARTNER_INVITE_TTL_HOURS * 60 * 60 * 1000);
  const data = { name, partnerId, invitedById, inviteTokenHash: hashToken(token), inviteExpiresAt: expiresAt, active: true };
  const user = existing
    ? await prisma.partnerUser.update({ where: { id: existing.id }, data })
    : await prisma.partnerUser.create({ data: { ...data, email } });

  const link = partnerInviteLink(token);
  let mailSent = true;
  try {
    await sendInviteMail({ name, email, partnerName: partner.name, inviterName, link });
  } catch {
    mailSent = false;
  }
  return { user, link, mailSent, expiresAt };
}

// Gensend til en eksisterende, ikke-accepteret bruger (nyt token, gammelt ugyldigt).
export async function resendPartnerInvite(partnerUserId: string, invitedById: string, inviterName: string) {
  const user = await prisma.partnerUser.findUnique({ where: { id: partnerUserId } });
  if (!user || user.acceptedAt) return null;
  return issuePartnerInvite({ partnerId: user.partnerId, name: user.name, email: user.email, invitedById, inviterName });
}

export async function findUsablePartnerInvite(token: string) {
  if (!token || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const user = await prisma.partnerUser.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    include: { partner: { select: { id: true, name: true } } },
  });
  if (!user || user.acceptedAt || !user.active) return null;
  if (!user.inviteExpiresAt || user.inviteExpiresAt < new Date()) return null;
  return user;
}
