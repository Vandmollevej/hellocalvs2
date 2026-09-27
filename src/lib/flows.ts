import { prisma } from "@/lib/prisma";

// Egne flow-sider sat op i admin under "Flows" (docs/DECISIONS.md
// 2026-09-27). Et flow gemmes altid samlet: navn, til/fra og alle sider i
// den rækkefølge editoren sender dem.

export type FlowPageInput = { id?: string; title: string; bodyHtml: string; buttonLabel: string };
export type FlowInput = { name: string; description: string | null; enabled: boolean; pages: FlowPageInput[] };

const MAX_PAGES = 50;
const MAX_HTML = 50_000;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export function parseFlowInput(raw: unknown): FlowInput | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const name = text(body.name, 120).trim();
  if (!name || !Array.isArray(body.pages) || body.pages.length > MAX_PAGES) return null;

  const pages: FlowPageInput[] = body.pages.map((page) => {
    const p = (page ?? {}) as Record<string, unknown>;
    return {
      id: typeof p.id === "string" && p.id ? p.id : undefined,
      title: text(p.title, 200),
      bodyHtml: text(p.bodyHtml, MAX_HTML),
      buttonLabel: text(p.buttonLabel, 60).trim() || "Næste",
    };
  });
  const description = text(body.description, 500).trim();

  return { name, description: description || null, enabled: body.enabled === true, pages };
}

export function listFlows() {
  return prisma.flow.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { pages: true } } },
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
      data: { name: input.name, description: input.description, enabled: input.enabled },
    }),
    prisma.flowPage.deleteMany({ where: { flowId: id, id: { notIn: keepIds } } }),
    ...input.pages.map((page, index) => {
      const data = { sortOrder: index, title: page.title, bodyHtml: page.bodyHtml, buttonLabel: page.buttonLabel };
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
