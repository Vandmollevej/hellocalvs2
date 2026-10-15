-- Lokal OCR af bagsidebilleder før AI (docs/DECISIONS.md 2026-10-15).
ALTER TABLE "product_back_photos" ADD COLUMN "localResult" JSONB;
ALTER TABLE "product_back_photos" ADD COLUMN "localScannedAt" TIMESTAMP(3);
