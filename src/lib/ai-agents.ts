import { createHash, randomBytes } from "node:crypto";
import type { AgentJobStatus, RoadmapStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// AI-agenter, agent-jobs og roadmap (docs/DECISIONS.md 2026-09-27). En agent
// (fx en Claude-session eller Claude.ai-connector) autentificerer sig med et
// personligt token i MCP-adressen /api/mcp/<token>. Kun sha256 gemmes; selve
// tokenet vises én gang for admin ved oprettelsen.

const TOKEN_PREFIX = "hcag_";

export const AGENT_TOKEN_COOKIE = "hc_agent_token_once";

// MCP skal nås på den offentlige app-adresse — admin-hostnavnet omskriver
// alle stier til /admin (middleware.ts).
const APP_BASE_URL = (process.env.APP_BASE_URL || "https://hellocal.packroff.dk").replace(/\/$/, "");

export function mcpUrlForToken(token: string) {
  return `${APP_BASE_URL}/api/mcp/${token}`;
}

export function hashAgentToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createAiAgent(name: string, description: string | null) {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  const agent = await prisma.aiAgent.create({
    data: { name, description, tokenHash: hashAgentToken(token) },
  });
  return { agent, token };
}

export async function rotateAiAgentToken(id: string) {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  await prisma.aiAgent.update({ where: { id }, data: { tokenHash: hashAgentToken(token) } });
  return token;
}

export async function findAgentByToken(raw: string) {
  if (!raw.startsWith(TOKEN_PREFIX)) return null;
  const agent = await prisma.aiAgent.findUnique({ where: { tokenHash: hashAgentToken(raw) } });
  if (!agent || agent.disabled) return null;
  await prisma.aiAgent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  return agent;
}

export const ROADMAP_STATUSES: RoadmapStatus[] = ["IDEA", "PLANNED", "IN_PROGRESS", "DONE"];

export const ROADMAP_STATUS_LABEL: Record<RoadmapStatus, string> = {
  IDEA: "Idéer",
  PLANNED: "Planlagt",
  IN_PROGRESS: "I gang",
  DONE: "Færdig",
};

export function isRoadmapStatus(value: unknown): value is RoadmapStatus {
  return typeof value === "string" && (ROADMAP_STATUSES as string[]).includes(value);
}

export async function createRoadmapItem(input: {
  title: string;
  description?: string | null;
  status?: RoadmapStatus;
  createdBy?: string | null;
}) {
  const status = input.status ?? "IDEA";
  const last = await prisma.roadmapItem.findFirst({ where: { status }, orderBy: { sortOrder: "desc" } });
  return prisma.roadmapItem.create({
    data: {
      title: input.title,
      description: input.description || null,
      status,
      createdBy: input.createdBy ?? null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      completedAt: status === "DONE" ? new Date() : null,
    },
  });
}

export async function setRoadmapStatus(id: string, status: RoadmapStatus) {
  return prisma.roadmapItem.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
}

export async function createAgentJob(input: { agentId: string | null; title: string; description?: string | null }) {
  return prisma.agentJob.create({
    data: { agentId: input.agentId, title: input.title, description: input.description || null },
  });
}

export async function setAgentJobStatus(id: string, status: AgentJobStatus, result?: string | null) {
  return prisma.agentJob.update({
    where: { id },
    data: {
      status,
      closedAt: status === "CLOSED" ? new Date() : null,
      ...(result !== undefined ? { result: result || null } : {}),
    },
  });
}
