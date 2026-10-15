-- Originale produktbilleder online før fritlægning (docs/DECISIONS.md 2026-10-15).
ALTER TABLE "image_cutout_jobs" ADD COLUMN "webSearchedAt" TIMESTAMP(3);

CREATE TABLE "product_image_searches" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "cutoutJobId" TEXT,
  "originalUrl" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "bestConfidence" DOUBLE PRECISION,
  "chosenCandidateId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "product_image_searches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_image_searches_status_createdAt_idx" ON "product_image_searches"("status", "createdAt");
CREATE INDEX "product_image_searches_productId_idx" ON "product_image_searches"("productId");
ALTER TABLE "product_image_searches" ADD CONSTRAINT "product_image_searches_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "product_image_candidates" (
  "id" TEXT NOT NULL,
  "searchId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "pageUrl" TEXT,
  "pageTitle" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL,
  "transparent" BOOLEAN NOT NULL DEFAULT false,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_image_candidates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_image_candidates_searchId_confidence_idx" ON "product_image_candidates"("searchId", "confidence");
ALTER TABLE "product_image_candidates" ADD CONSTRAINT "product_image_candidates_searchId_fkey"
  FOREIGN KEY ("searchId") REFERENCES "product_image_searches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
