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

// AI-tolkningen af hele sætningen (/api/ai/interpret-meal), løbende mens der
// tales: hver vare med mængde, om den ramte en vare i databasen, og AI'ens
// egen korte begrundelse.
export type VoiceAiItem = {
  name: string;
  amountLabel: string;
  amountGrams: number;
  reason: string;
  match: { id: string; name: string } | null;
  kcal: number;
};

export type VoiceAiStep = { at: number; heard: string; items: VoiceAiItem[] };

export type VoiceSessionData = { region: string | null; steps: VoiceStep[]; ai?: VoiceAiStep[] };

export type VoiceSearchLog = Omit<VoiceStep, "at" | "total"> & {
  sessionId: string;
  region: string | null;
};

// Mens man taler, kommer søgninger og tolkninger tæt; de skrives én ad
// gangen pr. session, så intet trin går tabt, og sessionen ikke får to rækker.
const queues = new Map<string, Promise<void>>();

function enqueue(sessionId: string, write: () => Promise<void>): Promise<void> {
  const next = (queues.get(sessionId) ?? Promise.resolve()).then(write);
  queues.set(sessionId, next);
  void next.then(() => {
    if (queues.get(sessionId) === next) queues.delete(sessionId);
  });
  return next;
}

// Læser sessionens række, lader `change` bygge de nye data ud fra tiden siden
// sessionens start, og skriver dem tilbage (eller opretter rækken).
async function updateSession(
  sessionId: string,
  change: (data: VoiceSessionData, at: number) => VoiceSessionData,
): Promise<void> {
  try {
    if (!VOICE_SESSION_PATTERN.test(sessionId)) return;
    const existing = await prisma.debugLog.findFirst({
      where: { category: "voice", flowId: sessionId },
      select: { id: true, createdAt: true, data: true },
    });
    const at = existing ? Date.now() - existing.createdAt.getTime() : 0;
    const data = change((existing?.data as VoiceSessionData | null) ?? { region: null, steps: [] }, at);
    const last = data.steps[data.steps.length - 1];
    const lastAi = data.ai?.[data.ai.length - 1];
    const heard = (lastAi && (!last || lastAi.at >= last.at) ? lastAi.heard : last?.heard) ?? "";
    const fields = {
      event: "voice_search",
      level: last && last.total === 0 && !lastAi?.items.length ? "warn" : "info",
      message: heard.slice(0, 2000),
      data,
    };
    if (existing) {
      await prisma.debugLog.update({ where: { id: existing.id }, data: { ...fields, durationMs: at } });
    } else {
      await prisma.debugLog.create({ data: { ...fields, category: "voice", flowId: sessionId } });
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await prisma.debugLog.deleteMany({ where: { category: "voice", createdAt: { lt: cutoff } } });
    }
  } catch (error) {
    console.error("[voice-search-log] could not write", error);
  }
}

export function logVoiceSearch(log: VoiceSearchLog): Promise<void> {
  return enqueue(log.sessionId, () =>
    updateSession(log.sessionId, (data, at) => {
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
      const steps = [...data.steps.filter((item) => item.heard !== log.heard), step].slice(-MAX_STEPS);
      return { ...data, region: log.region ?? data.region, steps };
    }),
  );
}

export function logVoiceInterpretation(log: { sessionId: string; heard: string; items: VoiceAiItem[] }): Promise<void> {
  return enqueue(log.sessionId, () =>
    updateSession(log.sessionId, (data, at) => {
      const step: VoiceAiStep = { at, heard: log.heard, items: log.items };
      const ai = [...(data.ai ?? []).filter((item) => item.heard !== log.heard), step].slice(-MAX_STEPS);
      return { ...data, ai };
    }),
  );
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
    region: (row.data as VoiceSessionData | null)?.region ?? null,
    steps: (row.data as VoiceSessionData | null)?.steps ?? [],
    ai: (row.data as VoiceSessionData | null)?.ai ?? [],
  }));
}
