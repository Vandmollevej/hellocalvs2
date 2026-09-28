// Visning af admin "Log" (docs/DECISIONS.md 2026-09-28): danske navne på
// trinnene og sammenfatning af én scanning ud fra dens log-rækker.

export type DebugLogRow = {
  id: string;
  createdAt: Date;
  category: string;
  event: string;
  level: string;
  flowId: string | null;
  userId: string | null;
  barcode: string | null;
  productId: string | null;
  durationMs: number | null;
  message: string;
  data: unknown;
};

const EVENT_LABELS: Record<string, string> = {
  flow_start: "Kamera åbnet",
  camera_ready: "Kamera klar",
  camera_failed: "Kamera fejlede",
  barcode_read: "Stregkode aflæst",
  barcode_lookup: "Stregkodeopslag",
  barcode_lookup_error: "Opslag fejlede (telefon)",
  barcode_photo_saved: "Stregkode-foto",
  barcode_photo_failed: "Stregkode-foto mangler",
  front_photo: "Forside (lokal OCR)",
  front_duplicate_check: "Dublet-tjek",
  nutrition_photo: "Energi (lokal OCR)",
  ingredients_photo: "Ingredienser (lokal OCR)",
  photo_capture_failed: "Foto fejlede",
  product_create: "Vare oprettet (server)",
  product_create_failed: "Oprettelse fejlede (telefon)",
  flow_done: "Flow færdigt",
  flow_abandoned: "Flow forladt",
  enrich_front: "AI: navn/brand",
  enrich_label: "Energi + ingredienser",
  enrichment_done: "Varen færdig",
  hello_cal_product_front: "OpenAI: forside",
  hello_cal_nutrition: "OpenAI: næring",
  hello_cal_ingredients: "OpenAI: ingredienser",
  hello_cal_label: "OpenAI: næring + ingredienser",
  shelf_products: "OpenAI: hyldefoto",
  shelf_matches: "OpenAI: hyldematch",
};

export function eventLabel(row: Pick<DebugLogRow, "category" | "event">): string {
  const label = EVENT_LABELS[row.event];
  if (label) return label;
  if (row.category === "ai") return `OpenAI: ${row.event}`;
  return row.event;
}

export type FlowOutcome = "existing" | "created" | "duplicate" | "abandoned" | "open";

export const OUTCOME_LABELS: Record<FlowOutcome, string> = {
  existing: "Kendt vare",
  created: "Ny vare oprettet",
  duplicate: "Dublet fundet",
  abandoned: "Afbrudt",
  open: "Ikke afsluttet",
};

export type FlowSummary = {
  flowId: string;
  rows: DebugLogRow[];
  startedAt: Date;
  endedAt: Date;
  barcode: string | null;
  productId: string | null;
  userId: string | null;
  outcome: FlowOutcome;
  errors: number;
  warnings: number;
  // Kun for oprettede varer: er AI-berigelsen nået til ende?
  enrichmentDone: boolean | null;
};

function outcomeFromRow(row: DebugLogRow): FlowOutcome | null {
  if (row.event === "flow_abandoned") return "abandoned";
  if (row.event !== "flow_done") return null;
  const outcome = (row.data as { outcome?: unknown } | null)?.outcome;
  return outcome === "existing" || outcome === "created" || outcome === "duplicate" ? outcome : "created";
}

export function summarizeFlows(rows: DebugLogRow[]): FlowSummary[] {
  const byFlow = new Map<string, DebugLogRow[]>();
  for (const row of rows) {
    if (!row.flowId) continue;
    const list = byFlow.get(row.flowId);
    if (list) list.push(row);
    else byFlow.set(row.flowId, [row]);
  }

  const flows: FlowSummary[] = [];
  for (const [flowId, list] of byFlow) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let outcome: FlowOutcome = "open";
    for (const row of list) outcome = outcomeFromRow(row) ?? outcome;
    const created = outcome === "created";
    flows.push({
      flowId,
      rows: list,
      startedAt: list[0].createdAt,
      endedAt: list[list.length - 1].createdAt,
      barcode: list.find((row) => row.barcode)?.barcode ?? null,
      productId: [...list].reverse().find((row) => row.productId)?.productId ?? null,
      userId: list.find((row) => row.userId)?.userId ?? null,
      outcome,
      errors: list.filter((row) => row.level === "error").length,
      warnings: list.filter((row) => row.level === "warn").length,
      enrichmentDone: created ? list.some((row) => row.event === "enrichment_done") : null,
    });
  }
  return flows.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;
}

export function formatTime(date: Date): string {
  return date.toLocaleString("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
