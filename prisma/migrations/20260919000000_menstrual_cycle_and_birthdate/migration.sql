-- Fødselsdato (erstatter birthYear) + menstruationscyklus (docs/DECISIONS.md
-- 2026-09-19). Hand-written, same reason as other recent migrations in this
-- project — no local PostgreSQL reachable from this workstation to run
-- `prisma migrate dev`.

-- AlterTable
ALTER TABLE "users" DROP COLUMN "birthYear";
ALTER TABLE "users" ADD COLUMN "birthDate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "cycleTrackingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "averageCycleLengthDays" INTEGER NOT NULL DEFAULT 28;
ALTER TABLE "users" ADD COLUMN "averagePeriodLengthDays" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "menstrual_cycle_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menstrual_cycle_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "menstrual_cycle_entries_userId_startDate_idx" ON "menstrual_cycle_entries"("userId", "startDate");

-- AddForeignKey
ALTER TABLE "menstrual_cycle_entries" ADD CONSTRAINT "menstrual_cycle_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
