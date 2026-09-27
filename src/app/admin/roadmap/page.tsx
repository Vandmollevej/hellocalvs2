import { redirect } from "next/navigation";
import { IconArrowLeft, IconArrowRight, IconRobot, IconTrash } from "@tabler/icons-react";
import type { RoadmapStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ROADMAP_STATUSES, ROADMAP_STATUS_LABEL } from "@/lib/ai-agents";
import { addRoadmapItem, deleteRoadmapItem, moveRoadmapItem } from "./actions";

// Admin "Roadmap og udvikling → Roadmap" (docs/DECISIONS.md 2026-09-27):
// tavle med fire kolonner. Punkter oprettes her eller af en agent via MCP
// (Claude-integration) og flyttes mellem kolonnerne med pilene.
const dateFormat = new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" });

const COLUMN_ACCENT: Record<RoadmapStatus, string> = {
  IDEA: "bg-text-muted",
  PLANNED: "bg-hf-tan",
  IN_PROGRESS: "bg-hf-green",
  DONE: "bg-hf-green-dark",
};

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { error } = await searchParams;

  const items = await prisma.roadmapItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const byStatus = new Map<RoadmapStatus, typeof items>(ROADMAP_STATUSES.map((status) => [status, []]));
  for (const item of items) byStatus.get(item.status)?.push(item);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Roadmap</h1>
        <p className="text-sm text-text-secondary">
          Planlagt udvikling af Hello Cal. Nye punkter kan også oprettes fra Claude via Claude-integrationen.
        </p>
      </div>

      <form action={addRoadmapItem} className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Titel
            <input name="title" required maxLength={200} className="hf-field rounded border border-border-strong bg-page-bg px-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:w-44">
            Kolonne
            <select name="status" defaultValue="IDEA" className="hf-field rounded border border-border-strong bg-page-bg px-3">
              {ROADMAP_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ROADMAP_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Beskrivelse
          <textarea name="description" rows={2} maxLength={4000} className="rounded border border-border-strong bg-page-bg px-3 py-2" />
        </label>
        <div>
          <button type="submit" className="hf-control rounded bg-hf-green-dark px-4 text-sm font-semibold text-white">
            Tilføj punkt
          </button>
        </div>
        {error === "title" && <p className="text-sm text-[var(--hf-color-danger)]">Giv punktet en titel.</p>}
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ROADMAP_STATUSES.map((status, columnIndex) => {
          const columnItems = byStatus.get(status) ?? [];
          return (
            <section key={status} className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3">
              <header className="flex items-center gap-2 px-1">
                <span className={`h-2.5 w-2.5 rounded-full ${COLUMN_ACCENT[status]}`} />
                <h2 className="text-sm font-semibold text-text-primary">{ROADMAP_STATUS_LABEL[status]}</h2>
                <span className="ml-auto text-xs text-text-muted">{columnItems.length}</span>
              </header>
              {columnItems.length === 0 && <p className="px-1 text-xs text-text-muted">Ingen punkter</p>}
              {columnItems.map((item) => (
                <article key={item.id} className="flex flex-col gap-2 rounded-md border border-border-strong bg-page-bg p-3">
                  <p className="text-sm font-medium text-text-primary">{item.title}</p>
                  {item.description && (
                    <p className="whitespace-pre-wrap text-xs text-text-secondary">{item.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-text-muted">
                    {item.createdBy && <IconRobot size={14} aria-label="Oprettet af agent" />}
                    <span>
                      {item.createdBy ? `${item.createdBy} · ` : ""}
                      {dateFormat.format(item.createdAt)}
                    </span>
                    <div className="ml-auto flex gap-1">
                      {columnIndex > 0 && (
                        <MoveButton id={item.id} status={ROADMAP_STATUSES[columnIndex - 1]} label="Flyt til venstre">
                          <IconArrowLeft size={14} />
                        </MoveButton>
                      )}
                      {columnIndex < ROADMAP_STATUSES.length - 1 && (
                        <MoveButton id={item.id} status={ROADMAP_STATUSES[columnIndex + 1]} label="Flyt til højre">
                          <IconArrowRight size={14} />
                        </MoveButton>
                      )}
                      <form action={deleteRoadmapItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" aria-label="Slet" className="rounded p-1 hover:bg-hf-tan">
                          <IconTrash size={14} />
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MoveButton({ id, status, label, children }: { id: string; status: RoadmapStatus; label: string; children: React.ReactNode }) {
  return (
    <form action={moveRoadmapItem}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" aria-label={label} title={label} className="rounded p-1 hover:bg-hf-tan">
        {children}
      </button>
    </form>
  );
}
