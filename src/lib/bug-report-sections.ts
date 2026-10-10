// Fejlrapportens sektioner (docs/DECISIONS.md 2026-09-28): en rapport fra et
// produkts "Indberet fejl"-link opdeles i de dele af varen, der er forkerte,
// så admin kan se præcis hvad der skal rettes. Delt mellem klient og API.

export const BUG_REPORT_SECTIONS = [
  { key: "IMAGE", label: "Billede" },
  { key: "TITLE", label: "Titel / varetype" },
  { key: "ENERGY", label: "Energifordeling" },
  { key: "INGREDIENTS", label: "Ingredienser" },
  { key: "CERTIFICATES", label: "Certifikater" },
  { key: "OTHER", label: "Øvrige varedata" },
] as const;

export type BugReportSectionKey = (typeof BUG_REPORT_SECTIONS)[number]["key"];
export type BugReportSections = Partial<Record<BugReportSectionKey, string>>;
/** Foto pr. sektion: gemt sti (eller data-URL, mens klienten sender det). */
export type BugReportPhotos = Partial<Record<BugReportSectionKey, string>>;

/** Tekst til en sektion, der kun har et foto og ingen note. */
export const PHOTO_ONLY_TEXT = "Se vedhæftet foto";

/** Sektioner med foto men uden note får en kort tekst, så fotoet ikke går tabt. */
export function withPhotoOnlySections(
  sections: BugReportSections | null,
  photos: BugReportPhotos | null
): BugReportSections | null {
  if (!photos) return sections;
  const result: BugReportSections = { ...(sections ?? {}) };
  for (const key of Object.keys(photos) as BugReportSectionKey[]) {
    if (!result[key]) result[key] = PHOTO_ONLY_TEXT;
  }
  return result;
}

const SECTION_KEYS = BUG_REPORT_SECTIONS.map((s) => s.key) as string[];
const MAX_SECTION_LENGTH = 2000;

// Sektion → eksisterende kategori, så admin-filtrering på kategorier virker.
const SECTION_CATEGORY: Partial<Record<BugReportSectionKey, "PRODUCT_IMAGE" | "ENERGY" | "CONTENT">> = {
  IMAGE: "PRODUCT_IMAGE",
  ENERGY: "ENERGY",
  INGREDIENTS: "CONTENT",
};

/** Keeps only known section keys with non-empty text; null when none. */
export function parseSections(value: unknown): BugReportSections | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: BugReportSections = {};
  for (const [key, text] of Object.entries(value as Record<string, unknown>)) {
    if (!SECTION_KEYS.includes(key) || typeof text !== "string") continue;
    const trimmed = text.trim().slice(0, MAX_SECTION_LENGTH);
    if (trimmed) result[key as BugReportSectionKey] = trimmed;
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** Plain-text description built from the sections, in display order. */
export function describeSections(sections: BugReportSections): string {
  return BUG_REPORT_SECTIONS.filter((s) => sections[s.key])
    .map((s) => `${s.label}: ${sections[s.key]}`)
    .join("\n\n");
}

export function categoriesForSections(sections: BugReportSections): ("PRODUCT_IMAGE" | "ENERGY" | "CONTENT")[] {
  const categories = new Set<"PRODUCT_IMAGE" | "ENERGY" | "CONTENT">();
  for (const key of Object.keys(sections) as BugReportSectionKey[]) {
    const category = SECTION_CATEGORY[key];
    if (category) categories.add(category);
  }
  return [...categories];
}
