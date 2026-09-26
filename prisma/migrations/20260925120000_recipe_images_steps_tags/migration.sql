-- Billeder, fremgangsmåde og kategorier på egne og delte retter
-- (docs/DECISIONS.md 2026-09-25).
ALTER TABLE "dishes" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "dishes" ADD COLUMN "steps" JSONB;
ALTER TABLE "dishes" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "shared_recipes" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "shared_recipes" ADD COLUMN "steps" JSONB;
ALTER TABLE "shared_recipes" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
