// Klientsiden af admin "Log" (docs/DECISIONS.md 2026-09-28): kameraflowets
// egne trin sendes til POST /api/debug-log, og flow-id'et følger med i
// headeren på flowets API-kald (SCAN_FLOW_HEADER i src/lib/debug-log.ts), så
// hele scanningen står samlet. Logningen må aldrig forsinke eller vælte flowet.

export const SCAN_FLOW_HEADER = "x-scan-flow";

export function newScanFlowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function scanFlowHeaders(flowId: string | undefined): Record<string, string> {
  return flowId ? { [SCAN_FLOW_HEADER]: flowId } : {};
}

export type ScanLogEntry = {
  message: string;
  level?: "info" | "warn" | "error";
  barcode?: string | null;
  productId?: string | null;
  durationMs?: number | null;
  data?: Record<string, unknown>;
};

export function scanLog(flowId: string, event: string, entry: ScanLogEntry) {
  try {
    void fetch("/api/debug-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // keepalive: trinnet når frem, selv om brugeren navigerer væk.
      keepalive: true,
      body: JSON.stringify({ flowId, event, ...entry }),
    }).catch(() => {});
  } catch {
    // Logning er kun til test — flowet fortsætter altid.
  }
}
