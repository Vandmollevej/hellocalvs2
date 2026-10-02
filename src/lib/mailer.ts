import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { NO_TRACKING_HEADERS, fromForEvent } from "@/lib/mail-senders";
import { DEFAULT_REPLY_TO, htmlToText, wrapEmailHtml } from "@/lib/email-format";
import { pushSentNotice } from "@/lib/sent-notices";

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
// Kun én afsendelse ad gangen i processen, så samme besked ikke sendes to
// gange, når queueMessage() og scheduleren flusher samtidig. Kommer der
// nye beskeder under en kørsel, køres der én gang til bagefter.
let flushing: Promise<{ sent: number }> | null = null;
let flushAgain = false;

export async function flushQueuedEmails(limit = 25): Promise<{ sent: number; skipped?: "smtp_not_configured" }> {
  if (!getTransport()) return { sent: 0, skipped: "smtp_not_configured" };
  if (flushing) {
    flushAgain = true;
    return flushing;
  }
  flushing = (async () => {
    let total = 0;
    do {
      flushAgain = false;
      total += (await flushOnce(limit)).sent;
    } while (flushAgain);
    return { sent: total };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function flushOnce(limit: number) {
  const transport = getTransport();
  if (!transport) return { sent: 0 };

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
      await transport.sendMail({
        from: fromForEvent(message.event),
        headers: NO_TRACKING_HEADERS,
        replyTo: process.env.SMTP_REPLY_TO || DEFAULT_REPLY_TO,
        to,
        subject: message.subject,
        html: wrapEmailHtml(message.bodyHtml),
        text: htmlToText(message.bodyHtml),
      });
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      if (message.userId) void pushSentNotice(message.userId, "EMAIL", message.subject);
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
