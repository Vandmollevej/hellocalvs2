-- Varens land (docs/DECISIONS.md 2026-10-15): det land, varen/retten sælges i
-- (HelloFresh fra alle 17 lande). Eksisterende HelloFresh-retter er danske.
ALTER TABLE "products" ADD COLUMN "market" TEXT;
UPDATE "products" SET "market" = 'DK' WHERE "externalSource" = 'HELLOFRESH';
CREATE INDEX "products_externalSource_market_idx" ON "products"("externalSource", "market");
