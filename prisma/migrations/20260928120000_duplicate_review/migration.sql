-- AlterTable
ALTER TABLE "products" ADD COLUMN     "imagesReviewedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "product_source_records" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" "ExternalProductSource" NOT NULL,
    "data" JSONB NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_source_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_source_records_reviewedAt_idx" ON "product_source_records"("reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_source_records_productId_source_key" ON "product_source_records"("productId", "source");

-- AddForeignKey
ALTER TABLE "product_source_records" ADD CONSTRAINT "product_source_records_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
