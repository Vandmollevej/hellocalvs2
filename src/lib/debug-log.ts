import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Admin "Log" (docs/DECISIONS.md 2026-09-28): test-log indtil appen går live.
// Hvert trin i scan-flowet, hvert OpenAI-kald, hver cron-kørsel og fejl.
// Logningen må aldrig vælte eller forsinke det, den logger — alle fejl
// sluges, og den kan slås fra på admin-siden (DebugLogSettings).

export type DebugLogCategory = "scan" | "ai" | "cron" | "error";
export type DebugLogLevel = "info" | "warn" | "error";

export type DebugLogInput = {
  category: DebugLogCategory;
  event: string;
  message: string;
  level?: DebugLogLevel;
  flowId?: string | null;
  userId?: string | null;
  barcode?: string | null;
  productId?: string | null;
  durationMs?: number | null;
  data?: Record<string, unknown> | null;
};

// Kameraflowet sender sit flow-id med i denne header, så serverens trin
// havner i samme scanning som telefonens.
export const SCAN_FLOW_HEADER = "x-scan-flow";

const FLOW_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MAX_MESSAGE = 2000;
const MAX_DATA_CHARS = 20000;
const RETENTION_DAYS = 30;
const SETTING_CACHE_MS = 15_000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;

export function cleanFlowId(value: unknown): string | null {
  return typeof value === "string" && FLOW_ID_PATTERN.test(value) ? value : null;
}

export function flowIdFromRequest(req: Request): string | null {
  return cleanFlowId(req.headers.get(SCAN_FLOW_HEADER));
}

// Kontekst for kald dybt nede (fx OpenAI-kaldene under berigelsen af en ny
// vare), så de kommer med i scanningens tidslinje uden at alle
// mellemliggende funktioner skal kende flow-id'et.
type DebugContext = { flowId?: string | null; userId?: string | null; barcode?: string | null; productId?: string | null };
const contextStorage = new AsyncLocalStorage<DebugContext>();

export function withDebugContext<T>(context: DebugContext, fn: () => T): T {
  return contextStorage.run({ ...contextStorage.getStore(), ...context }, fn);
}

export function getDebugContext(): DebugContext {
  return contextStorage.getStore() ?? {};
}

let settingCache: { enabled: boolean; at: number } | null = null;

export async function isDebugLogEnabled(): Promise<boolean> {
  if (settingCache && Date.now() - settingCache.at < SETTING_CACHE_MS) return settingCache.enabled;
  try {
    const row = await prisma.debugLogSettings.findUnique({ where: { id: "default" } });
    settingCache = { enabled: row?.enabled ?? true, at: Date.now() };
  } catch {
    settingCache = { enabled: false, at: Date.now() };
  }
  return settingCache.enabled;
}

export async function setDebugLogEnabled(enabled: boolean) {
  await prisma.debugLogSettings.upsert({
    where: { id: "default" },
    update: { enabled },
    create: { id: "default", enabled },
  });
  settingCache = { enabled, at: Date.now() };
}

function cleanData(data: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined {
  if (!data) return undefined;
  try {
    const json = JSON.stringify(data);
    if (json.length > MAX_DATA_CHARS) return { truncated: true, preview: json.slice(0, 2000) };
    return JSON.parse(json) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

let lastPruneAt = 0;

async function pruneOldRows() {
  if (Date.now() - lastPruneAt < PRUNE_EVERY_MS) return;
  lastPruneAt = Date.now();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.debugLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

export async function debugLog(input: DebugLogInput): Promise<void> {
  const context = getDebugContext();
  try {
    if (!(await isDebugLogEnabled())) return;
    await prisma.debugLog.create({
      data: {
        category: input.category,
        event: input.event.slice(0, 64),
        level: input.level ?? "info",
        flowId: input.flowId ?? context.flowId ?? null,
        userId: input.userId ?? context.userId ?? null,
        barcode: input.barcode ?? context.barcode ?? null,
        productId: input.productId ?? context.productId ?? null,
        durationMs:
          typeof input.durationMs === "number" && Number.isFinite(input.durationMs) ? Math.round(input.durationMs) : null,
        message: input.message.slice(0, MAX_MESSAGE),
        data: cleanData(input.data),
      },
    });
    await pruneOldRows();
  } catch (error) {
    console.error("[debug-log] could not write", input.category, input.event, error);
  }
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
