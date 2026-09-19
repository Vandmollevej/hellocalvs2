-- Søgealgoritmer admin page: tunable ranking weights (with commit/backup
-- history), region-scoped brand popularity, and personal per-user
-- search/click history (explicit user decision, see docs/DECISIONS.md
-- 2026-09-19 — overrides the earlier "aggregate/anonymous-only" principle).

CREATE TABLE "search_ranking_configs" (
  "id" TEXT NOT NULL,
  "weights" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "search_ranking_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "search_ranking_configs_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "search_ranking_configs_isActive_idx" ON "search_ranking_configs"("isActive");

CREATE TABLE "brand_region_search_stats" (
  "brandId" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "searchCount" INTEGER NOT NULL DEFAULT 0,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "lastSearchedAt" TIMESTAMP(3),
  "lastClickedAt" TIMESTAMP(3),
  CONSTRAINT "brand_region_search_stats_pkey" PRIMARY KEY ("brandId", "region"),
  CONSTRAINT "brand_region_search_stats_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "brand_region_search_stats_region_searchCount_idx"
  ON "brand_region_search_stats"("region", "searchCount");

CREATE INDEX "brand_region_search_stats_region_clickCount_idx"
  ON "brand_region_search_stats"("region", "clickCount");

CREATE TABLE "user_product_search_history" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT,
  "ingredientId" TEXT,
  "genericIngredientId" TEXT,
  "searchCount" INTEGER NOT NULL DEFAULT 0,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "lastSearchedAt" TIMESTAMP(3),
  "lastClickedAt" TIMESTAMP(3),
  CONSTRAINT "user_product_search_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_product_search_history_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_product_search_history_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_product_search_history_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_product_search_history_genericIngredientId_fkey"
    FOREIGN KEY ("genericIngredientId") REFERENCES "generic_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_product_search_history_userId_productId_key"
  ON "user_product_search_history"("userId", "productId");

CREATE UNIQUE INDEX "user_product_search_history_userId_ingredientId_key"
  ON "user_product_search_history"("userId", "ingredientId");

CREATE UNIQUE INDEX "user_product_search_history_userId_genericIngredientId_key"
  ON "user_product_search_history"("userId", "genericIngredientId");

CREATE INDEX "user_product_search_history_userId_clickCount_idx"
  ON "user_product_search_history"("userId", "clickCount");
