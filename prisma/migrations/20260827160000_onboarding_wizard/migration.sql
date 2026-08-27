-- CreateEnum
CREATE TYPE "DailyLogPreference" AS ENUM ('WORK_HOURS', 'SLEEP_TIMES');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "dailyLogPreference" "DailyLogPreference";
ALTER TABLE "users" ADD COLUMN "workHoursInCalendarEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "healthImportRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "onboardingRemindLaterAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "onboardingDismissed" BOOLEAN NOT NULL DEFAULT false;
