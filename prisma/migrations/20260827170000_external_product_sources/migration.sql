-- CreateEnum
CREATE TYPE "ExternalProductSource" AS ENUM ('OPEN_FOOD_FACTS', 'USDA');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "externalSource" "ExternalProductSource";
ALTER TABLE "products" ADD COLUMN "externalId" TEXT;
ALTER TABLE "products" ADD COLUMN "sourceCheckedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "products_externalSource_externalId_idx" ON "products"("externalSource", "externalId");
