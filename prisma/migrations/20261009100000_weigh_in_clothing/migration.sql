-- CreateEnum
CREATE TYPE "WeighInClothing" AS ENUM ('NAKED', 'CLOTHES', 'FULLY_DRESSED');

-- AlterTable
ALTER TABLE "weight_entries" ADD COLUMN "clothing" "WeighInClothing";

-- CreateIndex
CREATE INDEX "weight_entries_userId_weighedAt_idx" ON "weight_entries"("userId", "weighedAt");
