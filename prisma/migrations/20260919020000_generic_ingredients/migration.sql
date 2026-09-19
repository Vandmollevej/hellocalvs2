-- Generiske, ikke-scannede ingredienser (grønt/frugt/kød uden brand/emballage)
-- som egen tabel, adskilt fra products og den eksisterende ingredients-tabel
-- (kun HelloFresh-billedcache) — se docs/DECISIONS.md 2026-09-19. Hand-written,
-- same reason as other recent migrations in this project — no local
-- PostgreSQL reachable from this workstation to run `prisma migrate dev`.

-- CreateEnum
CREATE TYPE "GenericIngredientCategory" AS ENUM ('FRUIT', 'VEGETABLE', 'MEAT', 'OTHER');

-- CreateTable
CREATE TABLE "generic_ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "GenericIngredientCategory" NOT NULL DEFAULT 'OTHER',
    "imageUrl" TEXT,
    "fridaProductId" TEXT,
    "kcalPer100g" DOUBLE PRECISION,
    "proteinPer100g" DOUBLE PRECISION,
    "carbsPer100g" DOUBLE PRECISION,
    "fatPer100g" DOUBLE PRECISION,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generic_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generic_ingredient_region_search_stats" (
    "ingredientId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastSearchedAt" TIMESTAMP(3),
    "lastClickedAt" TIMESTAMP(3),

    CONSTRAINT "generic_ingredient_region_search_stats_pkey" PRIMARY KEY ("ingredientId","region")
);

-- CreateIndex
CREATE INDEX "generic_ingredient_region_search_stats_region_searchCount_idx" ON "generic_ingredient_region_search_stats"("region", "searchCount");

-- CreateIndex
CREATE INDEX "generic_ingredient_region_search_stats_region_clickCount_idx" ON "generic_ingredient_region_search_stats"("region", "clickCount");

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN "genericIngredientId" TEXT;

-- AddForeignKey
ALTER TABLE "generic_ingredients" ADD CONSTRAINT "generic_ingredients_fridaProductId_fkey" FOREIGN KEY ("fridaProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generic_ingredients" ADD CONSTRAINT "generic_ingredients_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generic_ingredient_region_search_stats" ADD CONSTRAINT "generic_ingredient_region_search_stats_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "generic_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_genericIngredientId_fkey" FOREIGN KEY ("genericIngredientId") REFERENCES "generic_ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
