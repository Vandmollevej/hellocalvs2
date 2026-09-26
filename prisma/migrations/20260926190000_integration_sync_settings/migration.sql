-- Til/fra-valg pr. datatype og push-tidspunkt for integrationer (docs/DECISIONS.md 2026-09-26).
ALTER TABLE "integrations" ADD COLUMN "syncSettings" JSONB;
ALTER TABLE "integrations" ADD COLUMN "lastPushedAt" TIMESTAMP(3);
