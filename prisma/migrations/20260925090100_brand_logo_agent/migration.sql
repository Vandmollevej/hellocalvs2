-- Logo-robot (scripts/logo-agent): natlig logosøgning via Google Vision og
-- admin-kø for kandidater under 90 %. Genereret med `prisma migrate diff`.
-- CreateEnum
CREATE TYPE "BrandLogoSearchStatus" AS ENUM ('PENDING_REVIEW', 'AUTO_ACCEPTED', 'ACCEPTED', 'NO_CANDIDATES');

-- CreateTable
CREATE TABLE "brand_logo_searches" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sourceProductId" TEXT,
    "originalUrl" TEXT NOT NULL,
    "status" "BrandLogoSearchStatus" NOT NULL,
    "bestConfidence" DOUBLE PRECISION,
    "chosenCandidateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "brand_logo_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_logo_candidates" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "pageUrl" TEXT,
    "pageTitle" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "brandInPage" BOOLEAN NOT NULL DEFAULT false,
    "transparent" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_logo_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_logo_searches_status_createdAt_idx" ON "brand_logo_searches"("status", "createdAt");

-- CreateIndex
CREATE INDEX "brand_logo_searches_brandId_idx" ON "brand_logo_searches"("brandId");

-- CreateIndex
CREATE INDEX "brand_logo_candidates_searchId_confidence_idx" ON "brand_logo_candidates"("searchId", "confidence");

-- AddForeignKey
ALTER TABLE "brand_logo_searches" ADD CONSTRAINT "brand_logo_searches_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_logo_candidates" ADD CONSTRAINT "brand_logo_candidates_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "brand_logo_searches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

