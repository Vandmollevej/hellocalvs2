-- Aktivitetsniveau, PAL og kaloriemaal (docs/ACTIVITY-PAL.md, DECISIONS 2026-09-29).
CREATE TYPE "PalSource" AS ENUM ('QUESTIONNAIRE', 'MANUAL', 'STEPS', 'CALIBRATED');
CREATE TYPE "GoalMode" AS ENUM ('MAINTAIN', 'LOSE', 'GAIN');

ALTER TABLE "users"
  ADD COLUMN "palBase" DOUBLE PRECISION,
  ADD COLUMN "palSource" "PalSource",
  ADD COLUMN "palConfidence" DOUBLE PRECISION,
  ADD COLUMN "activityAnswers" JSONB,
  ADD COLUMN "activityProfileUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "trainingAllowanceKcal" INTEGER,
  ADD COLUMN "goalMode" "GoalMode",
  ADD COLUMN "goalPaceKgPerWeek" DOUBLE PRECISION;

CREATE TABLE "activity_profile_snapshots" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "palBase" DOUBLE PRECISION NOT NULL,
  "palConfidence" DOUBLE PRECISION,
  "source" "PalSource" NOT NULL,
  "answers" JSONB,
  "trainingAllowanceKcal" INTEGER,
  CONSTRAINT "activity_profile_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_profile_snapshots_userId_validFrom_idx" ON "activity_profile_snapshots"("userId", "validFrom");

ALTER TABLE "activity_profile_snapshots"
  ADD CONSTRAINT "activity_profile_snapshots_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
