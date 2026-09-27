import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { closeJob, deleteJob, reopenJob } from "./actions";

// Admin "Administration → Jobs" (docs/DECISIONS.md 2026-09-27): jobs som
// AI-agenter har sat op via MCP. Hovedmenuen på siden er "Åbne" og
// "Afsluttede".
const dateFormat = new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short" });

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { tab } = await searchParams;
  const status = tab === "closed" ? "CLOSED" : "OPEN";

  const [jobs, openCount, closedCount] = await Promise.all([
    prisma.agentJob.findMany({
      where: { status },
      orderBy: status === "OPEN" ? { createdAt: "desc" } : { closedAt: "desc" },
      take: 200,
      include: { agent: { select: { name: true } } },
    }),
    prisma.agentJob.count({ where: { status: "OPEN" } }),
    prisma.agentJob.count({ where: { status: "CLOSED" } }),
  ]);

  const tabs = [
    { key: "open", label: "Åbne", count: openCount, active: status === "OPEN" },
    { key: "closed", label: "Afsluttede", count: closedCount, active: status === "CLOSED" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Jobs</h1>
        <p className="text-sm text-text-secondary">Jobs som agenterne har sat op. Agenter oprettes under Agenter.</p>
      </div>

      <div className="flex gap-1 border-b border-border-strong">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={item.key === "open" ? "/admin/jobs" : "/admin/jobs?tab=closed"}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              item.active
                ? "border-hf-green-dark font-semibold text-hf-green-dark"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {item.label} ({item.count})
          </Link>
        ))}
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-text-secondary">
          {status === "OPEN" ? "Ingen åbne jobs." : "Ingen afsluttede jobs endnu."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">{job.title}</p>
                  <p className="text-xs text-text-muted">
                    {job.agent?.name ?? "Ukendt agent"} · oprettet {dateFormat.format(job.createdAt)}
                    {job.closedAt && ` · afsluttet ${dateFormat.format(job.closedAt)}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={status === "OPEN" ? closeJob : reopenJob}>
                    <input type="hidden" name="id" value={job.id} />
                    <button type="submit" className="rounded border border-border-strong px-2 py-1 text-xs hover:bg-hf-tan">
                      {status === "OPEN" ? "Afslut" : "Genåbn"}
                    </button>
                  </form>
                  <form action={deleteJob}>
                    <input type="hidden" name="id" value={job.id} />
                    <button type="submit" className="rounded border border-border-strong px-2 py-1 text-xs text-[var(--hf-color-danger)] hover:bg-hf-tan">
                      Slet
                    </button>
                  </form>
                </div>
              </div>
              {job.description && <p className="whitespace-pre-wrap text-sm text-text-secondary">{job.description}</p>}
              {job.result && (
                <p className="whitespace-pre-wrap rounded bg-page-bg px-3 py-2 text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">Resultat: </span>
                  {job.result}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
