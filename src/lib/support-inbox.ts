import type { Prisma, SupportPriority, SupportRequestCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { queueMessage } from "@/lib/messaging";
import { findActiveSupportGrant } from "@/lib/support-access";

// Support-indbakke (docs/DECISIONS.md 2026-09-26): én sag = én tråd af
// beskeder mellem bruger og Support. "Ikke besvaret" = seneste besked er fra
// brugeren (awaitingReply). Er en sag ikke besvaret inden for 24 timer, får
// admin én advarsel pr. ubesvaret besked (alertOverdueSupportRequests).

export const SUPPORT_OVERDUE_HOURS = 24;
export const SUPPORT_SUBJECT_MAX = 200;
export const SUPPORT_MESSAGE_MAX = 5000;

export const SUPPORT_PRIORITIES = ["HIGH", "NORMAL", "LOW"] as const satisfies readonly SupportPriority[];

export function isSupportPriority(value: unknown): value is SupportPriority {
  return typeof value === "string" && (SUPPORT_PRIORITIES as readonly string[]).includes(value);
}

const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "peter@packroff.dk";
const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || "https://adminhellocal.packroff.dk";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://hellocal.packroff.dk";

export function supportCaseCode(id: string) {
  return id.slice(-8).toUpperCase();
}

export function isSupportOverdue(request: { awaitingReply: boolean; status: string; lastUserMessageAt: Date }, now = new Date()) {
  return (
    request.status === "OPEN" &&
    request.awaitingReply &&
    now.getTime() - request.lastUserMessageAt.getTime() > SUPPORT_OVERDUE_HOURS * 60 * 60 * 1000
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textToHtml(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

export function cleanSupportText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// --- Brugersiden ---

export async function createSupportRequest(input: {
  userId: string;
  category: SupportRequestCategory;
  subject: string;
  message: string;
}) {
  const grant = await findActiveSupportGrant(input.userId);
  const now = new Date();
  return prisma.supportRequest.create({
    data: {
      userId: input.userId,
      category: input.category,
      subject: input.subject,
      message: input.message,
      supportGrantId: grant?.id,
      lastUserMessageAt: now,
      messages: { create: { author: "USER", body: input.message, createdAt: now } },
    },
    select: { id: true, createdAt: true },
  });
}

// Brugerens svar i en eksisterende tråd. En løst sag genåbnes, og
// 24-timers-fristen starter forfra.
export async function addUserSupportMessage(userId: string, requestId: string, body: string) {
  const request = await prisma.supportRequest.findFirst({ where: { id: requestId, userId }, select: { id: true } });
  if (!request) return null;
  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({ data: { requestId, author: "USER", body, createdAt: now } }),
    prisma.supportRequest.update({
      where: { id: requestId },
      data: {
        status: "OPEN",
        resolvedAt: null,
        awaitingReply: true,
        lastUserMessageAt: now,
        overdueAlertSentAt: null,
      },
    }),
  ]);
  return message;
}

export async function listUserSupportRequests(userId: string) {
  return prisma.supportRequest.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      awaitingReply: true,
      userUnread: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// Tråden som brugeren ser den (uden interne noter). Markerer svar som læst.
export async function getUserSupportThread(userId: string, requestId: string) {
  const request = await prisma.supportRequest.findFirst({
    where: { id: requestId, userId },
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      awaitingReply: true,
      userUnread: true,
      createdAt: true,
      messages: {
        where: { author: { in: ["USER", "SUPPORT"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, author: true, body: true, createdAt: true },
      },
    },
  });
  if (!request) return null;
  if (request.userUnread) {
    await prisma.supportRequest.update({ where: { id: requestId }, data: { userUnread: false } });
  }
  return request;
}

// --- Adminsiden ---

export type SupportInboxSort = "oldest" | "newest";
export type SupportInboxStatus = "unanswered" | "open" | "resolved" | "all";

export type SupportInboxFilter = {
  sort: SupportInboxSort;
  priorities: SupportPriority[];
  status: SupportInboxStatus;
  q: string;
};

export const DEFAULT_SUPPORT_INBOX_FILTER: SupportInboxFilter = {
  sort: "oldest",
  priorities: [...SUPPORT_PRIORITIES],
  status: "open",
  q: "",
};

export function parseSupportInboxFilter(params: Record<string, string | string[] | undefined>): SupportInboxFilter {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const sort = one("sort") === "newest" ? "newest" : "oldest";
  const statusParam = one("status");
  const status: SupportInboxStatus =
    statusParam === "unanswered" || statusParam === "resolved" || statusParam === "all" ? statusParam : "open";
  const prioParam = one("prio");
  const priorities =
    prioParam === undefined ? [...SUPPORT_PRIORITIES] : prioParam.split(",").filter(isSupportPriority);
  return { sort, status, priorities, q: (one("q") ?? "").trim().slice(0, 100) };
}

export async function listSupportInbox(filter: SupportInboxFilter) {
  const where: Prisma.SupportRequestWhereInput = { priority: { in: filter.priorities } };
  if (filter.status === "open") where.status = "OPEN";
  if (filter.status === "resolved") where.status = "RESOLVED";
  if (filter.status === "unanswered") {
    where.status = "OPEN";
    where.awaitingReply = true;
  }
  if (filter.q) {
    const q = filter.q;
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { displayName: { contains: q, mode: "insensitive" } } },
      // Sagsnummeret er de sidste 8 tegn af id'et.
      { id: { endsWith: q.toLowerCase() } },
    ];
  }

  // "Senest modtaget" / "ældste først" = tidspunktet for brugerens seneste besked.
  const direction = filter.sort === "newest" ? "desc" : "asc";
  return prisma.supportRequest.findMany({
    where,
    orderBy: [{ lastUserMessageAt: direction }, { id: direction }],
    take: 300,
    include: {
      user: { select: { displayName: true, email: true } },
      _count: { select: { messages: { where: { author: { in: ["USER", "SUPPORT"] } } } } },
    },
  });
}

export async function countSupportInbox() {
  const [unanswered, overdue] = await Promise.all([
    prisma.supportRequest.count({ where: { status: "OPEN", awaitingReply: true } }),
    prisma.supportRequest.count({
      where: {
        status: "OPEN",
        awaitingReply: true,
        lastUserMessageAt: { lt: new Date(Date.now() - SUPPORT_OVERDUE_HOURS * 60 * 60 * 1000) },
      },
    }),
  ]);
  return { unanswered, overdue };
}

export async function getAdminSupportThread(requestId: string) {
  return prisma.supportRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { select: { id: true, displayName: true, email: true, createdAt: true } },
      supportGrant: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
}

// Svar til brugeren (eller intern note). Et svar lægges i brugerens
// indbakke + mail/push (SUPPORT_REPLY) og fjerner "ikke besvaret".
export async function addSupportReply(input: {
  requestId: string;
  adminName: string;
  body: string;
  kind: "REPLY" | "NOTE";
  resolve?: boolean;
}) {
  const request = await prisma.supportRequest.findUnique({
    where: { id: input.requestId },
    include: { user: { select: { id: true, displayName: true } } },
  });
  if (!request) return null;

  const now = new Date();
  if (input.kind === "NOTE") {
    return prisma.supportMessage.create({
      data: { requestId: request.id, author: "NOTE", authorName: input.adminName, body: input.body, createdAt: now },
    });
  }

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: { requestId: request.id, author: "SUPPORT", authorName: input.adminName, body: input.body, createdAt: now },
    }),
    prisma.supportRequest.update({
      where: { id: request.id },
      data: {
        awaitingReply: false,
        lastSupportReplyAt: now,
        overdueAlertSentAt: null,
        userUnread: true,
        ...(input.resolve ? { status: "RESOLVED" as const, resolvedAt: now } : {}),
      },
    }),
  ]);

  await queueMessage("SUPPORT_REPLY", {
    userId: request.user.id,
    vars: {
      displayName: escapeHtml(request.user.displayName),
      subject: escapeHtml(request.subject),
      caseCode: supportCaseCode(request.id),
      reply: textToHtml(input.body),
      threadLink: `${APP_BASE_URL}/settings/support/requests/${request.id}`,
    },
  });

  return message;
}

