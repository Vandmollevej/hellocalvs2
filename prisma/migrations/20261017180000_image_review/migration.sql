CREATE TYPE "ImageReviewStatus" AS ENUM ('PENDING', 'EXISTING', 'UNMATCHED', 'ACCEPTED', 'REJECTED');

CREATE TABLE "image_reviews" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "barcode" TEXT,
    "fileName" TEXT NOT NULL,
    "processedUrl" TEXT NOT NULL,
    "originalUrl" TEXT,
    "status" "ImageReviewStatus" NOT NULL DEFAULT 'PENDING',
    "batchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "image_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "image_reviews_status_createdAt_idx" ON "image_reviews"("status", "createdAt");
CREATE INDEX "image_reviews_productId_idx" ON "image_reviews"("productId");
CREATE INDEX "image_reviews_barcode_idx" ON "image_reviews"("barcode");

CREATE TABLE "image_review_logs" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "image_review_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "image_review_logs_scope_createdAt_idx" ON "image_review_logs"("scope", "createdAt");