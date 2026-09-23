-- Support-side med tidsbegrænset, brugerstyret dataadgang + normaliserede
-- produkt-søgeparametre (fiber-%, sukker-%, salt-%, fuldkorn), se
-- docs/DECISIONS.md 2026-09-23. Hand-written, same reason as other recent
-- migrations in this project (no local PostgreSQL on the workstation).

-- CreateEnum
CREATE TYPE "SupportRequestCategory" AS ENUM ('ACCOUNT', 'DATA', 'PRODUCTS', 'PAYMENT', 'BUG', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ProductFeatureSource" AS ENUM ('MANUAL', 'PACKAGE_PERCENT', 'NUTRITION_LABEL', 'MANUFACTURER', 'EXTERNAL_DATABASE', 'DERIVED', 'AI_INTERPRETATION');

-- CreateTable
CREATE TABLE "support_access_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "permissions" JSONB NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "SupportRequestCategory" NOT NULL DEFAULT 'OTHER',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "supportGrantId" TEXT,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_nutrition_features" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "basis" TEXT,
    "sugarsPer100g" DOUBLE PRECISION,
    "sugarPercent" DOUBLE PRECISION,
    "sugarSource" "ProductFeatureSource",
    "sugarConfidence" DOUBLE PRECISION,
    "fiberPer100g" DOUBLE PRECISION,
    "fiberPercent" DOUBLE PRECISION,
    "fiberSource" "ProductFeatureSource",
    "fiberConfidence" DOUBLE PRECISION,
    "saltPer100g" DOUBLE PRECISION,
    "saltPercent" DOUBLE PRECISION,
    "saltSource" "ProductFeatureSource",
    "saltConfidence" DOUBLE PRECISION,
    "wholeGrainPercent" DOUBLE PRECISION,
    "isWholeGrain" BOOLEAN,
    "wholeGrainSource" "ProductFeatureSource",
    "wholeGrainConfidence" DOUBLE PRECISION,
    "wholeGrainEvidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_nutrition_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_access_grants_userId_revokedAt_idx" ON "support_access_grants"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "support_access_grants_validUntil_idx" ON "support_access_grants"("validUntil");

-- CreateIndex
CREATE INDEX "support_requests_status_createdAt_idx" ON "support_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "support_requests_userId_idx" ON "support_requests"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "product_nutrition_features_productId_key" ON "product_nutrition_features"("productId");

-- CreateIndex
CREATE INDEX "product_nutrition_features_sugarsPer100g_idx" ON "product_nutrition_features"("sugarsPer100g");

-- CreateIndex
CREATE INDEX "product_nutrition_features_sugarPercent_idx" ON "product_nutrition_features"("sugarPercent");

-- CreateIndex
CREATE INDEX "product_nutrition_features_fiberPer100g_idx" ON "product_nutrition_features"("fiberPer100g");

-- CreateIndex
CREATE INDEX "product_nutrition_features_fiberPercent_idx" ON "product_nutrition_features"("fiberPercent");

-- CreateIndex
CREATE INDEX "product_nutrition_features_saltPer100g_idx" ON "product_nutrition_features"("saltPer100g");

-- CreateIndex
CREATE INDEX "product_nutrition_features_wholeGrainPercent_idx" ON "product_nutrition_features"("wholeGrainPercent");

-- CreateIndex
CREATE INDEX "product_nutrition_features_isWholeGrain_idx" ON "product_nutrition_features"("isWholeGrain");

-- AddForeignKey
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_supportGrantId_fkey" FOREIGN KEY ("supportGrantId") REFERENCES "support_access_grants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_nutrition_features" ADD CONSTRAINT "product_nutrition_features_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
