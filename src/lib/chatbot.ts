import type {
  ChatbotCategory,
  ChatbotChannel,
  ChatbotMessageRole,
  Prisma,
  SupportRequestCategory,
  User,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeAge } from "@/lib/age";
import { debugLog, errorText } from "@/lib/debug-log";
import { getSubscriptionTier } from "@/lib/subscription";
import { createSupportRequest, supportCaseCode, SUPPORT_MESSAGE_MAX, SUPPORT_SUBJECT_MAX } from "@/lib/support-inbox";
import {
  CHATBOT_CATEGORIES,
  CHATBOT_CATEGORY_HINTS,
  isChatbotCategory,
  type ChatbotCategoryKey,
} from "@/lib/chatbot-categories";
import { CHATBOT_KNOWLEDGE, CHATBOT_LINK_HREFS, isChatbotLinkHref } from "@/lib/chatbot-knowledge";

// Hjælpe-chatbot øverst i appen og på web (docs/DECISIONS.md 2026-10-02).
// Al logik ligger her; API-ruterne og UI'et er tynde.

export const CHATBOT_QUESTION_MAX = 1000;
// Højst så mange spørgsmål pr. bruger pr. time (beskytter mod misbrug og
// løbske AI-omkostninger).
export const CHATBOT_HOURLY_LIMIT = 30;
// En samtale fortsætter, indtil den har været stille så længe; derefter
// starter næste spørgsmål en ny samtale.
const CONVERSATION_IDLE_MS = 12 * 60 * 60 * 1000;
// Antal tidligere beskeder, AI'en får med som kontekst.
const HISTORY_LIMIT = 12;

export function getChatbotModel() {
  return process.env.OPENAI_CHATBOT_MODEL?.trim() || "gpt-4o-mini";
}

export function cleanChatbotQuestion(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, CHATBOT_QUESTION_MAX);
}

export type ChatbotMessageView = {
  id: string;
  role: ChatbotMessageRole;
  body: string;
  links: string[];
  needsHuman: boolean;
  createdAt: string;
};

export type ChatbotConversationView = {
  id: string;
  escalated: boolean;
  supportRequestId: string | null;
  caseCode: string | null;
  messages: ChatbotMessageView[];
};

const messageSelect = {
  id: true,
  role: true,
  body: true,
  links: true,
  needsHuman: true,
  createdAt: true,
} as const satisfies Prisma.ChatbotMessageSelect;

function toMessageView(m: Prisma.ChatbotMessageGetPayload<{ select: typeof messageSelect }>): ChatbotMessageView {
  return {
    id: m.id,
    role: m.role,
    body: m.body,
    links: m.links.filter(isChatbotLinkHref),
    needsHuman: m.needsHuman,
    createdAt: m.createdAt.toISOString(),
  };
}

function toConversationView(c: {
  id: string;
  escalatedAt: Date | null;
  supportRequestId: string | null;
  messages: Prisma.ChatbotMessageGetPayload<{ select: typeof messageSelect }>[];
}): ChatbotConversationView {
  return {
    id: c.id,
    escalated: Boolean(c.escalatedAt),
    supportRequestId: c.supportRequestId,
    caseCode: c.supportRequestId ? supportCaseCode(c.supportRequestId) : null,
    messages: c.messages.map(toMessageView),
  };
}

// --- Brugersiden ---

// Den igangværende samtale (ikke sendt til Support og ikke gået i stå).
async function findOpenConversation(userId: string, now = new Date()) {
  return prisma.chatbotConversation.findFirst({
    where: {
      userId,
      escalatedAt: null,
      lastMessageAt: { gte: new Date(now.getTime() - CONVERSATION_IDLE_MS) },
    },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      escalatedAt: true,
      supportRequestId: true,
      messages: { orderBy: { createdAt: "asc" }, select: messageSelect },
    },
  });
}

export async function getOpenChatbotConversation(userId: string): Promise<ChatbotConversationView | null> {
  const conversation = await findOpenConversation(userId);
  return conversation ? toConversationView(conversation) : null;
}

// Øjebliksbillede af brugeren ved samtalens start (admin-statistik).
async function userSnapshot(user: User) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: { status: true, currentPeriodEnd: true, plan: true },
  });
  const tier = getSubscriptionTier(subscription);
  return {
    userAgeSnapshot: computeAge(user.birthDate),
    userSexSnapshot: user.sex,
    userRegionSnapshot: user.region,
    userTierSnapshot: tier,
    userPlanSnapshot: tier === "SERIOUS" ? (subscription?.plan ?? null) : null,
    userLocaleSnapshot: user.appLocale,
  };
}

