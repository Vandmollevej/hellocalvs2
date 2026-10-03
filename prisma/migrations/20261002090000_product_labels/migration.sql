-- Mærkater på vareforsiden (docs/DECISIONS.md 2026-10-02).
ALTER TYPE "ImageCutoutKind" ADD VALUE 'PRODUCT_LABEL';

CREATE TYPE "ProductLabelCategory" AS ENUM ('DIET', 'ORGANIC', 'ANIMAL_WELFARE', 'QUALITY', 'SUSTAINABILITY', 'HEALTH', 'ORIGIN', 'OTHER');

ALTER TABLE "products" ADD COLUMN "labelsScannedAt" TIMESTAMP(3);

CREATE TABLE "product_labels" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "text" TEXT,
  "category" "ProductLabelCategory" NOT NULL,
  "box" JSONB,
  "confidence" DOUBLE PRECISION NOT NULL,
  "imageUrl" TEXT,
  "cutoutJobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_labels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_labels_cutoutJobId_key" ON "product_labels"("cutoutJobId");
CREATE UNIQUE INDEX "product_labels_productId_key_key" ON "product_labels"("productId", "key");
CREATE INDEX "product_labels_key_idx" ON "product_labels"("key");

ALTER TABLE "product_labels"
  ADD CONSTRAINT "product_labels_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_labels"
  ADD CONSTRAINT "product_labels_cutoutJobId_fkey"
  FOREIGN KEY ("cutoutJobId") REFERENCES "image_cutout_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
