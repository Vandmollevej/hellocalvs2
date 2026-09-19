-- Metatags on individual images ("Multiple" = shows several items, e.g.
-- several apples; "Raw" = unprepared/fresh, e.g. raw meat) — see
-- docs/DECISIONS.md 2026-09-19 (image variant tags). Hand-written, same
-- reason as other recent migrations in this project — no local PostgreSQL
-- reachable from this workstation to run `prisma migrate dev`.

-- AlterTable
ALTER TABLE "product_images" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ingredient_images" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredient_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingredient_images_ingredientId_idx" ON "ingredient_images"("ingredientId");

-- AddForeignKey
ALTER TABLE "ingredient_images" ADD CONSTRAINT "ingredient_images_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "generic_ingredient_images" (
    "id" TEXT NOT NULL,
    "genericIngredientId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generic_ingredient_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generic_ingredient_images_genericIngredientId_idx" ON "generic_ingredient_images"("genericIngredientId");

-- AddForeignKey
ALTER TABLE "generic_ingredient_images" ADD CONSTRAINT "generic_ingredient_images_genericIngredientId_fkey" FOREIGN KEY ("genericIngredientId") REFERENCES "generic_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
