import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { AGENT_TOKEN_COOKIE, mcpUrlForToken } from "@/lib/ai-agents";
import { createAgent, deleteAgent, rotateAgentToken, toggleAgent } from "./actions";

// Admin "Administration → Agenter" (docs/DECISIONS.md 2026-09-27): AI-agenter
// (fx Claude-sessioner) der kan tale med appen via MCP og oprette jobs og
// roadmap-punkter. Hver agent har sit eget token, som kan spærres/fornyes.
const dateFormat = new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short" });

async function readOnceToken() {
  const raw = (await cookies()).get(AGENT_TOKEN_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { agentId?: string; token?: string };
    return parsed.agentId && parsed.token ? { agentId: parsed.agentId, token: parsed.token } : null;
  } catch {
    return null;
  }
}

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { error } = await searchParams;

  const [agents, once] = await Promise.all([
    prisma.aiAgent.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { jobs: true } } },
    }),
    readOnceToken(),
  ]);
  const openJobs = await prisma.agentJob.groupBy({ by: ["agentId"], where: { status: "OPEN" }, _count: { _all: true } });
  const openByAgent = new Map(openJobs.map((row) => [row.agentId, row._count._all]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="hf-type-title text-hf-black">Agenter</h1>
        <p className="hf-type-body text-text-secondary">
          AI-agenter (fx Claude) der kan oprette jobs og roadmap-punkter via MCP. Se{" "}
          <Link href="/admin/claude" className="text-hf-green-dark underline">
            Claude-integration
          </Link>{" "}
          for hvordan en agent forbindes.
        </p>
      </div>

      {once && (
        <div className="hf-type-body flex flex-col gap-2 rounded-lg border border-hf-green bg-hf-white p-4">
          <p className="hf-type-strong text-hf-black">Ny MCP-adresse — kopiér den nu, den vises kun denne ene gang:</p>
          <code className="hf-type-small break-all rounded bg-page-bg px-3 py-2">{mcpUrlForToken(once.token)}</code>
          <p className="text-text-secondary">Adressen indeholder agentens hemmelige nøgle. Del den ikke.</p>
        </div>
      )}

      <form
        action={createAgent}
        className="flex flex-col gap-3 hf-surface p-4 sm:flex-row sm:items-end"
      >
        <label className="hf-type-body flex flex-1 flex-col gap-1">
          Navn
          <input name="name" required maxLength={80} placeholder="Fx Claude.ai (Peter)" className="hf-field rounded border border-hf-tan-dark bg-page-bg px-3" />
        </label>
        <label className="hf-type-body flex flex-1 flex-col gap-1">
          Beskrivelse
          <input name="description" maxLength={300} className="hf-field rounded border border-hf-tan-dark bg-page-bg px-3" />
        </label>
        <button type="submit" className="hf-type-body hf-type-strong hf-control rounded bg-hf-green-dark px-4 text-hf-white">
          Opret agent
        </button>
      </form>
      {error === "name" && <p className="hf-type-body text-[var(--hf-color-danger)]">Giv agenten et navn.</p>}

      {agents.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen agenter endnu.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="hf-type-body w-full text-left">
            <thead>
              <tr className="hf-type-small border-b border-hf-tan-dark uppercase tracking-wide text-text-muted">
                <th className="py-2 pr-3">Agent</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Jobs (åbne)</th>
                <th className="py-2 pr-3">Sidst set</th>
                <th className="py-2 pr-3">Handlinger</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-hf-tan-dark align-top">
                  <td className="py-3 pr-3">
                    <p className="hf-type-strong text-hf-black">{agent.name}</p>
                    {agent.description && <p className="hf-type-small text-text-secondary">{agent.description}</p>}
                  </td>
                  <td className="py-3 pr-3">{agent.disabled ? "Spærret" : "Aktiv"}</td>
                  <td className="py-3 pr-3">
                    {agent._count.jobs} ({openByAgent.get(agent.id) ?? 0})
                  </td>
                  <td className="py-3 pr-3 text-text-secondary">
                    {agent.lastSeenAt ? dateFormat.format(agent.lastSeenAt) : "Aldrig"}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleAgent}>
                        <input type="hidden" name="id" value={agent.id} />
                        <button type="submit" className="hf-type-small rounded border border-hf-tan-dark px-2 py-1 hover:bg-hf-tan">
                          {agent.disabled ? "Genaktivér" : "Spær"}
                        </button>
                      </form>
                      <form action={rotateAgentToken}>
                        <input type="hidden" name="id" value={agent.id} />
                        <button type="submit" className="hf-type-small rounded border border-hf-tan-dark px-2 py-1 hover:bg-hf-tan">
                          Ny adresse
                        </button>
                      </form>
                      <form action={deleteAgent}>
                        <input type="hidden" name="id" value={agent.id} />
                        <button type="submit" className="hf-type-small rounded border border-hf-tan-dark px-2 py-1 text-[var(--hf-color-danger)] hover:bg-hf-tan">
                          Slet
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