export async function updateSupportRequest(
  requestId: string,
  data: { status?: "OPEN" | "RESOLVED"; priority?: SupportPriority; awaitingReply?: boolean }
) {
  const update: Prisma.SupportRequestUpdateInput = {};
  if (data.priority) update.priority = data.priority;
  if (data.status) {
    update.status = data.status;
    update.resolvedAt = data.status === "RESOLVED" ? new Date() : null;
  }
  // "Marker som besvaret" uden at skrive (fx besvaret på anden vis) og
  // omvendt "marker som ikke besvaret".
  if (data.awaitingReply !== undefined) {
    update.awaitingReply = data.awaitingReply;
    if (!data.awaitingReply) update.overdueAlertSentAt = null;
  }
  const result = await prisma.supportRequest.updateMany({ where: { id: requestId }, data: update as Prisma.SupportRequestUpdateManyMutationInput });
  return result.count > 0;
}

// --- Scheduler: 24-timers-advarsel til admin ---

// Én samlet mail pr. kørsel med alle sager, der netop har passeret 24 timer
// uden svar. overdueAlertSentAt sikrer én advarsel pr. ubesvaret besked.
export async function alertOverdueSupportRequests(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - SUPPORT_OVERDUE_HOURS * 60 * 60 * 1000);
  const overdue = await prisma.supportRequest.findMany({
    where: { status: "OPEN", awaitingReply: true, lastUserMessageAt: { lt: cutoff }, overdueAlertSentAt: null },
    orderBy: [{ priority: "asc" }, { lastUserMessageAt: "asc" }],
    include: { user: { select: { displayName: true, email: true } } },
    take: 100,
  });
  if (overdue.length === 0) return { alerted: 0 };

  await prisma.supportRequest.updateMany({
    where: { id: { in: overdue.map((r) => r.id) } },
    data: { overdueAlertSentAt: now },
  });

  const priorityLabel: Record<SupportPriority, string> = { HIGH: "Høj", NORMAL: "Normal", LOW: "Lav" };
  const items = overdue
    .map((r) => {
      const hours = Math.floor((now.getTime() - r.lastUserMessageAt.getTime()) / (60 * 60 * 1000));
      return `<li><a href="${ADMIN_BASE_URL}/admin/support/${r.id}">${escapeHtml(r.subject)}</a> — ${escapeHtml(
        r.user.displayName
      )} (${escapeHtml(r.user.email)}) · prioritet ${priorityLabel[r.priority]} · venter ${hours} timer · sag ${supportCaseCode(r.id)}</li>`;
    })
    .join("");

  await queueMessage("SUPPORT_OVERDUE_ADMIN", {
    toEmail: ADMIN_NOTIFICATION_EMAIL,
    vars: {
      count: String(overdue.length),
      list: `<ul>${items}</ul>`,
      inboxLink: `${ADMIN_BASE_URL}/admin/support?status=unanswered`,
    },
  });

  return { alerted: overdue.length };
}
