-- 2-års kvalitetstjek (docs/DECISIONS.md 2026-10-15)
ALTER TABLE "products" ADD COLUMN "qualityCheckedAt" TIMESTAMP(3);

CREATE TYPE "ProductRecheckStatus" AS ENUM ('SUBMITTED', 'NO_CHANGE', 'AWAITING_ADMIN', 'APPROVED', 'DONE', 'FAILED');

CREATE TABLE "product_rechecks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ProductRecheckStatus" NOT NULL DEFAULT 'SUBMITTED',
    "marketRegion" TEXT NOT NULL DEFAULT 'DK',
    "signals" JSONB,
    "frontPhotoUrl" TEXT NOT NULL,
    "nutritionPhotoUrl" TEXT,
    "ingredientsPhotoUrl" TEXT,
    "nutritionOcrText" TEXT,
    "nutritionOcrConfidence" DOUBLE PRECISION,
    "ingredientsOcrText" TEXT,
    "ingredientsOcrConfidence" DOUBLE PRECISION,
    "originalImageUrl" TEXT,
    "original" JSONB NOT NULL,
    "analyzedAt" TIMESTAMP(3),
    "imageChanged" BOOLEAN,
    "imageNote" TEXT,
    "readValues" JSONB,
    "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "useNewImage" BOOLEAN,
    "useNewData" BOOLEAN,
    "cutoutJobId" TEXT,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "product_rechecks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_rechecks_status_createdAt_idx" ON "product_rechecks"("status", "createdAt");
CREATE INDEX "product_rechecks_productId_idx" ON "product_rechecks"("productId");

ALTER TABLE "product_rechecks" ADD CONSTRAINT "product_rechecks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
