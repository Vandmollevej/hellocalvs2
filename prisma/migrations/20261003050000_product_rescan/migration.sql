-- "Scan varen igen" (docs/DECISIONS.md 2026-10-02): points-banner efter
-- scanning af Open Food Facts-varer / egne varer uden fritlagt PNG, og den
-- natlige OpenAI-aflaesning af Open Food Facts-billedet.
ALTER TYPE "PointsReason" ADD VALUE 'PRODUCT_RESCAN';

ALTER TABLE "products"
  ADD COLUMN "rescanOfferedAt" TIMESTAMP(3),
  ADD COLUMN "rescannedAt" TIMESTAMP(3),
  ADD COLUMN "rescannedByUserId" TEXT,
  ADD COLUMN "externalImageAnalyzedAt" TIMESTAMP(3);
