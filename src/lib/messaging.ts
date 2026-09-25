import { prisma } from "@/lib/prisma";
import type { MessageChannel, MessageEvent as MessageEventType } from "@prisma/client";

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
  "BUG_REPORT_REJECTED",
  "POINTS_AWARDED",
  "FRIEND_FORWARD_RECEIVED",
];

// docs/PRIVACY.md: serveren kender ikke brugernes navne. Et manglende eller
// tomt {{displayName}} fjernes, så hilsnen blot bliver "Hej,".
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{(\w+)\}\}/g, (match, key) => (key === "displayName" ? vars[key] ?? "" : vars[key] ?? match))
    .replace(/Hej\s+,/g, "Hej,");
}

// Almindelige brugere har ingen e-mail på serveren (docs/PRIVACY.md), så
// e-mail kan ikke sendes til dem: BOTH bliver til PUSH, og ren EMAIL springes over.
async function channelFor(userId: string | undefined, channel: MessageChannel): Promise<MessageChannel | null> {
  if (!userId || channel === "PUSH") return channel;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user?.email) return channel;
  return channel === "BOTH" ? "PUSH" : null;
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

  const channel = opts.toEmail ? template.channel : await channelFor(opts.userId, template.channel);
  if (!channel) {
    return prisma.outboundMessage.create({
      data: { userId: opts.userId, event, channel: template.channel, status: "SKIPPED" },
    });
  }

  const vars = opts.vars ?? {};
  return prisma.outboundMessage.create({
    data: {
      userId: opts.userId,
      toEmail: opts.toEmail,
      event,
      channel,
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
  PASSWORD_CHANGED: {
    subject: "Din adgangskode til Hello Cal er ændret",
    bodyHtml:
      "<p>Hej {{displayName}},</p><p>Din adgangskode til Hello Cal er blevet ændret.</p><p>Hvis det var dig, behøver du ikke gøre noget.</p><p>Hvis du ikke selv har ændret adgangskoden, bør du straks <a href=\"{{resetLink}}\">nulstille din adgangskode</a> for at sikre din konto.</p><p>Hello Cal</p>",
    channel: "EMAIL",
  },
  START_WEIGHT_CHANGE: {
    subject: "Ændr din startvægt",
    bodyHtml:
      "<p>Hej {{displayName}},</p><p>Du har bedt om adgang til at ændre din startvægt i Hello Cal.</p><p>Tryk på linket nedenfor for at fortsætte.</p><p><a href=\"{{verificationLink}}\">Ændr startvægt</a></p><p>Linket kan kun bruges én gang og udløber efter 30 minutter.</p><p>Hvis du ikke har bedt om denne ændring, kan du ignorere denne e-mail.</p>",
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
  INGREDIENT_REQUEST_ADMIN: {
    subject: "Ny ingrediens ønsket: {{ingredientName}}",
    bodyHtml: "<p>En bruger har oprettet sin egen ingrediens \"{{ingredientName}}\", som ikke findes i databasen.</p><p><a href=\"{{reviewLink}}\">Tilføj den globalt eller afvis</a></p>",
    channel: "EMAIL",
  },
  BUG_REPORT_RESOLVED: {
    subject: "Din fejlrapport er godkendt",
    bodyHtml: "<p>Hej {{displayName}},</p><p>Tak for din fejlrapport — den er godkendt og du har optjent 10 points.</p>",
    channel: "BOTH",
  },
  BUG_REPORT_REJECTED: {
    subject: "Din indberetning blev ikke godkendt",
    bodyHtml: "<p>Hej {{displayName}},</p><p>Vi har gennemgået din indberetning, men kunne desværre ikke godkende den. Der er ikke overført points denne gang.</p>",
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
  FRIEND_INVITATION: {
    subject: "{{inviterName}} har inviteret dig til Hello Cal",
    bodyHtml: "<p>{{inviterName}} synes du skulle prøve Hello Cal.</p><p><a href=\"{{inviteUrl}}\">Opret din konto</a> — I optjener begge 300 points, når du er med. Linket er gyldigt i 7 dage.</p>",
    channel: "EMAIL",
  },
  DOCTOR_SHARE_INVITATION: {
    subject: "{{ownerName}} har inviteret dig til at følge deres fremgang i Hello Cal",
    bodyHtml: "<p>{{ownerName}} har inviteret dig til at se udvalgte data i Hello Cal.</p><p><a href=\"{{viewUrl}}\">Se oversigten</a> — invitationen er gyldig i 14 dage.</p>",
    channel: "EMAIL",
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
