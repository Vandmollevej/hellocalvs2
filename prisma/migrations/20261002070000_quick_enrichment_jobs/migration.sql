-- "Opret straks": genoptagelig baggrundsaflæsning (docs/DECISIONS.md 2026-10-02).
CREATE TABLE "quick_enrichment_jobs" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "ingredientsRetries" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quick_enrichment_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quick_enrichment_jobs_productId_key" ON "quick_enrichment_jobs"("productId");
CREATE INDEX "quick_enrichment_jobs_finishedAt_startedAt_idx" ON "quick_enrichment_jobs"("finishedAt", "startedAt");

ALTER TABLE "quick_enrichment_jobs"
  ADD CONSTRAINT "quick_enrichment_jobs_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