export async function countRecentChatbotQuestions(userId: string, now = new Date()) {
  return prisma.chatbotMessage.count({
    where: {
      role: "USER",
      createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
      conversation: { userId },
    },
  });
}

type AiReply = {
  answer: string;
  category: ChatbotCategoryKey;
  needsHuman: boolean;
  links: string[];
};

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    category: { type: "string", enum: [...CHATBOT_CATEGORIES] },
    needsHuman: { type: "boolean" },
    links: { type: "array", items: { type: "string", enum: CHATBOT_LINK_HREFS } },
  },
  required: ["answer", "category", "needsHuman", "links"],
  additionalProperties: false,
};

function systemPrompt(locale: string, tier: string) {
  const categories = CHATBOT_CATEGORIES.map((key) => `- ${key}: ${CHATBOT_CATEGORY_HINTS[key]}`).join("\n");
  return [
    "Du er Hello Cals hjælpe-chatbot i appen. Du hjælper brugere med at bruge appen.",
    "Svar kort og venligt (højst 4-5 sætninger), i samme sprog som brugeren skriver.",
    `Brugerens app-sprog er ${locale === "en" ? "engelsk" : "dansk"}. Brugerens abonnement: ${tier === "SERIOUS" ? "Seriøs" : "Gratis"}.`,
    "Svar KUN ud fra VIDEN nedenfor. Gæt aldrig og opfind aldrig funktioner, priser, menupunkter eller adresser.",
    "Kan spørgsmålet ikke besvares ud fra VIDEN, så sig det ærligt og sæt needsHuman = true.",
    "Sæt også needsHuman = true, hvis brugeren beder om et menneske, er utilfreds, eller spørgsmålet handler om penge der skal tilbage, kontosletning, dobbelt betaling, adgang til en konto, eller en fejl der kræver at Support kigger på kontoen.",
    "Du kan ikke se brugerens data og kan ikke udføre handlinger for brugeren. Bed aldrig om adgangskoder, kortnumre eller CPR-nummer.",
    "Giv ikke medicinsk rådgivning ud over appens funktioner; henvis til egen læge ved helbredsspørgsmål.",
    "links: vælg 0-2 relevante sider fra den tilladte liste, som hjælper brugeren videre. Skriv ikke adresserne i selve svaret.",
    "category: vælg den kategori, der passer bedst til brugerens SENESTE spørgsmål:",
    categories,
    "",
    "VIDEN:",
    CHATBOT_KNOWLEDGE,
  ].join("\n");
}

async function requestAiReply(input: {
  history: { role: ChatbotMessageRole; body: string }[];
  locale: string;
  tier: string;
}): Promise<{ reply: AiReply; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY er ikke sat");
  const model = getChatbotModel();
  const startedAt = Date.now();

  // docs/PRIVACY.md "AI": ingen ID'er eller personoplysninger til OpenAI, og
  // svaret må ikke gemmes hos OpenAI (store: false). Kun beskedteksterne.
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        { role: "system", content: systemPrompt(input.locale, input.tier) },
        ...input.history
          .filter((m) => m.role !== "SYSTEM")
          .map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.body })),
      ],
      text: { format: { type: "json_schema", name: "chatbot_reply", schema: REPLY_SCHEMA, strict: true } },
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI-kald fejlede (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  const data = (await response.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
    usage?: unknown;
  };
  const text =
    data.output_text ??
    data.output?.flatMap((item) => item.content ?? []).find((c) => c.type === "output_text")?.text ??
    null;
  if (!text) throw new Error("Intet svar fra OpenAI");
  const parsed = JSON.parse(text) as Partial<AiReply>;
  const reply: AiReply = {
    answer: typeof parsed.answer === "string" && parsed.answer.trim() ? parsed.answer.trim() : "",
    category: isChatbotCategory(parsed.category) ? parsed.category : "OTHER",
    needsHuman: parsed.needsHuman === true,
    links: Array.isArray(parsed.links) ? parsed.links.filter(isChatbotLinkHref).slice(0, 2) : [],
  };
  if (!reply.answer) throw new Error("Tomt svar fra OpenAI");
  void debugLog({
    category: "ai",
    event: "chatbot_reply",
    level: "info",
    message: `OpenAI chatbot (${model}) OK`,
    durationMs: Date.now() - startedAt,
    data: { model, usage: data.usage ?? null },
  });
  return { reply, model };
}

