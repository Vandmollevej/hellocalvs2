-- AlterEnum
ALTER TYPE "WeightSource" ADD VALUE 'APPLE_HEALTH';
ALTER TYPE "WeightSource" ADD VALUE 'GOOGLE_HEALTH';

-- AlterEnum
ALTER TYPE "ActivitySource" ADD VALUE 'APPLE_HEALTH';
ALTER TYPE "ActivitySource" ADD VALUE 'GOOGLE_HEALTH';

-- CreateEnum
CREATE TYPE "HealthMetricSource" AS ENUM ('APPLE_HEALTH', 'GOOGLE_HEALTH');

-- CreateEnum
CREATE TYPE "HealthMetricType" AS ENUM ('STEPS', 'ACTIVE_ENERGY_KCAL', 'RESTING_ENERGY_KCAL', 'HEART_RATE_BPM', 'SLEEP_MINUTES', 'BODY_FAT_PERCENT', 'HEIGHT_CM', 'BMI', 'WATER_ML');

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "HealthMetricSource" NOT NULL,
    "type" "HealthMetricType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_tokenHash_key" ON "device_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "health_metrics_userId_source_type_recordedAt_key" ON "health_metrics"("userId", "source", "type", "recordedAt");

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_metrics" ADD CONSTRAINT "health_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
