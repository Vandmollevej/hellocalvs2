-- AlterEnum
ALTER TYPE "ExternalProductSource" ADD VALUE 'BILKA';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "flavor" TEXT,
ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "packCount" INTEGER;

-- AlterTable
ALTER TABLE "product_nutrition_features" ADD COLUMN     "alcoholPer100g" DOUBLE PRECISION,
ADD COLUMN     "calciumMgPer100g" DOUBLE PRECISION,
ADD COLUMN     "energyKjPer100g" DOUBLE PRECISION,
ADD COLUMN     "monounsaturatedFatPer100g" DOUBLE PRECISION,
ADD COLUMN     "phosphorusMgPer100g" DOUBLE PRECISION,
ADD COLUMN     "polyunsaturatedFatPer100g" DOUBLE PRECISION,
ADD COLUMN     "sodiumPer100g" DOUBLE PRECISION,
ADD COLUMN     "vitaminB12UgPer100g" DOUBLE PRECISION,
ADD COLUMN     "vitaminB2MgPer100g" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "product_filters" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "organic" TEXT,
    "glutenFree" TEXT,
    "lactoseFree" TEXT,
    "sugarFree" TEXT,
    "sweeteners" TEXT,
    "vegan" TEXT,
    "vegetarian" TEXT,
    "meatType" TEXT,
    "alcohol" TEXT,
    "alcoholPercent" DOUBLE PRECISION,
    "fatPercent" DOUBLE PRECISION,
    "countryOfOrigin" TEXT,
    "wholeGrain" TEXT,
    "keyhole" TEXT,
    "animalWelfare" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "storage" TEXT,
    "size" TEXT,
    "toxins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_filters_productId_key" ON "product_filters"("productId");

-- CreateIndex
CREATE INDEX "product_filters_organic_idx" ON "product_filters"("organic");

-- CreateIndex
CREATE INDEX "product_filters_glutenFree_idx" ON "product_filters"("glutenFree");

-- CreateIndex
CREATE INDEX "product_filters_lactoseFree_idx" ON "product_filters"("lactoseFree");

-- CreateIndex
CREATE INDEX "product_filters_sugarFree_idx" ON "product_filters"("sugarFree");

-- CreateIndex
CREATE INDEX "product_filters_sweeteners_idx" ON "product_filters"("sweeteners");

-- CreateIndex
CREATE INDEX "product_filters_vegan_idx" ON "product_filters"("vegan");

-- CreateIndex
CREATE INDEX "product_filters_vegetarian_idx" ON "product_filters"("vegetarian");

-- CreateIndex
CREATE INDEX "product_filters_meatType_idx" ON "product_filters"("meatType");

-- CreateIndex
CREATE INDEX "product_filters_alcohol_idx" ON "product_filters"("alcohol");

-- CreateIndex
CREATE INDEX "product_filters_alcoholPercent_idx" ON "product_filters"("alcoholPercent");

-- CreateIndex
CREATE INDEX "product_filters_fatPercent_idx" ON "product_filters"("fatPercent");

-- CreateIndex
CREATE INDEX "product_filters_countryOfOrigin_idx" ON "product_filters"("countryOfOrigin");

-- CreateIndex
CREATE INDEX "product_filters_wholeGrain_idx" ON "product_filters"("wholeGrain");

-- CreateIndex
CREATE INDEX "product_filters_keyhole_idx" ON "product_filters"("keyhole");

-- CreateIndex
CREATE INDEX "product_filters_storage_idx" ON "product_filters"("storage");

-- CreateIndex
CREATE INDEX "product_filters_animalWelfare_idx" ON "product_filters" USING GIN ("animalWelfare");

-- CreateIndex
CREATE INDEX "product_filters_certifications_idx" ON "product_filters" USING GIN ("certifications");

-- CreateIndex
CREATE INDEX "product_filters_toxins_idx" ON "product_filters" USING GIN ("toxins");

-- AddForeignKey
ALTER TABLE "product_filters" ADD CONSTRAINT "product_filters_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
