import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

// Reel SMTP-afsendelse, forberedt men ikke aktiveret (docs/DECISIONS.md
// 2026-09-02): uden SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS i miljøet er
// dette en no-op — beskeden bliver stående som QUEUED i stedet for at fejle.
// Udfyld miljøvariablerne (se docs/DEPLOYMENT.md) for at aktivere reel
// afsendelse; ingen kodeændring er nødvendig derefter.

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  });
}

// Sender alle QUEUED e-mail/BOTH-beskeder. Kaldes fra scheduleren
// (src/lib/scheduler.ts). Er SMTP ikke opsat, rører den ikke ved køen —
// beskederne forbliver QUEUED til senere.
export async function flushQueuedEmails(limit = 25) {
  const transport = getTransport();
  if (!transport) return { sent: 0, skipped: "smtp_not_configured" as const };

  const fromAddress = process.env.SMTP_FROM || "Hello Cal <no-reply@hellocal.local>";
  const pending = await prisma.outboundMessage.findMany({
    where: { status: "QUEUED", channel: { in: ["EMAIL", "BOTH"] } },
    include: { user: true },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  let sent = 0;
  for (const message of pending) {
    const to = message.toEmail ?? message.user?.email;
    if (!to || !message.subject || !message.bodyHtml) {
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: { status: "FAILED", error: "Manglende modtager, emne eller indhold" },
      });
      continue;
    }
    try {
      await transport.sendMail({ from: fromAddress, to, subject: message.subject, html: message.bodyHtml });
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      sent += 1;
    } catch (error) {
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: { status: "FAILED", error: error instanceof Error ? error.message : "Ukendt fejl" },
      });
    }
  }

  return { sent };
}
