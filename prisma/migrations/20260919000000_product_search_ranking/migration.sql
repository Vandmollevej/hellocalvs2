-- Regional product/ingredient search ranking.
-- Stats are aggregate only; no user id or raw query text is stored.

ALTER TABLE "products"
  ADD COLUMN "originCountryCode" TEXT;

CREATE TABLE "product_region_search_stats" (
  "productId" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "searchCount" INTEGER NOT NULL DEFAULT 0,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "lastSearchedAt" TIMESTAMP(3),
  "lastClickedAt" TIMESTAMP(3),
  CONSTRAINT "product_region_search_stats_pkey" PRIMARY KEY ("productId", "region"),
  CONSTRAINT "product_region_search_stats_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "product_region_search_stats_region_searchCount_idx"
  ON "product_region_search_stats"("region", "searchCount");

CREATE INDEX "product_region_search_stats_region_clickCount_idx"
  ON "product_region_search_stats"("region", "clickCount");

CREATE TABLE "product_region_hour_stats" (
  "productId" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "hour" INTEGER NOT NULL,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "lastClickedAt" TIMESTAMP(3),
  CONSTRAINT "product_region_hour_stats_pkey" PRIMARY KEY ("productId", "region", "hour"),
  CONSTRAINT "product_region_hour_stats_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_region_hour_stats_hour_check" CHECK ("hour" BETWEEN 0 AND 23)
);

CREATE INDEX "product_region_hour_stats_region_hour_clickCount_idx"
  ON "product_region_hour_stats"("region", "hour", "clickCount");

CREATE TABLE "ingredient_region_search_stats" (
  "ingredientId" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "searchCount" INTEGER NOT NULL DEFAULT 0,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "lastSearchedAt" TIMESTAMP(3),
  "lastClickedAt" TIMESTAMP(3),
  CONSTRAINT "ingredient_region_search_stats_pkey" PRIMARY KEY ("ingredientId", "region"),
  CONSTRAINT "ingredient_region_search_stats_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ingredient_region_search_stats_region_searchCount_idx"
  ON "ingredient_region_search_stats"("region", "searchCount");

CREATE INDEX "ingredient_region_search_stats_region_clickCount_idx"
  ON "ingredient_region_search_stats"("region", "clickCount");

CREATE TABLE "ingredient_region_hour_stats" (
  "ingredientId" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "hour" INTEGER NOT NULL,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "lastClickedAt" TIMESTAMP(3),
  CONSTRAINT "ingredient_region_hour_stats_pkey" PRIMARY KEY ("ingredientId", "region", "hour"),
  CONSTRAINT "ingredient_region_hour_stats_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ingredient_region_hour_stats_hour_check" CHECK ("hour" BETWEEN 0 AND 23)
);

CREATE INDEX "ingredient_region_hour_stats_region_hour_clickCount_idx"
  ON "ingredient_region_hour_stats"("region", "hour", "clickCount");
