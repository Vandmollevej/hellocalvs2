-- MET, distance og oplevet anstrengelse paa aktiviteter (docs/ACTIVITY-PAL.md F3).
CREATE TYPE "TrainingIntensity" AS ENUM ('LIGHT', 'MODERATE', 'VIGOROUS', 'VERY_VIGOROUS');
CREATE TYPE "ActivityEnergySource" AS ENUM ('USER', 'ESTIMATED_MET', 'DEVICE');

ALTER TABLE "activities"
  ADD COLUMN "met" DOUBLE PRECISION,
  ADD COLUMN "distanceKm" DOUBLE PRECISION,
  ADD COLUMN "perceivedEffort" "TrainingIntensity",
  ADD COLUMN "energySource" "ActivityEnergySource" NOT NULL DEFAULT 'USER';
