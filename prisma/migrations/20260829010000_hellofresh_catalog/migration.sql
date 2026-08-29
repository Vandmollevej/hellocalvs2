-- AlterTable
ALTER TABLE "products" ADD COLUMN "nutritionExtra" JSONB;

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "externalSource" TEXT,
    "externalId" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_externalId_key" ON "ingredients"("externalId");

-- CreateTable
CREATE TABLE "product_ingredients" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "rawAmount" DOUBLE PRECISION NOT NULL,
    "rawUnit" TEXT NOT NULL,
    "amountGrams" DOUBLE PRECISION,
    "proportion" DOUBLE PRECISION,

    CONSTRAINT "product_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_ingredients_productId_ingredientId_key" ON "product_ingredients"("productId", "ingredientId");

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the four catalog categories used to tag scanned/imported food data
-- (not shown in the UI). "Menuer" and "Færdigmad" are reserved for future
-- use — nothing populates them yet. See docs/DECISIONS.md (2026-08-29).
INSERT INTO "categories" ("id", "name") VALUES
    ('cat_retter', 'Retter'),
    ('cat_menuer', 'Menuer'),
    ('cat_ingredienser', 'Ingredienser'),
    ('cat_faerdigmad', 'Færdigmad')
ON CONFLICT ("name") DO NOTHING;
