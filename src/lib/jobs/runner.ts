import { prisma } from "@/lib/prisma";
import { JOBS } from "@/lib/jobs/registry";
import { isJobDue } from "@/lib/jobs/schedule";
import { debugLog, errorText } from "@/lib/debug-log";
import { normalizeJobResult, recordJobRun, type JobResult } from "@/lib/jobs/runs";

// Kører app-processens jobs (runtime "app" i src/lib/jobs/registry.ts), når
// scheduled_jobs-rækken siger det (admin "Cron-jobs", docs/DECISIONS.md
// 2026-09-25). Samme regler som scripts/*/job_control.py. Et job "claimes"
// ved at sætte lastStartedAt betinget af den gamle værdi, så to processer
// aldrig kører samme job samtidig.

// Et job returnerer en kort statusbesked og evt. hvor meget det udførte
// ({ message, count }); begge vises på admin "Robotter"/"Cron-jobs" og i
// "Nattens kørsler" (docs/DECISIONS.md 2026-10-02).
export type AppJobRunner = () => Promise<JobResult>;

export async function ensureJobRows() {
  await prisma.scheduledJob.createMany({
    data: JOBS.map((job) => ({
      key: job.key,
      intervalMinutes: job.defaultIntervalMinutes,
      runAtTime: job.defaultRunAtTime,
    })),
    skipDuplicates: true,
  });
}

let rowsEnsured = false;
const running = new Set<string>();

export async function runDueAppJobs(runners: Record<string, AppJobRunner>) {
  if (!rowsEnsured) {
    await ensureJobRows();
    rowsEnsured = true;
  }
  const rows = await prisma.scheduledJob.findMany({
    where: { key: { in: JOBS.filter((j) => j.runtime === "app").map((j) => j.key) } },
  });
  const now = new Date();

  for (const row of rows) {
    const runner = runners[row.key];
    if (!runner || running.has(row.key) || !isJobDue(row, now)) continue;

    const claimed = await prisma.scheduledJob.updateMany({
      where: { key: row.key, lastStartedAt: row.lastStartedAt },
      data: { lastStartedAt: now, runRequestedAt: null },
    });
    if (claimed.count !== 1) continue;

    running.add(row.key);
    const started = Date.now();
    // Jobs kører ikke parallelt med sig selv, men et langt job (fx den
    // natlige AI-genkørsel) må ikke blokere de øvrige — derfor uden await.
    // Hver kørsel står også i admin "Log" (docs/DECISIONS.md 2026-09-28).
    void runner()
      .then(async (result) => {
        const { message, count } = normalizeJobResult(result);
        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - started;
        void debugLog({ category: "cron", event: row.key, message, durationMs });
        await prisma.scheduledJob.update({
          where: { key: row.key },
          data: { lastRunAt: finishedAt, lastStatus: "OK", lastMessage: message.slice(0, 1000), lastDurationMs: durationMs },
        });
        await recordJobRun({ jobKey: row.key, startedAt: now, finishedAt, status: "OK", message, itemCount: count, durationMs });
      })
      .catch(async (error: unknown) => {
        console.error(`[jobs] ${row.key} fejlede`, error);
        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - started;
        const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
        void debugLog({ category: "cron", event: row.key, level: "error", message: errorText(error), durationMs });
        await prisma.scheduledJob.update({
          where: { key: row.key },
          data: { lastRunAt: finishedAt, lastStatus: "ERROR", lastMessage: message, lastDurationMs: durationMs },
        });
        await recordJobRun({ jobKey: row.key, startedAt: now, finishedAt, status: "ERROR", message, itemCount: 0, durationMs });
      })
      .catch((error: unknown) => console.error(`[jobs] ${row.key}: status kunne ikke gemmes`, error))
      .finally(() => running.delete(row.key));
  }
}
