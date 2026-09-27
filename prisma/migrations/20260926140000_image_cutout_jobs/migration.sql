-- Fritskrabning af logo + produktforside fra det guidede kamera-flow
-- (docs/DECISIONS.md 2026-09-26). Behandles af scripts/image-agent.

-- CreateEnum
CREATE TYPE "ImageCutoutKind" AS ENUM ('BRAND_LOGO', 'PRODUCT_FRONT');

-- CreateEnum
CREATE TYPE "ImageCutoutStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "image_cutout_jobs" (
    "id" TEXT NOT NULL,
    "kind" "ImageCutoutKind" NOT NULL,
    "status" "ImageCutoutStatus" NOT NULL DEFAULT 'PENDING',
    "sourceUrl" TEXT NOT NULL,
    "cropBox" JSONB,
    "resultUrl" TEXT,
    "error" TEXT,
    "recognizedText" TEXT,
    "confidence" DOUBLE PRECISION,
    "matchScore" DOUBLE PRECISION,
    "brandId" TEXT,
    "productId" TEXT,
    "analysisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "image_cutout_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "image_cutout_jobs_status_createdAt_idx" ON "image_cutout_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "image_cutout_jobs_brandId_idx" ON "image_cutout_jobs"("brandId");

-- CreateIndex
CREATE INDEX "image_cutout_jobs_analysisId_idx" ON "image_cutout_jobs"("analysisId");

-- AddForeignKey
ALTER TABLE "image_cutout_jobs" ADD CONSTRAINT "image_cutout_jobs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_cutout_jobs" ADD CONSTRAINT "image_cutout_jobs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_cutout_jobs" ADD CONSTRAINT "image_cutout_jobs_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "ai_product_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
