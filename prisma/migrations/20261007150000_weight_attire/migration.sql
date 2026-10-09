-- CreateEnum
CREATE TYPE "WeighAttire" AS ENUM ('NAKED', 'UNDERWEAR', 'CLOTHED', 'CLOTHED_PHONE');

-- AlterTable
ALTER TABLE "weight_entries" ADD COLUMN "attire" "WeighAttire";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "weightCalibratedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "weight_attire_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lookbackCount" INTEGER NOT NULL DEFAULT 10,
    "windowHours" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "underwearBefore" INTEGER NOT NULL DEFAULT 8,
    "syncStaleHours" INTEGER NOT NULL DEFAULT 48,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weight_attire_settings_pkey" PRIMARY KEY ("id")
);
