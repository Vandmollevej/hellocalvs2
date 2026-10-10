-- Måltidskasse-integrationer (docs/DECISIONS.md 2026-10-10): RetNemt og
-- BetterFeast som retkilder ved siden af HelloFresh, og brugerens valg af
-- udbydere under Integrationer (afløser det tabte helloFreshEnabled-flag).
ALTER TYPE "ExternalProductSource" ADD VALUE IF NOT EXISTS 'RETNEMT';
ALTER TYPE "ExternalProductSource" ADD VALUE IF NOT EXISTS 'BETTERFEAST';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "recipeProviders" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Admin → Retter "Deaktivér" satte en overgang status = REJECTED, som Retter-
-- listen ikke filtrerer på. Deaktivering er Product.discontinued
-- (docs/DECISIONS.md 2026-10-07); de retter flyttes over.
UPDATE "products" SET "discontinued" = true, "status" = 'APPROVED'
WHERE "externalSource" = 'HELLOFRESH' AND "status" = 'REJECTED';
