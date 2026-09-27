import { NextResponse } from "next/server";
import { findAgentByToken } from "@/lib/ai-agents";
import { handleMcpMessage } from "@/lib/mcp-server";

// MCP-endpoint til Claude-integrationen (docs/DECISIONS.md 2026-09-27).
// Adressen indeholder agentens hemmelige token, så den kan tilføjes som
// "custom connector" i Claude.ai eller med `claude mcp add` i Claude Code.
export const dynamic = "force-dynamic";

async function agentFor(params: Promise<{ token: string }>) {
  const { token } = await params;
  return findAgentByToken(token);
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const agent = await agentFor(params);
  if (!agent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  const messages = Array.isArray(body) ? body : [body];
  const replies = [];
  for (const message of messages) {
    if (!message || typeof message !== "object" || typeof (message as { method?: unknown }).method !== "string") {
      // Svar fra klienten på server-requests bruges ikke (stateless server).
      continue;
    }
    const reply = await handleMcpMessage(agent, message as Parameters<typeof handleMcpMessage>[1]);
    if (reply) replies.push(reply);
  }

  if (replies.length === 0) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? replies : replies[0]);
}

// Stateless server: ingen SSE-strøm og ingen sessioner at afslutte.
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
