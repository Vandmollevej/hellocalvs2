-- Admin-styring af generiske produkter (docs/DECISIONS.md 2026-10-15).
ALTER TABLE "generic_ingredients" ADD COLUMN "sheetCategory" TEXT;
ALTER TABLE "generic_ingredients" ADD COLUMN "productType" TEXT;
ALTER TABLE "generic_ingredients" ADD COLUMN "variation" TEXT;
ALTER TABLE "generic_ingredients" ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "generic_ingredients" ADD COLUMN "properties" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "generic_ingredients" ADD COLUMN "sourceKind" TEXT;
ALTER TABLE "generic_ingredients" ADD COLUMN "sourceName" TEXT;
ALTER TABLE "generic_ingredients" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "generic_ingredients" ADD COLUMN "archivedAt" TIMESTAMP(3);
