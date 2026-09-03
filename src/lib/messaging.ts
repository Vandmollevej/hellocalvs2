import { prisma } from "@/lib/prisma";
import type { MessageEvent as MessageEventType } from "@prisma/client";

// Besked automatisering (docs/DECISIONS.md 2026-09-02): queueMessage() er
// den ENESTE indgang til at sende en mail/pushbesked i appen. Den slår
// skabelonen op, respekterer brugerens NotificationPreference (for de
// events der er styrbare), og lægger resultatet i OutboundMessage-køen med
// status QUEUED. Selve afsendelsen sker separat (src/lib/mailer.ts,
// src/lib/push.ts) og er no-op indtil SMTP/VAPID-miljøvariabler findes.

// Events brugeren selv kan slå fra under Profil/Indstillinger →
// Notifikationer. Alt andet er transaktionelt og sendes altid.
const USER_TOGGLEABLE_EVENTS: MessageEventType[] = [
  "FRIEND_REFERRAL",
  "PRODUCT_APPROVED",
  "PRODUCT_REJECTED",
  "BUG_REPORT_RESOLVED",
  "POINTS_AWARDED",
  "FRIEND_FORWARD_RECEIVED",
];

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

export async function queueMessage(
  event: MessageEventType,
  opts: { userId?: string; toEmail?: string; vars?: Record<string, string> } = {}
) {
  const template = await prisma.messageTemplate.findUnique({ where: { event } });
  if (!template || !template.enabled) {
    return prisma.outboundMessage.create({
      data: {
        userId: opts.userId,
        toEmail: opts.toEmail,
        event,
        channel: template?.channel ?? "EMAIL",
        status: "SKIPPED",
      },
    });
  }

  if (opts.userId && USER_TOGGLEABLE_EVENTS.includes(event)) {
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_event: { userId: opts.userId, event } },
    });
    const wantsEmail = pref?.email ?? true;
    const wantsPush = pref?.push ?? true;
    if (!wantsEmail && !wantsPush) {
      return prisma.outboundMessage.create({
        data: { userId: opts.userId, event, channel: template.channel, status: "SKIPPED" },
      });
    }
  }

  const vars = opts.vars ?? {};
  return prisma.outboundMessage.create({
    data: {
      userId: opts.userId,
      toEmail: opts.toEmail,
      event,
      channel: template.channel,
      subject: renderTemplate(template.subject, vars),
      bodyHtml: renderTemplate(template.bodyHtml, vars),
      status: "QUEUED",
    },
  });
}

// Standardskabeloner, seedet (upsert, aldrig overskriver en admin-redigeret
// række) for hvert MessageEvent, så "Besked automatisering"-fanen altid har
// noget at vise/redigere. Kaldes lazily fra admin-siden.
const DEFAULT_TEMPLATES: Record<MessageEventType, { subject: string; bodyHtml: string; channel: "EMAIL" | "PUSH" | "BOTH" }> = {
  ACCOUNT_CREATED: {
    subject: "Velkommen til Hello Cal",
    bodyHtml: "<p>Hej {{displayName}},</p><p>Din konto er oprettet. Velkommen til Hello Cal!</p>",
    channel: "EMAIL",
  },
  EMAIL_VERIFICATION: {
    subject: "Bekræft din e-mail",
    bodyHtml: "<p>Hej {{displayName}},</p><p>Bekræft din e-mail her: {{verificationLink}}</p>",
    channel: "EMAIL",
  },
  PASSWORD_RESET: {
    subject: "Nulstil din adgangskode",
    bodyHtml: "<p>Hej {{displayName}},</p><p>Nulstil din adgangskode her: {{resetLink}}</p>",
    channel: "EMAIL",
  },
  FRIEND_REFERRAL: {
    subject: "Din ven er nu med i Hello Cal",
    bodyHtml: "<p>Hej {{displayName}},</p><p>{{friendName}} har oprettet en konto via dit invite-link. I har begge optjent 300 points!</p>",
    channel: "BOTH",
    },
  PRODUCT_APPROVED: {
    subject: "Dit produkt er godkendt",
    bodyHtml: "<p>Hej {{displayName}},</p><p>Produktet \"{{productName}}\" er nu godkendt og du har optjent {{points}} points.</p>",
    channel: "BOTH",
  },
  PRODUCT_REJECTED: {
    subject: "Dit produkt blev ikke godkendt",
    bodyHtml: "<p>Hej {{displayName}},</p><p>Produktet \"{{productName}}\" kunne desværre ikke godkendes.</p>",
    channel: "EMAIL",
  },
  PRODUCT_ESCALATION_ADMIN: {
    subject: "Produkt venter på godkendelse (>48 timer)",
    bodyHtml: "<p>Produktet \"{{productName}}\" har ventet mere end 48 timer.</p><p><a href=\"{{approveLink}}\">Godkend/afvis direkte</a></p>",
    channel: "EMAIL",
  },
  BUG_REPORT_ESCALATION_ADMIN: {
    subject: "Fejlrapport venter på gennemgang (>48 timer)",
    bodyHtml: "<p>En fejlrapport fra {{displayName}} har ventet mere end 48 timer.</p><p><a href=\"{{approveLink}}\">Gennemgå direkte</a></p>",
    channel: "EMAIL",
  },
  BUG_REPORT_RESOLVED: {
    subject: "Din fejlrapport er godkendt",
    bodyHtml: "<p>Hej {{displayName}},</p><p>Tak for din fejlrapport — den er godkendt og du har optjent 10 points.</p>",
    channel: "BOTH",
  },
  POINTS_AWARDED: {
    subject: "Du har optjent points",
    bodyHtml: "<p>Hej {{displayName}},</p><p>Du har lige optjent {{points}} points. Din nye saldo er {{balance}}.</p>",
    channel: "PUSH",
  },
  FRIEND_FORWARD_RECEIVED: {
    subject: "{{senderName}} har sendt dig noget",
    bodyHtml: "<p>Hej {{displayName}},</p><p>{{senderName}} har videresendt \"{{itemName}}\" til dig i Hello Cal.</p>",
    channel: "BOTH",
  },
};

export async function ensureDefaultMessageTemplates() {
  await Promise.all(
    (Object.entries(DEFAULT_TEMPLATES) as [MessageEventType, (typeof DEFAULT_TEMPLATES)[MessageEventType]][]).map(
      ([event, tpl]) =>
        prisma.messageTemplate.upsert({
          where: { event },
          create: { event, subject: tpl.subject, bodyHtml: tpl.bodyHtml, channel: tpl.channel },
          update: {},
        })
    )
  );
}

export { USER_TOGGLEABLE_EVENTS };
