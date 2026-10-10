-- Subbrandets logo vises over brandet ved produktcirklen (docs/DECISIONS.md
-- 2026-10-10). Product.subbrand er fri tekst, så logoet hører til et navn
-- ("<brand> <subbrand>" eller subbrandet alene).
-- CreateTable
CREATE TABLE "subbrand_logos" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subbrand_logos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subbrand_logos_name_key" ON "subbrand_logos"("name");

-- AlterTable
ALTER TABLE "brand_logo_uploads" ADD COLUMN "subbrandName" TEXT;

-- CreateIndex
CREATE INDEX "brand_logo_uploads_subbrandName_idx" ON "brand_logo_uploads"("subbrandName");

-- AddForeignKey
ALTER TABLE "brand_logo_uploads" ADD CONSTRAINT "brand_logo_uploads_subbrandName_fkey" FOREIGN KEY ("subbrandName") REFERENCES "subbrand_logos"("name") ON DELETE SET NULL ON UPDATE CASCADE;
