-- Adds the missing time-of-day counter for GenericIngredient, matching the
-- existing ProductRegionHourStat/IngredientRegionHourStat pattern
-- (docs/DECISIONS.md 2026-09-19) — hand-written, no local PostgreSQL
-- reachable from this workstation, same as other recent migrations.

-- CreateTable
CREATE TABLE "generic_ingredient_region_hour_stats" (
    "ingredientId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),

    CONSTRAINT "generic_ingredient_region_hour_stats_pkey" PRIMARY KEY ("ingredientId","region","hour")
);

-- CreateIndex
CREATE INDEX "generic_ingredient_region_hour_stats_region_hour_clickCount_idx" ON "generic_ingredient_region_hour_stats"("region", "hour", "clickCount");

-- AddForeignKey
ALTER TABLE "generic_ingredient_region_hour_stats" ADD CONSTRAINT "generic_ingredient_region_hour_stats_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "generic_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
