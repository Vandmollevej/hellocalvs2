-- AlterTable
ALTER TABLE "products"
  ADD COLUMN "nameOriginal" TEXT,
  ADD COLUMN "ingredientsOriginal" TEXT,
  ADD COLUMN "translationSourceLang" TEXT,
  ADD COLUMN "translationStatus" TEXT;
