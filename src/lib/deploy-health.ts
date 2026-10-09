import { prisma } from "@/lib/prisma";

// Driftstjek til /api/health og admin-forsiden (docs/DECISIONS.md 2026-10-07
// "Sikring mod fejlede migreringer"). En fejlet migrering lå ubemærket i 17
// timer, fordi health kun lavede SELECT 1.

/**
 * Henter én (ikke-eksisterende) bruger med alle kolonner. Mangler en kolonne,
 * som koden forventer (ny kode mod gammel database), kaster Prisma P2022 her
 * — så den nye container aldrig bliver sund og udrulningen afbrydes.
 */
export async function checkUserSchema(): Promise<void> {
  await prisma.user.findFirst({ where: { id: "__health_check__" } });
}

/** Migreringer, der er startet men hverken gennemført eller rullet tilbage (P3009 blokerer alle senere deploys). */
export async function loadFailedMigrations(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM _prisma_migrations
    WHERE finished_at IS NULL AND rolled_back_at IS NULL
    ORDER BY started_at`;
  return rows.map((row) => row.migration_name);
}
