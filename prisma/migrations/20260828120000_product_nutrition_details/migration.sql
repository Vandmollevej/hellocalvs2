-- AlterTable
ALTER TABLE "products" ADD COLUMN     "ingredientsText" TEXT,
ADD COLUMN     "allergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "additives" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "showAllergens" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allergenVisibility" JSONB;
