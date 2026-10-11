-- Open Food Facts i egen tabel (2026-10-11): OFF's rå svar + navnet opdelt i vores felter + sikkerhed.
CREATE TABLE "off_products" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "productId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SCAN',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offModifiedAt" TIMESTAMP(3),
    "lang" TEXT,
    "raw" JSONB NOT NULL,
    "rawName" TEXT,
    "rawBrands" TEXT,
    "rawQuantity" TEXT,
    "rawCategories" TEXT,
    "imageUrl" TEXT,
    "name" TEXT,
    "brand" TEXT,
    "brandKnown" BOOLEAN NOT NULL DEFAULT false,
    "extraBrands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subbrand" TEXT,
    "productType" TEXT,
    "productTypePlural" TEXT,
    "variant" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "packaging" TEXT,
    "category" TEXT,
    "packageSizeText" TEXT,
    "packCount" INTEGER,
    "filters" JSONB,
    "nutrition" JSONB,
    "splitConfidence" INTEGER NOT NULL DEFAULT 0,
    "splitIssues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "splitFields" JSONB,
    "splitLanguage" TEXT,
    "splitVersion" INTEGER NOT NULL DEFAULT 0,
    "splitAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "off_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "off_products_barcode_key" ON "off_products"("barcode");
CREATE INDEX "off_products_splitConfidence_idx" ON "off_products"("splitConfidence");
CREATE INDEX "off_products_brand_idx" ON "off_products"("brand");
CREATE INDEX "off_products_productType_idx" ON "off_products"("productType");
CREATE INDEX "off_products_fetchedAt_idx" ON "off_products"("fetchedAt");
CREATE INDEX "off_products_productId_idx" ON "off_products"("productId");
