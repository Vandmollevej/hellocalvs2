import { prisma } from "@/lib/prisma";
import { flushQueuedEmails } from "@/lib/mailer";
import { flushQueuedPush } from "@/lib/push";

// Udsendelse fra admin → Brugere til alle brugere (docs/DECISIONS.md
// 2026-10-03). Lægger én OutboundMessage pr. bruger og kanal i køen; selve
// afsendelsen sker i mailer.ts/push.ts. Mail og push er separate rækker, så
// hver kanal får sin egen status (en BOTH-række ville blive markeret SENT af
// mail-flushet, før push nåede at gå).

export const BROADCAST_MAX_SUBJECT = 120;
export const BROADCAST_MAX_MESSAGE = 2000;

export type BroadcastChannels = { email: boolean; push: boolean };

// Aktive brugere: ikke anonymiseret og ikke lukket.
const ACTIVE_USERS = { role: "USER" as const, forgottenAt: null, closedAt: null };

export async function broadcastAudience() {
  const [emailUsers, pushUsers] = await Promise.all([
    prisma.user.count({ where: ACTIVE_USERS }),
    prisma.user.count({ where: { ...ACTIVE_USERS, pushSubscriptions: { some: {} } } }),
  ]);
  return { emailUsers, pushUsers };
}

export function escapeBroadcastHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

export async function queueBroadcast(subject: string, message: string, channels: BroadcastChannels) {
  const users = await prisma.user.findMany({
    where: channels.push && !channels.email ? { ...ACTIVE_USERS, pushSubscriptions: { some: {} } } : ACTIVE_USERS,
    select: { id: true, displayName: true, pushSubscriptions: { select: { id: true }, take: 1 } },
  });

  const rows = [];
  for (const user of users) {
    const bodyHtml = `<p>Hej ${escapeBroadcastHtml(user.displayName)},</p><p>${escapeBroadcastHtml(message)}</p><p>Hello Cal</p>`;
    if (channels.email) {
      rows.push({ userId: user.id, event: "ADMIN_MESSAGE" as const, channel: "EMAIL" as const, subject, bodyHtml });
    }
    if (channels.push && user.pushSubscriptions.length > 0) {
      rows.push({ userId: user.id, event: "ADMIN_MESSAGE" as const, channel: "PUSH" as const, subject, bodyHtml });
    }
  }
  if (rows.length === 0) return { queued: 0, emails: 0, pushes: 0 };

  await prisma.outboundMessage.createMany({ data: rows });
  void drainQueues(channels);
  return {
    queued: rows.length,
    emails: rows.filter((row) => row.channel === "EMAIL").length,
    pushes: rows.filter((row) => row.channel === "PUSH").length,
  };
}

// Scheduleren tager kun 25 ad gangen hvert kvarter; en udsendelse tømmes
// i stedet i baggrunden med det samme.
async function drainQueues(channels: BroadcastChannels) {
  try {
    if (channels.email) {
      for (let i = 0; i < 400; i += 1) {
        const { sent } = await flushQueuedEmails(50);
        if (sent === 0) break;
      }
    }
    if (channels.push) {
      for (let i = 0; i < 400; i += 1) {
        const { sent } = await flushQueuedPush(50);
        if (sent === 0) break;
      }
    }
  } catch (error) {
    console.error("[broadcast] udsendelsen fejlede", error);
  }
}
