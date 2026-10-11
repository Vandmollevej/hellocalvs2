// Klient-sikre typer og konstanter til admin "Open Food Facts → Billeder"
// (docs/DECISIONS.md 2026-10-11). Server-delen (forespørgsel, gem) ligger i
// src/lib/off-image-review.ts, som ikke må importeres i klientkomponenter.

export const OFF_IMAGE_TABS = ["review", "approved", "rejected"] as const;
export type OffImageTab = (typeof OFF_IMAGE_TABS)[number];
export type OffImageDecision = "APPROVED" | "REJECTED";

export const OFF_IMAGE_SORTS = ["interactions_desc", "interactions_asc", "added_desc", "added_asc", "changed_desc", "changed_asc"] as const;
export type OffImageSort = (typeof OFF_IMAGE_SORTS)[number];

export const OFF_IMAGE_PER_PAGE = [10, 20, 50, 100, 200] as const;
export const OFF_IMAGE_DEFAULT_PER_PAGE = 50;
// "Kun 1 scanning fra" = mindst 2 interaktioner.
export const OFF_IMAGE_MIN_INTERACTIONS = [0, 2, 3, 5, 10] as const;

export const OFF_IMAGE_TAB_LABEL: Record<OffImageTab, string> = {
  review: "Til gennemgang",
  approved: "Godkendt",
  rejected: "Afvist",
};

export const OFF_IMAGE_SORT_LABEL: Record<OffImageSort, string> = {
  interactions_desc: "Flest interaktioner først",
  interactions_asc: "Færrest interaktioner først",
  added_desc: "Nyest i databasen først",
  added_asc: "Ældst i databasen først",
  changed_desc: "Senest ændret først",
  changed_asc: "Ældst ændret først",
};

export function defaultSortFor(tab: OffImageTab): OffImageSort {
  return tab === "review" ? "interactions_desc" : "changed_desc";
}

export type OffImageQuery = {
  tab: OffImageTab;
  sort: OffImageSort;
  perPage: number;
  offset: number;
  minInteractions: number;
  q: string;
};

export type OffImageItem = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  imageUrl: string;
  interactions: number;
  scans: number;
  registrations: number;
  favorites: number;
  forwards: number;
  addedAt: string;
  reviewedAt: string | null;
  review: OffImageDecision | null;
  // Afviste varer sendes til scan-appens "Skal scannes": none = ikke sendt,
  // pending = venter på en agent, done = scannet.
  scanStatus: "none" | "pending" | "done";
};
