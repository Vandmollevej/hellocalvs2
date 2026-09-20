-- Kvalitetskontrol / billed-match (docs/DECISIONS.md, 2026-09-19).
-- Hand-written, same reason as other recent migrations in this project — no
-- local PostgreSQL reachable from this workstation to run `prisma migrate dev`.

-- AlterEnum: add BARCODE to the existing AiAnalysisKind enum.
ALTER TYPE "AiAnalysisKind" ADD VALUE 'BARCODE';

-- AlterEnum: add QUALITY_CONTROL_PHOTO to the existing PointsReason enum.
ALTER TYPE "PointsReason" ADD VALUE 'QUALITY_CONTROL_PHOTO';

-- CreateEnum
CREATE TYPE "MatchCheckStatus" AS ENUM ('PENDING', 'REVIEWED');
CREATE TYPE "MatchVerdict" AS ENUM ('CORRECT', 'WRONG', 'UNCERTAIN');
CREATE TYPE "AwardStatus" AS ENUM ('OPEN', 'SUBMITTED', 'RESOLVED');

-- AlterTable: persist the guided-flow photo itself (previously only sent
-- transiently to OpenAI Vision, never saved anywhere — see the model comment
-- in prisma/schema.prisma).
ALTER TABLE "ai_product_analyses" ADD COLUMN "image_url" TEXT;

-- CreateTable
CREATE TABLE "product_match_checks" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "photoType" "AiAnalysisKind" NOT NULL,
  "visualScore" DOUBLE PRECISION,
  "colorScore" DOUBLE PRECISION,
  "structuralScore" DOUBLE PRECISION,
  "confidence" DOUBLE PRECISION,
  "status" "MatchCheckStatus" NOT NULL DEFAULT 'PENDING',
  "adminVerdict" "MatchVerdict",
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_match_checks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_match_checks_analysisId_key" ON "product_match_checks"("analysisId");
CREATE INDEX "product_match_checks_productId_status_idx" ON "product_match_checks"("productId", "status");
CREATE INDEX "product_match_checks_status_confidence_idx" ON "product_match_checks"("status", "confidence");

ALTER TABLE "product_match_checks"
  ADD CONSTRAINT "product_match_checks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "product_match_checks_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "ai_product_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "product_photo_awards" (
  "id" TEXT NOT NULL,
  "matchCheckId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "photoType" "AiAnalysisKind" NOT NULL,
  "points" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "status" "AwardStatus" NOT NULL DEFAULT 'OPEN',
  "submittedImageUrl" TEXT,
  "submittedByUserId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_photo_awards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_photo_awards_matchCheckId_key" ON "product_photo_awards"("matchCheckId");
CREATE INDEX "product_photo_awards_productId_enabled_status_idx" ON "product_photo_awards"("productId", "enabled", "status");

ALTER TABLE "product_photo_awards"
  ADD CONSTRAINT "product_photo_awards_matchCheckId_fkey" FOREIGN KEY ("matchCheckId") REFERENCES "product_match_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "product_photo_awards_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
