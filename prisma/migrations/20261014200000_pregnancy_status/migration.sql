-- CreateEnum
CREATE TYPE "PregnancyStatus" AS ENUM ('PREGNANT', 'BREASTFEEDING');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "pregnancyStatus" "PregnancyStatus",
ADD COLUMN "pregnancyWeek" INTEGER,
ADD COLUMN "breastfeedingWeeks" INTEGER,
ADD COLUMN "pregnancyStatusUpdatedAt" TIMESTAMP(3);
