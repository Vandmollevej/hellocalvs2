-- AlterTable
ALTER TABLE "body_measurements" ADD COLUMN "buttockCm" DOUBLE PRECISION,
ADD COLUMN "ankleCm" DOUBLE PRECISION,
ADD COLUMN "calfCm" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "bodyMeasurementVisibility" JSONB;
