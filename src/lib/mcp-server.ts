import type { AiAgent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ROADMAP_STATUSES,
  createAgentJob,
  createRoadmapItem,
  isRoadmapStatus,
  setAgentJobStatus,
  setRoadmapStatus,
} from "@/lib/ai-agents";

// Minimal MCP-server (Streamable HTTP, stateless JSON-svar) til Claude-
// integrationen (docs/DECISIONS.md 2026-09-27). Giver en agent adgang til
// roadmap og agent-jobs — intet andet i databasen er eksponeret.

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

type JsonRpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const TOOLS = [
  {
    name: "list_roadmap",
    description: "List Hello Cal roadmap items, optionally filtered by status.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", enum: ROADMAP_STATUSES } },
    },
  },
  {
    name: "add_roadmap_item",
    description: "Add a new item to the Hello Cal roadmap (shown in the admin under Roadmap og udvikling).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ROADMAP_STATUSES },
      },
      required: ["title"],
    },
  },
  {
    name: "update_roadmap_status",
    description: "Move a roadmap item to another status column.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, status: { type: "string", enum: ROADMAP_STATUSES } },
      required: ["id", "status"],
    },
  },
  {
    name: "list_jobs",
    description: "List agent jobs (open or closed).",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", enum: ["OPEN", "CLOSED"] } },
    },
  },
  {
    name: "create_job",
    description: "Register a job this agent has set up (e.g. a background task or scheduled run) so it shows in the admin.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" }, description: { type: "string" } },
      required: ["title"],
    },
  },
  {
    name: "close_job",
    description: "Mark an agent job as finished, optionally with a short result.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, result: { type: "string" } },
      required: ["id"],
    },
  },
];

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textResult(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string) {
  return { content: [{ type: "text", text: message }], isError: true };
}

async function callTool(agent: AiAgent, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "list_roadmap": {
      const status = isRoadmapStatus(args.status) ? args.status : undefined;
      const items = await prisma.roadmapItem.findMany({
        where: status ? { status } : undefined,
        orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
        select: { id: true, title: true, description: true, status: true, createdBy: true, createdAt: true },
      });
      return textResult(items);
    }
    case "add_roadmap_item": {
      const title = str(args.title);
      if (!title) return toolError("title is required");
      const item = await createRoadmapItem({
        title,
        description: str(args.description) || null,
        status: isRoadmapStatus(args.status) ? args.status : undefined,
        createdBy: agent.name,
      });
      return textResult({ id: item.id, status: item.status });
    }
    case "update_roadmap_status": {
      const id = str(args.id);
      if (!id || !isRoadmapStatus(args.status)) return toolError("id and a valid status are required");
      const exists = await prisma.roadmapItem.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return toolError("roadmap item not found");
      const item = await setRoadmapStatus(id, args.status);
      return textResult({ id: item.id, status: item.status });
    }
    case "list_jobs": {
      const status = args.status === "OPEN" || args.status === "CLOSED" ? args.status : undefined;
      const jobs = await prisma.agentJob.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, title: true, description: true, status: true, result: true, createdAt: true, agent: { select: { name: true } } },
      });
      return textResult(jobs);
    }
    case "create_job": {
      const title = str(args.title);
      if (!title) return toolError("title is required");
      const job = await createAgentJob({ agentId: agent.id, title, description: str(args.description) || null });
      return textResult({ id: job.id, status: job.status });
    }
    case "close_job": {
      const id = str(args.id);
      const exists = id ? await prisma.agentJob.findUnique({ where: { id }, select: { id: true } }) : null;
      if (!exists) return toolError("job not found");
      const job = await setAgentJobStatus(id, "CLOSED", str(args.result) || null);
      return textResult({ id: job.id, status: job.status });
    }
    default:
      return null;
  }
}

// Returnerer JSON-RPC-svaret, eller null for notifikationer (HTTP 202).
export async function handleMcpMessage(agent: AiAgent, message: JsonRpcRequest) {
  const id = message.id ?? null;
  const reply = (result: unknown) => ({ jsonrpc: "2.0" as const, id, result });
  const fail = (code: number, msg: string) => ({ jsonrpc: "2.0" as const, id, error: { code, message: msg } });

  if (message.id === undefined) return null;

  switch (message.method) {
    case "initialize": {
      const requested = str(message.params?.protocolVersion);
      return reply({
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "hello-cal-admin", version: "1.0.0" },
        instructions: "Hello Cal admin: read and add roadmap items, and register/close agent jobs.",
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = str(message.params?.name);
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
      const result = await callTool(agent, name, args);
      return result ? reply(result) : fail(-32602, `Unknown tool: ${name}`);
    }
    default:
      return fail(-32601, `Method not found: ${message.method}`);
  }
}
