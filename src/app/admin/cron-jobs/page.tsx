import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { JOBS } from "@/lib/jobs/registry";
import { ensureJobRows } from "@/lib/jobs/runner";
import { CronJobRow } from "@/components/admin/CronJobRow";

// Admin "Cron-jobs" (docs/DECISIONS.md 2026-09-25): alle baggrundsjob med
// beskrivelse, seneste kørsel, pause/genoptag, tidspunkt/interval og "kør nu".
export const dynamic = "force-dynamic";

export default async function AdminCronJobsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  await ensureJobRows();
  const rows = await prisma.scheduledJob.findMany();
  const rowByKey = new Map(rows.map((row) => [row.key, row]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="hf-type-title text-hf-black">Cron-jobs</h1>
        <p className="hf-type-body text-text-secondary">
          Baggrundsjob i appen og i robot-containerne. Ændringer slår igennem inden for et minut. Tider er dansk tid.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {JOBS.map((job) => {
          const row = rowByKey.get(job.key);
          return (
            <CronJobRow
              key={job.key}
              job={job}
              state={{
                enabled: row?.enabled ?? true,
                runAtTime: row?.runAtTime ?? job.defaultRunAtTime,
                intervalMinutes: row?.intervalMinutes ?? job.defaultIntervalMinutes,
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
      </div>
    </div>
  );
}
