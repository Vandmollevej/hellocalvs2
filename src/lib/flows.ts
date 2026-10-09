import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  flowIsEligible,
  sanitizeActionHref,
  sanitizeFlowConditions,
  sanitizeFlowKind,
  sectionOf,
  type FlowConditions,
  type FlowKind,
} from "@/lib/flow-conditions";

// Egne flow-sider sat op i admin under "Flows" (docs/DECISIONS.md
// 2026-09-27). Et flow gemmes altid samlet: navn, til/fra, visning,
// betingelser (2026-10-06) og alle sider i den rækkefølge editoren sender dem.

export type FlowPageInput = {
  id?: string;
  title: string;
  bodyHtml: string;
  buttonLabel: string;
  actionLabel: string | null;
  actionHref: string | null;
};
export type FlowInput = {
  name: string;
  description: string | null;
  enabled: boolean;
  kind: FlowKind;
  conditions: FlowConditions;
  priority: number;
  maxShows: number;
  pages: FlowPageInput[];
};

const MAX_PAGES = 50;
const MAX_HTML = 50_000;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function int(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function parseFlowInput(raw: unknown): FlowInput | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const name = text(body.name, 120).trim();
  if (!name || !Array.isArray(body.pages) || body.pages.length > MAX_PAGES) return null;

  const pages: FlowPageInput[] = body.pages.map((page) => {
    const p = (page ?? {}) as Record<string, unknown>;
    const actionHref = sanitizeActionHref(p.actionHref);
    const actionLabel = text(p.actionLabel, 60).trim();
    return {
      id: typeof p.id === "string" && p.id ? p.id : undefined,
      title: text(p.title, 200),
      bodyHtml: text(p.bodyHtml, MAX_HTML),
      buttonLabel: text(p.buttonLabel, 60).trim() || "Næste",
      actionLabel: actionHref && actionLabel ? actionLabel : null,
      actionHref: actionHref && actionLabel ? actionHref : null,
    };
  });
  const description = text(body.description, 500).trim();

  return {
    name,
    description: description || null,
    enabled: body.enabled === true,
    kind: sanitizeFlowKind(body.kind),
    conditions: sanitizeFlowConditions(body.conditions),
    priority: int(body.priority, 0, -1000, 1000),
    maxShows: int(body.maxShows, 1, 0, 1000),
    pages,
  };
}

export function listFlows() {
  return prisma.flow.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { pages: true, views: true } } },
  });
}

export function getFlow(id: string) {
  return prisma.flow.findUnique({
    where: { id },
    include: { pages: { orderBy: { sortOrder: "asc" } } },
  });
}

export function createFlow(name: string) {
  return prisma.flow.create({
    data: {
      name: name.trim().slice(0, 120),
      pages: { create: [{ sortOrder: 0, title: "Velkommen", bodyHtml: "<p>Skriv indholdet her.</p>" }] },
    },
  });
}

export async function saveFlow(id: string, input: FlowInput) {
  const keepIds = input.pages.flatMap((page) => (page.id ? [page.id] : []));

  await prisma.$transaction([
    prisma.flow.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        enabled: input.enabled,
        kind: input.kind,
        conditions: input.conditions as Prisma.InputJsonValue,
        priority: input.priority,
        maxShows: input.maxShows,
      },
    }),
    prisma.flowPage.deleteMany({ where: { flowId: id, id: { notIn: keepIds } } }),
    ...input.pages.map((page, index) => {
      const data = {
        sortOrder: index,
        title: page.title,
        bodyHtml: page.bodyHtml,
        buttonLabel: page.buttonLabel,
        actionLabel: page.actionLabel,
        actionHref: page.actionHref,
      };
      return page.id
        ? prisma.flowPage.updateMany({ where: { id: page.id, flowId: id }, data })
        : prisma.flowPage.create({ data: { ...data, flowId: id } });
    }),
  ]);

  return getFlow(id);
}

export function deleteFlow(id: string) {
  return prisma.flow.delete({ where: { id } });
}

// --- Visning for brugerne ---

export type ActiveFlow = {
  id: string;
  name: string;
  kind: FlowKind;
  pages: { id: string; title: string; bodyHtml: string; buttonLabel: string; actionLabel: string | null; actionHref: string | null }[];
};

/** Det første aktive flow (højeste prioritet), der passer til brugeren på denne side. */
export async function findActiveFlowForUser(userId: string, path: string): Promise<ActiveFlow | null> {
  const flows = await prisma.flow.findMany({
    where: { enabled: true, pages: { some: {} } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: {
      pages: { orderBy: { sortOrder: "asc" } },
      views: { where: { userId }, take: 1 },
    },
  });
  if (!flows.length) return null;

  const [user, loginCount, visits, activeDays] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.loginEvent.count({ where: { userId } }),
    prisma.userSectionVisit.findMany({ where: { userId }, select: { section: true } }),
    countActiveDays(userId),
  ]);
  if (!user) return null;

  const now = new Date();
  for (const flow of flows) {
    const view = flow.views[0] ?? null;
    const eligible = flowIsEligible(
      { maxShows: flow.maxShows, conditions: sanitizeFlowConditions(flow.conditions) },
      {
        now,
        path,
        loginCount,
        signupAt: user.createdAt,
        activeDays,
        visitedSections: visits.map((visit) => visit.section),
        view,
      },
    );
    if (!eligible) continue;
    return {
      id: flow.id,
      name: flow.name,
      kind: sanitizeFlowKind(flow.kind),
      pages: flow.pages.map((page) => ({
        id: page.id,
        title: page.title,
        bodyHtml: page.bodyHtml,
        buttonLabel: page.buttonLabel,
        actionLabel: page.actionLabel,
        actionHref: page.actionHref,
      })),
    };
  }
  return null;
}

async function countActiveDays(userId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ days: bigint }[]>`
    SELECT COUNT(DISTINCT ("createdAt" AT TIME ZONE 'Europe/Copenhagen')::date) AS days
    FROM "registrations" WHERE "userId" = ${userId}`;
  return Number(rows[0]?.days ?? 0);
}

/** Husker at brugeren har besøgt en del af appen (første sti-led). */
export async function recordSectionVisit(userId: string, path: string) {
  const section = sectionOf(path).slice(0, 80);
  await prisma.userSectionVisit.upsert({
    where: { userId_section: { userId, section } },
    create: { userId, section },
    update: { visitCount: { increment: 1 }, lastVisitAt: new Date() },
  });
}

export type FlowEvent = "shown" | "completed" | "dismissed";

export async function recordFlowEvent(userId: string, flowId: string, event: FlowEvent) {
  const now = new Date();
  const data =
    event === "shown"
      ? { shownCount: { increment: 1 }, lastShownAt: now }
      : event === "completed"
        ? { completedAt: now }
        : { dismissedAt: now };
  await prisma.flowView.upsert({
    where: { flowId_userId: { flowId, userId } },
    create: {
      flowId,
      userId,
      shownCount: event === "shown" ? 1 : 0,
      lastShownAt: event === "shown" ? now : null,
      completedAt: event === "completed" ? now : null,
      dismissedAt: event === "dismissed" ? now : null,
    },
    update: data,
  });
}
