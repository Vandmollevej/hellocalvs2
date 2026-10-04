-- CreateEnum
CREATE TYPE "PulseCandidateStatus" AS ENUM ('PENDING', 'ANSWERED', 'SKIPPED', 'COVERED', 'EXPIRED');

-- CreateTable
CREATE TABLE "pulse_activity_candidates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "extraKcal" DOUBLE PRECISION NOT NULL,
    "peakBpm" INTEGER NOT NULL,
    "restingBpm" INTEGER NOT NULL,
    "features" JSONB,
    "suggestedSport" TEXT,
    "confidence" DOUBLE PRECISION,
    "basis" TEXT,
    "alternatives" JSONB,
    "suggestionReady" BOOLEAN NOT NULL DEFAULT false,
    "status" "PulseCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "answeredSport" TEXT,
    "answeredAt" TIMESTAMP(3),
    "detectedBy" TEXT NOT NULL DEFAULT 'night',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pulse_activity_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pulse_activity_candidates_userId_startedAt_key" ON "pulse_activity_candidates"("userId", "startedAt");
CREATE INDEX "pulse_activity_candidates_userId_status_startedAt_idx" ON "pulse_activity_candidates"("userId", "status", "startedAt");
CREATE INDEX "pulse_activity_candidates_status_answeredAt_idx" ON "pulse_activity_candidates"("status", "answeredAt");

-- AddForeignKey
ALTER TABLE "pulse_activity_candidates" ADD CONSTRAINT "pulse_activity_candidates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
