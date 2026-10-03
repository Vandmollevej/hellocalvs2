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

// Fotos fra forside/energi/indhold (docs/DECISIONS.md 2026-10-03): sendes
// til loggen, så snart de er taget, så en afbrudt oprettelse kan ses med sine
// billeder. Skaleres ned først; keepalive kan ikke bære et foto (64 kB).
const LOG_PHOTO_MAX_SIDE = 1280;
const LOG_PHOTO_QUALITY = 0.8;

async function shrinkPhoto(photo: string): Promise<string> {
  const image = new Image();
  image.src = photo;
  await image.decode();
  const scale = Math.min(1, LOG_PHOTO_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas context");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", LOG_PHOTO_QUALITY);
}

export type ScanLogPhotoStep = "front" | "nutrition" | "ingredients";

export function scanLogPhoto(flowId: string, step: ScanLogPhotoStep, photo: string, barcode?: string | null) {
  void (async () => {
    try {
      const small = await shrinkPhoto(photo);
      await fetch("/api/debug-log/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowId, step, photo: small, barcode: barcode ?? null }),
      });
    } catch {
      // Logning er kun til test — flowet fortsætter altid.
    }
  })();
}
