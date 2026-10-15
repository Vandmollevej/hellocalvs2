-- Beskåret forsidefoto (docs/DECISIONS.md 2026-10-15)
ALTER TABLE "products" ADD COLUMN "frontImageSuspect" TEXT;
ALTER TABLE "products" ADD COLUMN "frontImageSuspectUrl" TEXT;
ALTER TABLE "products" ADD COLUMN "frontImageSuspectAt" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN "frontImageFixedAt" TIMESTAMP(3);
