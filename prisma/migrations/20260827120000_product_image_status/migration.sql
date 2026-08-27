-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "pendingImageUrl" TEXT;
ALTER TABLE "products" ADD COLUMN "imageStatus" "ImageStatus" NOT NULL DEFAULT 'NONE';
