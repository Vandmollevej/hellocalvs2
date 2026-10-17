-- Find nyt billede: begge billeder afvist i Billedbehandling (docs/DECISIONS.md 2026-10-17).
ALTER TABLE "products" ADD COLUMN "imageNeedsNew" BOOLEAN NOT NULL DEFAULT false;
