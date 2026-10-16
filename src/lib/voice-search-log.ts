import { prisma } from "@/lib/prisma";
import { isDebugLogEnabled } from "@/lib/debug-log";

// Admin → Log → Tale (docs/DECISIONS.md 2026-10-16): mikrofonen på Madvarer
// søger løbende, mens man taler. Én række pr. mikrofon-session (flowId =
// sessionens id) viser, hvad telefonen hørte undervejs, hvad der blev søgt
// på, og hvilke varer der kom frem — så man kan se, om et dårligt forslag
// skyldes hørelsen eller søgningen. Ingen AI er involveret. Logningen må
// aldrig vælte eller forsinke søgningen; alle fejl sluges.

export const VOICE_SESSION_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MAX_STEPS = 40;
const MAX_RESULTS = 10;

export type VoiceSearchLog = {
  sessionId: string;
  userId: string | null;
  heard: string;
  searched: string;
  corrected?: string;
  suggested?: string;
  results: string[];
};

type StoredData = { steps?: string[] };

export function voiceSearchMessage(log: Pick<VoiceSearchLog, "heard" | "searched" | "corrected" | "results">): string {
  const searched = log.corrected ?? log.searched;
  const parts = [`Hørt: "${log.heard}"`];
  if (searched.toLowerCase() !== log.heard.toLowerCase()) parts.push(`søgt: "${searched}"`);
  const top = log.results.slice(0, 3);
  parts.push(log.results.length === 0 ? "ingen resultater" : `${log.results.length} resultater: ${top.join(", ")}`);
  return parts.join(" → ");
}

export async function logVoiceSearch(log: VoiceSearchLog): Promise<void> {
  try {
    if (!VOICE_SESSION_PATTERN.test(log.sessionId)) return;
    if (!(await isDebugLogEnabled())) return;
    const existing = await prisma.debugLog.findFirst({
      where: { category: "voice", flowId: log.sessionId },
      select: { id: true, createdAt: true, data: true },
    });
    const steps = ((existing?.data as StoredData | null)?.steps ?? []).slice(-(MAX_STEPS - 1));
    if (steps[steps.length - 1] !== log.heard) steps.push(log.heard);
    const data = {
      heard: log.heard,
      searched: log.searched,
      ...(log.corrected ? { corrected: log.corrected } : {}),
      ...(log.suggested ? { suggested: log.suggested } : {}),
      results: log.results.slice(0, MAX_RESULTS),
      steps,
    };
    const fields = {
      event: "voice_search",
      level: log.results.length === 0 ? "warn" : "info",
      message: voiceSearchMessage(log).slice(0, 2000),
      data,
    };
    if (existing) {
      await prisma.debugLog.update({
        where: { id: existing.id },
        data: { ...fields, durationMs: Date.now() - existing.createdAt.getTime() },
      });
    } else {
      await prisma.debugLog.create({
        data: { ...fields, category: "voice", flowId: log.sessionId, userId: log.userId },
      });
    }
  } catch (error) {
    console.error("[voice-search-log] could not write", error);
  }
}
