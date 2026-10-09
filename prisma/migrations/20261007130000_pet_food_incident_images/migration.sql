-- AlterTable
ALTER TABLE "pet_food_incidents" ADD COLUMN "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
