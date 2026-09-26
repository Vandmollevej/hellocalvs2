import { prisma } from "@/lib/prisma";
import { flushQueuedEmails } from "@/lib/mailer";
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
  "BUG_REPORT_REJECTED",
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
  // Er skabelonen endnu ikke seedet (admin har ikke åbnet "Besked
  // automatisering"), bruges standardskabelonen, så fx login-advarsler
  // altid sendes.
  const template =
    (await prisma.messageTemplate.findUnique({ where: { event } })) ??
    ({ ...DEFAULT_TEMPLATES[event], enabled: true } as const);
  if (!template.enabled) {
    return prisma.outboundMessage.create({
      data: {
        userId: opts.userId,
        toEmail: opts.toEmail,
        event,
        channel: template.channel,
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
  const message = await prisma.outboundMessage.create({
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

  // Send med det samme i stedet for at vente op til 15 min på scheduleren —
  // fx glemt adgangskode skal komme frem, mens brugeren venter.
  if (template.channel !== "PUSH") {
    void flushQueuedEmails().catch((error) => console.error("[mailer] flush fejlede", error));
  }
  return message;
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
    bodyHtml: "<p>Hej {{displayName}},</p><p><a href=\"{{verificationLink}}\">Bekræft din e-mail</a></p><p>Virker knappen ikke, så kopiér dette link: {{verificationLink}}</p>",
    channel: "EMAIL",
  },
  PASSWORD_RESET: {
    subject: "Nulstil din adgangskode",
    bodyHtml: "<p>Hej {{displayName}},</p><p><a href=\"{{resetLink}}\">Nulstil din adgangskode</a> (linket virker i 1 time).</p><p>Virker linket ikke, så kopiér dette: {{resetLink}}</p><p>Har du ikke bedt om det, kan du se bort fra mailen.</p>",
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
    bodyHtml: "<p>{{inviterName}} synes du skulle prøve Hello Cal.</p>{{personalMessage}}<p><a href=\"{{inviteUrl}}\">Opret din konto</a> — I optjener begge 300 points, når du er med. Linket er gyldigt i 7 dage.</p>",
    channel: "EMAIL",
  },
  DOCTOR_SHARE_INVITATION: {
    subject: "{{ownerName}} har inviteret dig til at følge deres fremgang i Hello Cal",
    bodyHtml: "<p>{{ownerName}} har inviteret dig til at se udvalgte data i Hello Cal.</p><p><a href=\"{{viewUrl}}\">Se oversigten</a> — invitationen er gyldig i 14 dage.</p>",
    channel: "EMAIL",
  },
  NEW_DEVICE_LOGIN: {
    subject: "Nyt login på din Hello Cal-konto",
    bodyHtml:
      "<p>Hej {{displayName}},</p><p>Der er netop logget ind på din Hello Cal-konto fra en ny enhed eller et nyt sted.</p><p><strong>Enhed:</strong> {{device}}<br><strong>Sted:</strong> {{location}}<br><strong>Tidspunkt:</strong> {{time}}<br><strong>Login med:</strong> {{method}}</p><p>Hvis det var dig, behøver du ikke gøre noget.</p><p>Hvis det ikke var dig, bør du straks <a href=\"{{resetLink}}\">skifte din adgangskode</a>.</p><p>Hello Cal</p>",
    channel: "EMAIL",
  },
  ADMIN_MESSAGE: {
    subject: "Besked fra Hello Cal om {{productName}}",
    bodyHtml: "<p>Hej {{displayName}},</p><p>Tak for din rettelse af \"{{productName}}\". Vi har en besked til dig:</p><p>{{message}}</p><p>Hello Cal</p>",
    channel: "EMAIL",
  },
  // Support-indbakke (docs/DECISIONS.md 2026-09-26). Variablerne er allerede
  // HTML-escaped i src/lib/support-inbox.ts.
  // Svaret læses i appen (push + indbakke, ingen mail). {{reply}} er også
  // tilgængelig, hvis admin vil vise svaret direkte i beskeden.
  SUPPORT_REPLY: {
    subject: "Svar fra Hello Cal Support: {{subject}}",
    bodyHtml:
      "<p>Support har svaret på din henvendelse (sag {{caseCode}}).</p><p><a href=\"{{threadLink}}\">Åbn samtalen</a></p>",
    channel: "PUSH",
  },
  SUPPORT_RECEIVED: {
    subject: "Vi har modtaget din henvendelse (sag {{caseCode}})",
    bodyHtml:
      "<p>Hej {{displayName}},</p><p>Tak for din henvendelse \"{{subject}}\". Dit sagsnummer er <strong>{{caseCode}}</strong>.</p><p>Vi svarer dig i Hello Cal-appen under Indstillinger → Support → Mine henvendelser, og du får besked, når der er et svar.</p><p><a href=\"{{threadLink}}\">Se din henvendelse</a></p><p>Hello Cal Support</p>",
    channel: "EMAIL",
  },
  SUPPORT_OVERDUE_ADMIN: {
    subject: "{{count}} supportbesked(er) ikke besvaret i 24 timer",
    bodyHtml:
      "<p>Følgende henvendelser har ventet mere end 24 timer på svar:</p>{{list}}<p><a href=\"{{inboxLink}}\">Åbn Support-indbakken</a></p>",
    channel: "EMAIL",
  },
};

// Tidligere standardtekster, der opgraderes automatisk, så længe admin ikke
// har redigeret dem (fx fik FRIEND_INVITATION {{personalMessage}} 2026-09-25).
const LEGACY_DEFAULT_BODIES: Partial<Record<MessageEventType, string>> = {
  FRIEND_INVITATION:
    "<p>{{inviterName}} synes du skulle prøve Hello Cal.</p><p><a href=\"{{inviteUrl}}\">Opret din konto</a> — I optjener begge 300 points, når du er med. Linket er gyldigt i 7 dage.</p>",
};

export async function ensureDefaultMessageTemplates() {
  await Promise.all(
    (Object.entries(LEGACY_DEFAULT_BODIES) as [MessageEventType, string][]).map(([event, legacyBody]) =>
      prisma.messageTemplate.updateMany({
        where: { event, bodyHtml: legacyBody },
        data: { bodyHtml: DEFAULT_TEMPLATES[event].bodyHtml },
      })
    )
  );
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
