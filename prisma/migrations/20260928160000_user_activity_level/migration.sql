-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "activityLevel" "ActivityLevel";
