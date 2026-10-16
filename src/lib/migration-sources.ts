// Apps, man kan flytte sine data fra (docs/DECISIONS.md 2026-10-15). `slug` er
// sidens adresse (/settings/import/[provider]); `value` er MigrationImport.source.
// Når brugeren har valgt appen, kender aflæsningen også dens opsætning.
export type MigrationSourceValue = "MYFITNESSPAL" | "LIFESUM";

export type MigrationSource = { slug: string; value: MigrationSourceValue; label: string };

export const MIGRATION_SOURCES: MigrationSource[] = [
  { slug: "myfitnesspal", value: "MYFITNESSPAL", label: "MyFitnessPal" },
  { slug: "lifesum", value: "LIFESUM", label: "Lifesum" },
];

export function migrationSourceBySlug(slug: string | undefined | null): MigrationSource | null {
  return MIGRATION_SOURCES.find((source) => source.slug === slug) ?? null;
}