const FALLBACK_ANSWER = {
  da: "Jeg kan desværre ikke svare lige nu. Tryk på \"Tal med en medarbejder\", så sender jeg dit spørgsmål videre til Support.",
  en: "Sorry, I can't answer right now. Tap \"Talk to a person\" and I'll pass your question on to Support.",
};

// Den hyppigste kategori blandt samtalens spørgsmål. Ved lighed vinder den
// seneste, så samtalen følger brugerens aktuelle emne.
function dominantCategory(categories: (ChatbotCategory | null)[]): ChatbotCategory {
  const counts = new Map<ChatbotCategory, number>();
  let best: ChatbotCategory = "OTHER";
  let bestCount = 0;
  for (const category of categories) {
    if (!category) continue;
    const count = (counts.get(category) ?? 0) + 1;
    counts.set(category, count);
    if (count >= bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

export async function askChatbot(input: {
  user: User;
  question: string;
  channel: ChatbotChannel;
}): Promise<ChatbotConversationView> {
  const { user, question, channel } = input;
  const now = new Date();
  let conversation = await findOpenConversation(user.id, now);
  if (!conversation) {
    const snapshot = await userSnapshot(user);
    conversation = await prisma.chatbotConversation.create({
      data: { userId: user.id, channel, ...snapshot, lastMessageAt: now },
      select: {
        id: true,
        escalatedAt: true,
        supportRequestId: true,
        messages: { orderBy: { createdAt: "asc" }, select: messageSelect },
      },
    });
  }
  const conversationId = conversation.id;

  const userMessage = await prisma.chatbotMessage.create({
    data: { conversationId, role: "USER", body: question, createdAt: now },
  });

  const meta = await prisma.chatbotConversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { userTierSnapshot: true },
  });
  const history = [...conversation.messages, { role: "USER" as const, body: question }].slice(-HISTORY_LIMIT);

  let reply: AiReply;
  let model: string | null = null;
  try {
    const result = await requestAiReply({ history, locale: user.appLocale, tier: meta.userTierSnapshot });
    reply = result.reply;
    model = result.model;
  } catch (error) {
    void debugLog({
      category: "ai",
      event: "chatbot_reply",
      level: "error",
      message: `OpenAI chatbot fejlede: ${errorText(error).slice(0, 500)}`,
    });
    reply = {
      answer: user.appLocale === "en" ? FALLBACK_ANSWER.en : FALLBACK_ANSWER.da,
      category: "OTHER",
      needsHuman: true,
      links: [],
    };
  }

  const answeredAt = new Date();
  await prisma.$transaction([
    prisma.chatbotMessage.update({ where: { id: userMessage.id }, data: { category: reply.category } }),
    prisma.chatbotMessage.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        body: reply.answer,
        needsHuman: reply.needsHuman,
        links: reply.links,
        model,
        createdAt: answeredAt,
      },
    }),
  ]);

  const questions = await prisma.chatbotMessage.findMany({
    where: { conversationId, role: "USER" },
    orderBy: { createdAt: "asc" },
    select: { category: true },
  });
  const updated = await prisma.chatbotConversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: answeredAt,
      questionCount: questions.length,
      category: dominantCategory(questions.map((q) => q.category)),
    },
    select: {
      id: true,
      escalatedAt: true,
      supportRequestId: true,
      messages: { orderBy: { createdAt: "asc" }, select: messageSelect },
    },
  });
  return toConversationView(updated);
}

const SUPPORT_CATEGORY_BY_CHATBOT: Partial<Record<ChatbotCategory, SupportRequestCategory>> = {
  ACCOUNT_LOGIN: "ACCOUNT",
  PRIVACY_DATA: "DATA",
  PRODUCTS_SCANNING: "PRODUCTS",
  SUBSCRIPTION_PAYMENT: "PAYMENT",
  BUG: "BUG",
};

