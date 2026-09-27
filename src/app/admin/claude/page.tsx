import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { mcpUrlForToken } from "@/lib/ai-agents";

// Admin "Roadmap og udvikling → Claude-integration" (docs/DECISIONS.md
// 2026-09-27): vejledning i at forbinde Claude til appens MCP-endpoint, så
// man kan oprette roadmap-punkter og jobs direkte fra Claude.
const TOOLS = [
  ["list_roadmap", "Vis roadmap-punkter (evt. kun én kolonne)"],
  ["add_roadmap_item", "Opret et nyt roadmap-punkt"],
  ["update_roadmap_status", "Flyt et punkt til en anden kolonne"],
  ["list_jobs", "Vis åbne eller afsluttede jobs"],
  ["create_job", "Registrér et job agenten har sat op"],
  ["close_job", "Afslut et job med et kort resultat"],
] as const;

export default async function ClaudeIntegrationPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const activeAgents = await prisma.aiAgent.count({ where: { disabled: false } });
  const example = mcpUrlForToken("<din-nøgle>");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="hf-type-title text-hf-black">Claude-integration</h1>
        <p className="hf-type-body text-text-secondary">
          Forbind din Claude-konto til Hello Cal via MCP, så du kan skrive fx &quot;tilføj til roadmap: …&quot; direkte i
          Claude.
        </p>
      </div>

      <ol className="hf-type-body flex flex-col gap-4">
        <li className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
          <p className="hf-type-strong text-hf-black">1. Opret en agent</p>
          <p className="mt-1 text-text-secondary">
            Gå til{" "}
            <Link href="/admin/agents" className="text-hf-green-dark underline">
              Agenter
            </Link>{" "}
            og opret fx &quot;Claude.ai&quot;. Du får en personlig MCP-adresse, som kun vises én gang. Aktive agenter nu:{" "}
            {activeAgents}.
          </p>
          <code className="hf-type-small mt-2 block break-all rounded bg-page-bg px-3 py-2">{example}</code>
        </li>
        <li className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
          <p className="hf-type-strong text-hf-black">2a. Claude.ai (web, app og mobil)</p>
          <p className="mt-1 text-text-secondary">
            Indstillinger → Connectors → Tilføj custom connector. Giv den navnet &quot;Hello Cal&quot; og indsæt
            MCP-adressen. Slå connectoren til i en samtale via værktøjsmenuen.
          </p>
        </li>
        <li className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
          <p className="hf-type-strong text-hf-black">2b. Claude Code</p>
          <p className="mt-1 text-text-secondary">Kør i en terminal:</p>
          <code className="hf-type-small mt-2 block break-all rounded bg-page-bg px-3 py-2">
            claude mcp add --transport http hellocal {example}
          </code>
        </li>
      </ol>

      <div className="hf-type-body rounded-lg border border-hf-tan-dark bg-hf-white p-4">
        <p className="hf-type-strong text-hf-black">Hvad Claude kan</p>
        <ul className="mt-2 flex flex-col gap-1 text-text-secondary">
          {TOOLS.map(([name, description]) => (
            <li key={name}>
              <code className="hf-type-small text-hf-black">{name}</code> — {description}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-text-secondary">
          Claude har kun adgang til roadmap og jobs — ikke brugere, produkter eller andre data. Spær eller forny adressen
          under Agenter, hvis den er blevet delt ved en fejl.
        </p>
      </div>
    </div>
  );
}
