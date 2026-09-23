-- Brugerindberettede ændringer af næringsindhold (docs/DECISIONS.md, 2026-09-23).
-- Hand-written, same reason as other recent migrations in this project.

-- CreateEnum
CREATE TYPE "FoodChangeSource" AS ENUM ('USER_EDIT');

-- CreateEnum
CREATE TYPE "NutritionReportStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "product_nutrition_reports" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "replyInboxId" TEXT,
    "source" "FoodChangeSource" NOT NULL DEFAULT 'USER_EDIT',
    "amountGrams" DOUBLE PRECISION NOT NULL,
    "changes" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "NutritionReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_nutrition_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_nutrition_reports_productId_status_idx" ON "product_nutrition_reports"("productId", "status");

-- CreateIndex
CREATE INDEX "product_nutrition_reports_status_createdAt_idx" ON "product_nutrition_reports"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "product_nutrition_reports" ADD CONSTRAINT "product_nutrition_reports_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_nutrition_reports" ADD CONSTRAINT "product_nutrition_reports_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
