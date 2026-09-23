-- Målsætningsdato (docs/DECISIONS.md, 2026-09-23): den kalenderdato, en
-- målsætning ønskes nået. Nullable, så eksisterende målsætninger bevares.
-- Hand-written, same reason as other recent migrations in this project.

-- AlterTable
ALTER TABLE "goals" ADD COLUMN "targetDate" TIMESTAMP(3);
