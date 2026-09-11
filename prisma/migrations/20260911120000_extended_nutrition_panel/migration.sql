-- MyFitnessPal-style extended nutrition panel (2026-09-11): adds the fat
-- breakdown (saturated/unsaturated/trans), cholesterol, and vitamin A/C to
-- the fixed per-100g nutrition fields on "products", matching snapshot
-- columns on "registrations" so historical registrations aren't affected by
-- later product edits (same snapshot principle as every other nutrition
-- field), and a user-level toggle to show them (off by default, see
-- design.md). All nullable — most existing products have no source for
-- these yet (only Open Food Facts imports populate them, see
-- src/lib/openFoodFacts.ts).
ALTER TABLE "products"
  ADD COLUMN "saturatedFatPer100g"   DOUBLE PRECISION,
  ADD COLUMN "unsaturatedFatPer100g" DOUBLE PRECISION,
  ADD COLUMN "transFatPer100g"       DOUBLE PRECISION,
  ADD COLUMN "cholesterolPer100g"    DOUBLE PRECISION,
  ADD COLUMN "vitaminAPer100g"       DOUBLE PRECISION,
  ADD COLUMN "vitaminCPer100g"       DOUBLE PRECISION;

ALTER TABLE "registrations"
  ADD COLUMN "saturatedFatSnapshot"   DOUBLE PRECISION,
  ADD COLUMN "unsaturatedFatSnapshot" DOUBLE PRECISION,
  ADD COLUMN "transFatSnapshot"       DOUBLE PRECISION,
  ADD COLUMN "cholesterolSnapshot"    DOUBLE PRECISION,
  ADD COLUMN "vitaminASnapshot"       DOUBLE PRECISION,
  ADD COLUMN "vitaminCSnapshot"       DOUBLE PRECISION;

ALTER TABLE "users"
  ADD COLUMN "showExtendedNutrition" BOOLEAN NOT NULL DEFAULT false;
