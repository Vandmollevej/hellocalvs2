import { prisma } from "@/lib/prisma";
import { nightWindow, summarizeNightRuns, type NightJobSummary, type NightWindow } from "@/lib/jobs/night";

// Kørselshistorik for baggrundsjob (docs/DECISIONS.md 2026-10-02). Samme
// regler som _record_run i scripts/*/job_control.py — hold dem ens:
// - hver kørsel gemmes med status, besked og itemCount (hvor meget blev udført)
// - en tom OK-kørsel (0 udført) lægges sammen med forrige række, hvis den
//   også var tom, så "Løbende" jobs ikke fylder tabellen med ét tjek pr. 15 s
// - rækker ældre end RUN_RETENTION_DAYS slettes af vedligeholdsjobbet.

export const RUN_RETENTION_DAYS = 30;

export type JobResult = string | null | undefined | { message?: string | null; count?: number | null };

export function normalizeJobResult(result: JobResult): { message: string; count: number } {
  if (result === null || result === undefined) return { message: "OK", count: 0 };
  if (typeof result === "string") return { message: result || "OK", count: 0 };
  return { message: result.message || "OK", count: Math.max(0, Math.round(result.count ?? 0)) };
}

export async function recordJobRun(input: {
  jobKey: string;
  startedAt: Date;
  finishedAt: Date;
  status: "OK" | "ERROR";
  message: string;
  itemCount: number;
  durationMs: number;
}) {
  const message = input.message.slice(0, 1000);
  const idle = input.status === "OK" && input.itemCount === 0;
  if (idle) {
    const latest = await prisma.scheduledJobRun.findFirst({
      where: { jobKey: input.jobKey },
      orderBy: { finishedAt: "desc" },
      select: { id: true, status: true, itemCount: true },
    });
    if (latest && latest.status === "OK" && latest.itemCount === 0) {
      await prisma.scheduledJobRun.update({
        where: { id: latest.id },
        data: { finishedAt: input.finishedAt, message, runCount: { increment: 1 }, durationMs: { increment: input.durationMs } },
      });
      return;
    }
  }
  await prisma.scheduledJobRun.create({
    data: {
      jobKey: input.jobKey,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      status: input.status,
      message,
      itemCount: input.itemCount,
      durationMs: input.durationMs,
    },
  });
}

export async function pruneOldJobRuns(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.scheduledJobRun.deleteMany({ where: { finishedAt: { lt: cutoff } } });
  return result.count;
}

// Nattens kørsler pr. job (admin "Robotter" + oversigten).
export async function loadNightRuns(now: Date = new Date()): Promise<{
  window: NightWindow;
  byJob: Map<string, NightJobSummary>;
}> {
  const window = nightWindow(now);
  const runs = await prisma.scheduledJobRun.findMany({
    where: { finishedAt: { gte: window.from, lte: window.to } },
    orderBy: { finishedAt: "asc" },
  });
  return { window, byJob: summarizeNightRuns(runs, window) };
}
