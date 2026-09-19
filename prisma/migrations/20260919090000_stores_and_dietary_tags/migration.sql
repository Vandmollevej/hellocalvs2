-- Chain-level store tagging + free-text dietary tags (docs/DECISIONS.md,
-- 2026-09-19). Hand-written, same reason as other recent migrations in this
-- project -- no local PostgreSQL reachable from this workstation to run
-- `prisma migrate dev`.

-- AlterEnum
ALTER TYPE "ExternalProductSource" ADD VALUE 'REMA1000';

-- AlterTable
ALTER TABLE "products" ADD COLUMN "dietaryTags" JSONB;

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_name_key" ON "stores"("name");

-- CreateTable
CREATE TABLE "product_stores" (
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "taggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_stores_pkey" PRIMARY KEY ("productId", "storeId")
);

-- AddForeignKey
ALTER TABLE "product_stores" ADD CONSTRAINT "product_stores_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stores" ADD CONSTRAINT "product_stores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
