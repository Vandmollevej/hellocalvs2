import { prisma } from "@/lib/prisma";
import type { ReasonPoints } from "@/lib/search-explain";

// Admin → Analyse → Søgning → Tale (docs/DECISIONS.md 2026-10-16): mikrofonen
// på Madvarer søger løbende, mens man taler. Én række pr. mikrofon-session
// (debug_logs, kategori "voice", flowId = sessionens id) med et trin for hver
// søgning undervejs: hvad telefonen hørte, hvad der blev søgt på, og de
// viste varer med pointene bag rækkefølgen. Ingen AI er involveret.
// Anonymt som resten af søgestatistikken. Logningen må aldrig vælte eller
// forsinke søgningen; alle fejl sluges.

export const VOICE_SESSION_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MAX_STEPS = 40;
const MAX_RESULTS = 5;
const RETENTION_DAYS = 30;

export type VoiceResult = { id: string; name: string; image: string | null; points: ReasonPoints };

export type VoiceStep = {
  // Millisekunder fra sessionens første søgning.
  at: number;
  heard: string;
  searched: string;
  corrected?: string;
  suggested?: string;
  total: number;
  results: VoiceResult[];
};

export type VoiceSessionData = { region: string | null; steps: VoiceStep[] };

export type VoiceSearchLog = Omit<VoiceStep, "at" | "total"> & {
  sessionId: string;
  region: string | null;
};

// Mens man taler, kommer søgningerne tæt; de skrives én ad gangen pr.
// session, så ingen trin går tabt, og sessionen ikke får to rækker.
const queues = new Map<string, Promise<void>>();

export function logVoiceSearch(log: VoiceSearchLog): Promise<void> {
  const next = (queues.get(log.sessionId) ?? Promise.resolve()).then(() => writeVoiceSearch(log));
  queues.set(log.sessionId, next);
  void next.then(() => {
    if (queues.get(log.sessionId) === next) queues.delete(log.sessionId);
  });
  return next;
}

async function writeVoiceSearch(log: VoiceSearchLog): Promise<void> {
  try {
    if (!VOICE_SESSION_PATTERN.test(log.sessionId)) return;
    const existing = await prisma.debugLog.findFirst({
      where: { category: "voice", flowId: log.sessionId },
      select: { id: true, createdAt: true, data: true },
    });
    const at = existing ? Date.now() - existing.createdAt.getTime() : 0;
    const step: VoiceStep = {
      at,
      heard: log.heard,
      searched: log.searched,
      ...(log.corrected ? { corrected: log.corrected } : {}),
      ...(log.suggested ? { suggested: log.suggested } : {}),
      total: log.results.length,
      results: log.results.slice(0, MAX_RESULTS),
    };
    // Samme tekst søgt igen (fx efter "stop") giver ikke et nyt trin.
    const previous = ((existing?.data as VoiceSessionData | null)?.steps ?? []).filter((item) => item.heard !== log.heard);
    const steps = [...previous, step].slice(-MAX_STEPS);
    const data = { region: log.region, steps };
    const fields = {
      event: "voice_search",
      level: step.total === 0 ? "warn" : "info",
      message: log.heard.slice(0, 2000),
      data,
    };
    if (existing) {
      await prisma.debugLog.update({ where: { id: existing.id }, data: { ...fields, durationMs: at } });
    } else {
      await prisma.debugLog.create({ data: { ...fields, category: "voice", flowId: log.sessionId } });
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await prisma.debugLog.deleteMany({ where: { category: "voice", createdAt: { lt: cutoff } } });
    }
  } catch (error) {
    console.error("[voice-search-log] could not write", error);
  }
}

export async function loadVoiceSessions({ from, to }: { from: Date; to: Date }, take = 50) {
  const rows = await prisma.debugLog.findMany({
    where: { category: "voice", createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, createdAt: true, durationMs: true, data: true },
  });
  return rows.map((row) => ({
    id: row.id,
    startedAt: row.createdAt,
    durationMs: row.durationMs ?? 0,
    ...((row.data as VoiceSessionData | null) ?? { region: null, steps: [] }),
  }));
}
