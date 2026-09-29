import { prisma } from "@/lib/prisma";
import { sendTransientMail } from "@/lib/transient-mail";
import {
  ADMIN_INVITE_TTL_HOURS,
  adminInviteLink,
  escapeHtml,
  formatPlace,
  hashToken,
  newToken,
  type RequestInfo,
} from "@/lib/admin-access";

// Invitation til admin-panelet (docs/DECISIONS.md 2026-09-29): 24 timers link,
// modtageren vælger selv adgangskode og opsætter 2-faktor. Kun hashen gemmes.

export const ADMIN_INVITE_LINK_COOKIE = "hc_admin_invite_link";
export const LEVEL_LABEL = { READ: "Læseadgang", FULL: "Administrator" } as const;

// Opretter en ny invitation (eller fornyer en ubrugt til samme mail) og
// returnerer linket, så det også kan kopieres, hvis mailen ikke kan sendes.
export async function issueAdminInvite({
  email,
  name,
  accessLevel,
  invitedById,
  inviterName,
}: {
  email: string;
  name: string;
  accessLevel: "READ" | "FULL";
  invitedById: string;
  inviterName: string;
}) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + ADMIN_INVITE_TTL_HOURS * 60 * 60 * 1000);

  // Tidligere ubrugte invitationer til samme mail trækkes tilbage.
  await prisma.adminInvite.updateMany({
    where: { email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const invite = await prisma.adminInvite.create({
    data: { email, name, accessLevel, tokenHash: hashToken(token), expiresAt, invitedById },
  });

  const link = adminInviteLink(token);
  let mailSent = true;
  try {
    await sendTransientMail({
      to: email,
      subject: "Invitation til Hello Cal Admin",
      devLink: link,
      html: `<p>Hej ${escapeHtml(name)}</p>
<p>${escapeHtml(inviterName)} har inviteret dig til Hello Cal Admin (${LEVEL_LABEL[accessLevel].toLowerCase()}). Åbn linket for at vælge adgangskode og sætte 2-faktor op med en authenticator-app:</p>
<p><a href="${link}">${link}</a></p>
<p>Linket udløber om ${ADMIN_INVITE_TTL_HOURS} timer og kan kun bruges én gang.</p>`,
    });
  } catch {
    mailSent = false;
  }
  return { invite, link, mailSent, expiresAt };
}

export async function findUsableAdminInvite(token: string) {
  if (!token) return null;
  const invite = await prisma.adminInvite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

// Underretning til den, der inviterede: mail (når SMTP er sat op) + markering i
// admin-panelet (acceptSeenAt = null indtil siden Admin-brugere er åbnet).
export async function notifyInviteAccepted(inviteId: string, info: RequestInfo) {
  const invite = await prisma.adminInvite.findUnique({ where: { id: inviteId }, include: { invitedBy: true } });
  if (!invite) return;
  try {
    await sendTransientMail({
      to: invite.invitedBy.email,
      subject: `${invite.name} har tilmeldt sig Hello Cal Admin`,
      html: `<p>Hej ${escapeHtml(invite.invitedBy.displayName)}</p>
<p><strong>${escapeHtml(invite.name)}</strong> (${escapeHtml(invite.email)}) har accepteret din invitation og er nu oprettet som ${LEVEL_LABEL[invite.accessLevel].toLowerCase()}.</p>
<p>Tilmeldt fra ${escapeHtml(info.deviceLabel)}, ${escapeHtml(formatPlace(info.country, info.city))}${info.ip ? ` (IP ${escapeHtml(info.ip)})` : ""}.</p>`,
    });
  } catch {
    // Mailen er en ekstra underretning; markeringen i admin-panelet er der altid.
  }
}
