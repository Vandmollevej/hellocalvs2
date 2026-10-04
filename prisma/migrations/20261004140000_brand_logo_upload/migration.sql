-- Admin → Varedatabase → Logo-upload: logoer trækkes ind med drag and drop.
-- Hvert slip er et parti (batch) med tidsstempel, så et helt parti kan slettes
-- igen; hver fil gemmer sin proces (steps) og målene før/efter behandling.
-- CreateEnum
CREATE TYPE "BrandLogoUploadStatus" AS ENUM ('DONE', 'UNMATCHED', 'FAILED');

-- CreateTable
CREATE TABLE "brand_logo_upload_batches" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "brand_logo_upload_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_logo_uploads" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "BrandLogoUploadStatus" NOT NULL,
    "brandId" TEXT,
    "imageUrl" TEXT,
    "previousLogoUrl" TEXT,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "originalWidth" INTEGER,
    "originalHeight" INTEGER,
    "originalBytes" INTEGER,
    "originalType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "steps" JSONB NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_logo_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_logo_upload_batches_createdAt_idx" ON "brand_logo_upload_batches"("createdAt");

-- CreateIndex
CREATE INDEX "brand_logo_uploads_batchId_idx" ON "brand_logo_uploads"("batchId");

-- CreateIndex
CREATE INDEX "brand_logo_uploads_brandId_idx" ON "brand_logo_uploads"("brandId");

-- AddForeignKey
ALTER TABLE "brand_logo_uploads" ADD CONSTRAINT "brand_logo_uploads_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "brand_logo_upload_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_logo_uploads" ADD CONSTRAINT "brand_logo_uploads_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
