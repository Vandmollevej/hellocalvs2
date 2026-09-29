-- CreateEnum
CREATE TYPE "CustomActivityStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "custom_activity_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "status" "CustomActivityStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "custom_activity_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "heart_rate_spike_reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "extraKcal" DOUBLE PRECISION NOT NULL,
    "activityId" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "heart_rate_spike_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_activity_types_normalizedName_key" ON "custom_activity_types"("normalizedName");
CREATE INDEX "custom_activity_types_status_idx" ON "custom_activity_types"("status");
CREATE UNIQUE INDEX "heart_rate_spike_reviews_userId_startedAt_key" ON "heart_rate_spike_reviews"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "custom_activity_types" ADD CONSTRAINT "custom_activity_types_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "heart_rate_spike_reviews" ADD CONSTRAINT "heart_rate_spike_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
