-- Frida-skøn (∼) for varer uden energimærkning (docs/DECISIONS.md 2026-10-10).
-- AlterTable
ALTER TABLE "products" ADD COLUMN "fridaEstimateId" TEXT;

-- CreateTable
CREATE TABLE "frida_estimate_reviews" (
    "id" TEXT NOT NULL,
    "reviewKey" TEXT NOT NULL,
    "typeLabel" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "candidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "exampleNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chosenFridaProductId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "frida_estimate_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "frida_estimate_reviews_reviewKey_key" ON "frida_estimate_reviews"("reviewKey");

-- CreateIndex
CREATE INDEX "frida_estimate_reviews_decidedAt_idx" ON "frida_estimate_reviews"("decidedAt");
