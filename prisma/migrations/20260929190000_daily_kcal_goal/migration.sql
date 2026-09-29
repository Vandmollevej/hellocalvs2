-- AlterTable
ALTER TABLE "users" ADD COLUMN "dailyKcalGoal" INTEGER,
ADD COLUMN "kcalGoalUpdatedAt" TIMESTAMP(3),
ADD COLUMN "kcalGoalPromptSnoozedUntil" TIMESTAMP(3),
ADD COLUMN "kcalGoalPromptDisabled" BOOLEAN NOT NULL DEFAULT false;
