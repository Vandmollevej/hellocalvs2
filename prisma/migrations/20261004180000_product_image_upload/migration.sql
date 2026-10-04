-- Admin → Varedatabase → Billed-upload: produktbilleder trækkes ind med drag
-- and drop (filnavn = EAN eller produkttype, evt. _raw / _pl). Findes der
-- allerede et billede, ligger det nye i status CONFLICT, til admin vælger
-- Ignorer / Erstat. Hvert slip er et parti med tidsstempel.
-- CreateEnum
CREATE TYPE "ProductImageUploadStatus" AS ENUM ('APPLIED', 'CONFLICT', 'IGNORED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "product_image_upload_batches" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "product_image_upload_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_image_uploads" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ProductImageUploadStatus" NOT NULL,
    "key" TEXT,
    "keyKind" TEXT,
    "role" TEXT,
    "imageUrl" TEXT,
    "hasAlpha" BOOLEAN NOT NULL DEFAULT false,
    "originalWidth" INTEGER,
    "originalHeight" INTEGER,
    "originalBytes" INTEGER,
    "originalType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "targets" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "message" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_image_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_image_upload_batches_createdAt_idx" ON "product_image_upload_batches"("createdAt");

-- CreateIndex
CREATE INDEX "product_image_uploads_batchId_idx" ON "product_image_uploads"("batchId");

-- CreateIndex
CREATE INDEX "product_image_uploads_status_createdAt_idx" ON "product_image_uploads"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "product_image_uploads" ADD CONSTRAINT "product_image_uploads_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "product_image_upload_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
