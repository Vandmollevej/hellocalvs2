-- Usikkerheds-~ + admin "Uncertainties" (docs/DECISIONS.md 2026-09-24).
-- Hand-written, same reason as other recent migrations in this project — no
-- local PostgreSQL reachable from this workstation to run `prisma migrate dev`.
ALTER TABLE "products" ADD COLUMN "micronutrientsPer100g" JSONB;
ALTER TABLE "products" ADD COLUMN "nutrientSources" JSONB;
ALTER TABLE "products" ADD COLUMN "nutrientTolerances" JSONB;

ALTER TABLE "generic_ingredients" ADD COLUMN "micronutrientsPer100g" JSONB;

ALTER TABLE "ai_product_analyses" ADD COLUMN "regions" JSONB;
