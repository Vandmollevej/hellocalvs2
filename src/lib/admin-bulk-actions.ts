// Fælles handlinger for admin-lister over varer og retter (docs/DECISIONS.md
// 2026-10-11): markér rækker (klik, Ctrl/⌘, Shift) og vælg "Handlinger".
// Ingen Prisma-import, så klientkomponenter kan bruge typer og tekster.

// "product" = Product-rækker (varer og importerede retter),
// "recipe" = SharedRecipe-rækker (brugeroprettede retter).
export const BULK_KINDS = ["product", "recipe"] as const;
export type BulkKind = (typeof BULK_KINDS)[number];

export const BULK_ACTIONS = ["DISABLE", "ENABLE", "APPROVE", "REVIEW", "DELETE", "RESTORE"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

export const BULK_ACTION_LABELS: Record<BulkAction, string> = {
  DISABLE: "Disable",
  ENABLE: "Aktivér",
  APPROVE: "Godkend",
  REVIEW: "Send til gennemsyn",
  DELETE: "Slet",
  RESTORE: "Gendan",
};

// Hvad hver handling gør, vist som hjælpetekst i menuen.
export const BULK_ACTION_HINTS: Record<BulkAction, string> = {
  DISABLE: "Skjules for brugerne",
  ENABLE: "Vises for brugerne igen",
  APPROVE: "Markeres som godkendt",
  REVIEW: "Lægges i kø til gennemsyn",
  DELETE: "Flyttes til Slettede",
  RESTORE: "Tilbage til gennemsyn",
};

export const BULK_MAX_IDS = 500;

export type BulkRequest = { kind: BulkKind; action: BulkAction; ids: string[] };
export type BulkResult = { ok: true; changed: number } | { ok: false; message: string };

export function parseBulkRequest(body: unknown): BulkRequest | null {
  if (!body || typeof body !== "object") return null;
  const { kind, action, ids } = body as { kind?: unknown; action?: unknown; ids?: unknown };
  if (!(BULK_KINDS as readonly unknown[]).includes(kind)) return null;
  if (!(BULK_ACTIONS as readonly unknown[]).includes(action)) return null;
  if (!Array.isArray(ids)) return null;
  const clean = [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 100))];
  if (clean.length === 0 || clean.length > BULK_MAX_IDS) return null;
  return { kind: kind as BulkKind, action: action as BulkAction, ids: clean };
}

// Én enkelt række (til/fra-knappen) bruger samme rute som flervalg.
export async function sendBulkAction(request: BulkRequest): Promise<BulkResult> {
  try {
    const response = await fetch("/api/admin/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const data = (await response.json().catch(() => null)) as { changed?: number; message?: string } | null;
    if (!response.ok) return { ok: false, message: data?.message ?? "Handlingen mislykkedes" };
    return { ok: true, changed: data?.changed ?? 0 };
  } catch {
    return { ok: false, message: "Ingen forbindelse" };
  }
}
