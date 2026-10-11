-- Admin: sletning af varer og retter er blød (docs/DECISIONS.md 2026-10-11).
-- Rækken beholdes med deletedAt, så den kan findes under "Slettede" og
-- gendannes; status/discontinued sættes samtidig, så søgningen udelader den.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "shared_recipes" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- HelloFresh navngiver selv udgåede opskrifter "(Brug 126228 i stedet) …" eller
-- "(Brug 121446) …": det er HelloFreshs egne dubletter af en erstatningsopskrift
-- og skal ikke vises for brugerne. De deaktiveres (kan aktiveres igen i admin);
-- importen springer dem over fra nu af.
UPDATE "products" SET "discontinued" = true
WHERE "externalSource"::text IN ('HELLOFRESH', 'RETNEMT', 'BETTERFEAST', 'VALDEMARSRO')
  AND "name" ~ '^\(Brug [0-9]+';