function transcriptText(messages: { role: ChatbotMessageRole; body: string }[], locale: string) {
  const you = locale === "en" ? "Me" : "Mig";
  return messages
    .filter((m) => m.role !== "SYSTEM")
    .map((m) => `${m.role === "USER" ? you : "Chatbot"}: ${m.body}`)
    .join("\n\n");
}

// "Tal med en medarbejder": samtalen bliver en sag i Support-indbakken
// (samme flow som "Kontakt os"), med hele tråden som første besked. Kan
// også bruges uden forudgående spørgsmål — så er brugerens note beskeden.
export async function escalateChatbotConversation(input: {
  user: User;
  conversationId: string | null;
  note: string;
  channel: ChatbotChannel;
}): Promise<{ supportRequestId: string; caseCode: string; conversation: ChatbotConversationView } | null> {
  const { user, note } = input;
  let conversationId = input.conversationId;

  if (!conversationId) {
    if (!note) return null;
    const snapshot = await userSnapshot(user);
    const created = await prisma.chatbotConversation.create({
      data: { userId: user.id, channel: input.channel, ...snapshot },
      select: { id: true },
    });
    conversationId = created.id;
  }

  const conversation = await prisma.chatbotConversation.findFirst({
    where: { id: conversationId, userId: user.id },
    select: {
      id: true,
      category: true,
      escalatedAt: true,
      supportRequestId: true,
      messages: { orderBy: { createdAt: "asc" }, select: messageSelect },
    },
  });
  if (!conversation) return null;
  if (conversation.escalatedAt && conversation.supportRequestId) {
    return {
      supportRequestId: conversation.supportRequestId,
      caseCode: supportCaseCode(conversation.supportRequestId),
      conversation: toConversationView(conversation),
    };
  }

  const firstQuestion = conversation.messages.find((m) => m.role === "USER")?.body ?? note;
  if (!firstQuestion) return null;
  const en = user.appLocale === "en";
  const subject = `Chatbot: ${firstQuestion.replace(/\s+/g, " ")}`.slice(0, SUPPORT_SUBJECT_MAX);
  const transcript = transcriptText(conversation.messages, user.appLocale);
  const parts = [
    note ? `${note}` : null,
    transcript ? `${en ? "Conversation with the chatbot" : "Samtale med chatbotten"}:\n\n${transcript}` : null,
  ].filter(Boolean);
  const message = parts.join("\n\n---\n\n").slice(0, SUPPORT_MESSAGE_MAX);

  const supportRequest = await createSupportRequest({
    userId: user.id,
    category: SUPPORT_CATEGORY_BY_CHATBOT[conversation.category] ?? "OTHER",
    subject,
    message,
  });
  const caseCode = supportCaseCode(supportRequest.id);
  const now = new Date();

  const updated = await prisma.chatbotConversation.update({
    where: { id: conversation.id },
    data: {
      escalatedAt: now,
      supportRequestId: supportRequest.id,
      lastMessageAt: now,
      messages: {
        create: [
          ...(note ? [{ role: "USER" as const, body: note, createdAt: now }] : []),
          {
            role: "SYSTEM" as const,
            body: en
              ? `Sent to Support as case #${caseCode}. You'll get a reply in the app.`
              : `Sendt til Support som sag #${caseCode}. Du får svar her i appen.`,
            createdAt: new Date(now.getTime() + 1),
          },
        ],
      },
    },
    select: {
      id: true,
      escalatedAt: true,
      supportRequestId: true,
      messages: { orderBy: { createdAt: "asc" }, select: messageSelect },
    },
  });

  return { supportRequestId: supportRequest.id, caseCode, conversation: toConversationView(updated) };
}

// --- Admin (admin → Brugere → Chatbot) ---

export const CHATBOT_ADMIN_PERIODS = ["7", "30", "90", "all"] as const;
export type ChatbotAdminPeriod = (typeof CHATBOT_ADMIN_PERIODS)[number];
export const CHATBOT_ADMIN_PAGE_SIZE = 50;

