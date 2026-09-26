import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTransientMail } from "@/lib/transient-mail";

// Invitation fra admin "scan-invites" (docs/OPRETTELSES-APP.md): admin
// opretter navn + mail, medarbejderen får et tidsbegrænset opsætningslink og
// vælger selv brugernavn, adgangskode og tofaktor. Kun tokenets hash gemmes.

export const SCAN_INVITE_TTL_DAYS = 7;
export const INVITE_LINK_COOKIE = "hc_scan_invite_link";

// Scan-appens egen adresse (separat container, docs/DEPLOYMENT.md).
export const SCAN_APP_BASE_URL = process.env.SCAN_APP_BASE_URL || "https://scanhellocal.packroff.dk";

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Opretter/fornyer invitationen og returnerer linket, så admin også kan
// kopiere det manuelt, hvis mailen ikke kan sendes.
export async function issueScanInvite(workerId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SCAN_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const worker = await prisma.scanWorker.update({
    where: { id: workerId },
    data: { inviteTokenHash: hashInviteToken(token), inviteExpiresAt: expiresAt, invitedAt: new Date() },
  });

  const link = `${SCAN_APP_BASE_URL}/scan/setup/${token}`;
  let mailSent = true;
  try {
    await sendTransientMail({
      to: worker.email,
      subject: "Invitation til Hello Cal Oprettelses-app",
      devLink: link,
      html: `<p>Hej ${escapeHtml(worker.name)}</p>
<p>Du er inviteret til Hello Cals Oprettelses-app. Åbn linket på din telefon for at vælge brugernavn, adgangskode og tofaktor-godkendelse:</p>
<p><a href="${link}">${link}</a></p>
<p>Linket udløber om ${SCAN_INVITE_TTL_DAYS} dage.</p>`,
    });
  } catch {
    mailSent = false;
  }
  return { link, mailSent, expiresAt };
}

export async function findWorkerByInviteToken(token: string) {
  if (!token) return null;
  const worker = await prisma.scanWorker.findUnique({ where: { inviteTokenHash: hashInviteToken(token) } });
  if (!worker || !worker.inviteExpiresAt || worker.inviteExpiresAt < new Date()) return null;
  if (worker.status === "DISABLED") return null;
  return worker;
}
