-- CreateEnum
CREATE TYPE "RelativeTime" AS ENUM ('BEFORE', 'AFTER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TimeOfDay" AS ENUM ('MORNING', 'EVENING', 'UNKNOWN');

-- CreateTable
CREATE TABLE "weight_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "clothed" BOOLEAN NOT NULL DEFAULT true,
    "toilet" "RelativeTime" NOT NULL DEFAULT 'UNKNOWN',
    "meal" "RelativeTime" NOT NULL DEFAULT 'UNKNOWN',
    "timeOfDay" "TimeOfDay" NOT NULL DEFAULT 'UNKNOWN',
    "note" TEXT,
    "weighedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weight_entries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