export type ChatbotAdminFilter = {
  period: ChatbotAdminPeriod;
  category: ChatbotCategoryKey | null;
  q: string;
  escalated: boolean;
  page: number;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseChatbotAdminFilter(params: Record<string, string | string[] | undefined>): ChatbotAdminFilter {
  const period = first(params.period);
  const category = first(params.category);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    period: (CHATBOT_ADMIN_PERIODS as readonly string[]).includes(period ?? "") ? (period as ChatbotAdminPeriod) : "30",
    category: isChatbotCategory(category) ? category : null,
    q: (first(params.q) ?? "").trim().slice(0, 200),
    escalated: first(params.escalated) === "1",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function periodStart(period: ChatbotAdminPeriod, now = new Date()) {
  if (period === "all") return null;
  return new Date(now.getTime() - Number(period) * 24 * 60 * 60 * 1000);
}

// "Oftest spurgt": antal spørgsmål pr. kategori i perioden.
export async function chatbotCategoryStats(period: ChatbotAdminPeriod) {
  const since = periodStart(period);
  const groups = await prisma.chatbotMessage.groupBy({
    by: ["category"],
    where: { role: "USER", ...(since ? { createdAt: { gte: since } } : {}) },
    _count: { _all: true },
  });
  const rows = groups
    .map((g) => ({ category: (g.category ?? "OTHER") as ChatbotCategoryKey, count: g._count._all }))
    .reduce<Map<ChatbotCategoryKey, number>>((map, row) => map.set(row.category, (map.get(row.category) ?? 0) + row.count), new Map());
  const list = [...rows.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
  const total = list.reduce((sum, row) => sum + row.count, 0);
  const [conversations, escalated] = await Promise.all([
    prisma.chatbotConversation.count({ where: since ? { createdAt: { gte: since } } : {} }),
    prisma.chatbotConversation.count({ where: { escalatedAt: since ? { gte: since } : { not: null } } }),
  ]);
  return { rows: list, totalQuestions: total, conversations, escalated };
}

// Tabellen "Alle spørgsmål og svar": hvert brugerspørgsmål med det svar,
// chatbotten gav lige efter.
export async function listChatbotQuestions(filter: ChatbotAdminFilter) {
  const since = periodStart(filter.period);
  const where: Prisma.ChatbotMessageWhereInput = {
    role: "USER",
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.q ? { body: { contains: filter.q, mode: "insensitive" } } : {}),
    ...(filter.escalated ? { conversation: { escalatedAt: { not: null } } } : {}),
  };
  const [total, questions] = await Promise.all([
    prisma.chatbotMessage.count({ where }),
    prisma.chatbotMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * CHATBOT_ADMIN_PAGE_SIZE,
      take: CHATBOT_ADMIN_PAGE_SIZE,
      select: {
        id: true,
        body: true,
        category: true,
        createdAt: true,
        conversationId: true,
        conversation: {
          select: {
            escalatedAt: true,
            userAgeSnapshot: true,
            userRegionSnapshot: true,
            userTierSnapshot: true,
            user: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    }),
  ]);

  // Svaret = første ASSISTANT-besked efter spørgsmålet i samme samtale.
  const conversationIds = [...new Set(questions.map((q) => q.conversationId))];
  const answers = conversationIds.length
    ? await prisma.chatbotMessage.findMany({
        where: { conversationId: { in: conversationIds }, role: "ASSISTANT" },
        orderBy: { createdAt: "asc" },
        select: { conversationId: true, body: true, needsHuman: true, createdAt: true },
      })
    : [];
  const rows = questions.map((q) => {
    const answer = answers.find((a) => a.conversationId === q.conversationId && a.createdAt >= q.createdAt) ?? null;
    return { ...q, answer };
  });
  return { total, rows, pages: Math.max(1, Math.ceil(total / CHATBOT_ADMIN_PAGE_SIZE)) };
}

export async function getChatbotThreadForAdmin(conversationId: string) {
  const conversation = await prisma.chatbotConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      supportRequest: { select: { id: true, status: true, subject: true } },
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          birthDate: true,
          sex: true,
          region: true,
          appLocale: true,
          createdAt: true,
          subscription: { select: { status: true, plan: true, currentPeriodEnd: true } },
          _count: { select: { chatbotConversations: true, supportRequests: true } },
        },
      },
    },
  });
  if (!conversation) return null;
  const otherConversations = await prisma.chatbotConversation.findMany({
    where: { userId: conversation.userId, id: { not: conversation.id } },
    orderBy: { lastMessageAt: "desc" },
    take: 10,
    select: { id: true, category: true, questionCount: true, lastMessageAt: true, escalatedAt: true },
  });
  return {
    conversation,
    currentTier: getSubscriptionTier(conversation.user.subscription),
    currentAge: computeAge(conversation.user.birthDate),
    otherConversations,
  };
}
