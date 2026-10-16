-- Screening af produktbilleder for ufuldstændige billeder (docs/DECISIONS.md 2026-10-16).
CREATE TABLE "product_image_screenings" (
    "productId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cropScore" DOUBLE PRECISION,
    "cropSide" TEXT,
    "skinBorderScore" DOUBLE PRECISION,
    "skinTotalScore" DOUBLE PRECISION,
    "openScore" DOUBLE PRECISION,
    "error" TEXT,
    "screenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "product_image_screenings_pkey" PRIMARY KEY ("productId")
);
ALTER TABLE "product_image_screenings" ADD CONSTRAINT "product_image_screenings_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
