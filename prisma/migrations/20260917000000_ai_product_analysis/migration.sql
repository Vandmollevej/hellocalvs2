-- Barcode-first guided AI product recognition (docs/DECISIONS.md, 2026-09-17).
-- Hand-written, same reason as other recent migrations in this project — no
-- local PostgreSQL reachable from this workstation to run `prisma migrate dev`.

-- CreateEnum
CREATE TYPE "AiAnalysisKind" AS ENUM ('FRONT', 'INGREDIENTS', 'NUTRITION');

-- AlterTable
ALTER TABLE "products"
  ADD COLUMN "subbrand" TEXT,
  ADD COLUMN "variant" TEXT,
  ADD COLUMN "packageSizeText" TEXT;

-- CreateTable
CREATE TABLE "ai_product_analyses" (
  "id" TEXT NOT NULL,
  "kind" "AiAnalysisKind" NOT NULL,
  "barcode" TEXT,
  "market_region" TEXT,
  "gs1_regions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "model" TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "prediction" JSONB NOT NULL,
  "correction" JSONB,
  "confidence" DOUBLE PRECISION,
  "product_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "corrected_at" TIMESTAMP(3),

  CONSTRAINT "ai_product_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_product_analyses_kind_corrected_at_idx" ON "ai_product_analyses"("kind", "corrected_at");

-- CreateIndex
CREATE INDEX "ai_product_analyses_product_id_idx" ON "ai_product_analyses"("product_id");

-- AddForeignKey
ALTER TABLE "ai_product_analyses" ADD CONSTRAINT "ai_product_analyses_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
