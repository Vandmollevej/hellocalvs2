import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { JOBS } from "@/lib/jobs/registry";
import { ensureJobRows } from "@/lib/jobs/runner";
import { loadNightRuns } from "@/lib/jobs/runs";
import { describeNightSummary, describeNightWindow } from "@/lib/jobs/night";
import { RobotRow } from "@/components/admin/RobotRow";

// Admin "Robotter" (docs/DECISIONS.md 2026-09-28): robot-containerne
// (runtime "agent") med on/off, KØR og cron-job-plan. Samme scheduled_jobs-
// rækker som "Cron-jobs", så ændringer ses begge steder. Kolonnerne
// "Seneste kørsel" og "I nat" viser hvor meget robotten udførte
// (scheduled_job_runs, docs/DECISIONS.md 2026-10-02).
export const dynamic = "force-dynamic";

export default async function AdminRobotsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  await ensureJobRows();
  const robots = JOBS.filter((job) => job.runtime === "agent");
  const rows = await prisma.scheduledJob.findMany({ where: { key: { in: robots.map((job) => job.key) } } });
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  const night = await loadNightRuns().catch(() => null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="hf-type-title text-hf-black">Robotter</h1>
        <p className="hf-type-body text-text-secondary">
          Robotterne i hver sin container. &quot;Løbende&quot; betyder, at robotten hele tiden venter på nye varer.
          Ændringer slår igennem inden for et minut. Tider er dansk tid.
        </p>
        {night && (
          <p className="hf-type-small mt-1 text-text-muted">
            Nattens kørsler: {describeNightWindow(night.window)} (natten regnes fra kl. 20 til kl. 8).
          </p>
        )}
      </div>
      <div className="overflow-x-auto hf-surface px-4">
        <table className="hf-type-body w-full min-w-[900px] text-left">
          <thead>
            <tr className="hf-type-small border-b border-hf-tan-dark uppercase tracking-wide text-text-muted">
              <th className="py-2 pr-4">Robot</th>
              <th className="py-2 pr-4">On/Off</th>
              <th className="py-2 pr-4">Kør</th>
              <th className="py-2 pr-4">Cron-job</th>
              <th className="py-2 pr-4">Seneste kørsel</th>
              <th className="py-2 pr-4">I nat</th>
            </tr>
          </thead>
          <tbody>
            {robots.map((job) => {
              const row = rowByKey.get(job.key);
              const summary = night?.byJob.get(job.key);
              return (
                <RobotRow
                  key={job.key}
                  job={job}
                  night={
                    night
                      ? {
                          text: describeNightSummary(summary),
                          message: summary?.lastMessage ?? null,
                          error: summary?.lastError ?? null,
                        }
                      : null
                  }
                  state={{
                    enabled: row?.enabled ?? true,
                    runAtTime: row ? row.runAtTime : job.defaultRunAtTime,
                    intervalMinutes: row ? row.intervalMinutes : job.defaultIntervalMinutes,
                    runRequestedAt: row?.runRequestedAt?.toISOString() ?? null,
                    lastStartedAt: row?.lastStartedAt?.toISOString() ?? null,
                    lastRunAt: row?.lastRunAt?.toISOString() ?? null,
                    lastStatus: row?.lastStatus ?? null,
                    lastMessage: row?.lastMessage ?? null,
                    lastDurationMs: row?.lastDurationMs ?? null,
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
