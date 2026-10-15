-- Varens sprog og oversættelser (docs/DECISIONS.md 2026-10-15): kolonnerne
-- står altid på varens originalsprog (products.language) og overskrives
-- aldrig af en oversættelse. Oversættelser til brugerens app-sprog ligger
-- i product_translations, én række pr. vare og sprog.
ALTER TABLE "products" ADD COLUMN "language" TEXT;

CREATE TABLE "product_translations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "name" TEXT,
    "namePlural" TEXT,
    "productType" TEXT,
    "variant" TEXT,
    "packageSizeText" TEXT,
    "ingredientsText" TEXT,
    "subbrand" TEXT,
    "brandName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_translations_productId_locale_key" ON "product_translations"("productId", "locale");

ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD COLUMN "translateForeignText" BOOLEAN NOT NULL DEFAULT true;
