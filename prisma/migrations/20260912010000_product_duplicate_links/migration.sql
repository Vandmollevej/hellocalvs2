-- Dobbeltoprettelser: flags two Product rows created with the same
-- normalized name within a short time window (src/lib/product-duplicates.ts)
-- for admin review/merge on /admin/duplicate-products (docs/ADMIN.md).
-- Hand-written, same reason as other recent migrations in this project — no
-- local PostgreSQL reachable from this workstation to run `prisma migrate dev`.

-- CreateEnum
CREATE TYPE "ProductDuplicateLinkStatus" AS ENUM ('PENDING', 'MERGED', 'DISMISSED');

-- CreateTable
CREATE TABLE "product_duplicate_links" (
    "id" TEXT NOT NULL,
    "productAId" TEXT NOT NULL,
    "productBId" TEXT NOT NULL,
    "status" "ProductDuplicateLinkStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "product_duplicate_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_duplicate_links_productAId_productBId_key" ON "product_duplicate_links"("productAId", "productBId");

-- CreateIndex
CREATE INDEX "product_duplicate_links_status_idx" ON "product_duplicate_links"("status");

-- AddForeignKey
ALTER TABLE "product_duplicate_links" ADD CONSTRAINT "product_duplicate_links_productAId_fkey" FOREIGN KEY ("productAId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_duplicate_links" ADD CONSTRAINT "product_duplicate_links_productBId_fkey" FOREIGN KEY ("productBId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
