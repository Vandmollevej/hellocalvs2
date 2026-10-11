-- Open Food Facts-kontrol (docs/DECISIONS.md 2026-10-11): kvalitetsvurdering pr.
-- Open Food Facts-vare + "send til scan-appen".
-- CreateTable
CREATE TABLE "product_quality_reviews" (
    "productId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rating" TEXT NOT NULL,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "findings" JSONB NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanRequestedAt" TIMESTAMP(3),
    "scanRequestedByAdminId" TEXT,
    "scanDoneAt" TIMESTAMP(3),
    "scanDoneByWorkerId" TEXT,

    CONSTRAINT "product_quality_reviews_pkey" PRIMARY KEY ("productId")
);

-- CreateIndex
CREATE INDEX "product_quality_reviews_rating_score_idx" ON "product_quality_reviews"("rating", "score");

-- CreateIndex
CREATE INDEX "product_quality_reviews_scanRequestedAt_scanDoneAt_idx" ON "product_quality_reviews"("scanRequestedAt", "scanDoneAt");

-- AddForeignKey
ALTER TABLE "product_quality_reviews" ADD CONSTRAINT "product_quality_reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
