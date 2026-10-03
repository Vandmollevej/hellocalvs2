-- Kørselshistorik for baggrundsjob/robotter (docs/DECISIONS.md 2026-10-02).
CREATE TABLE "scheduled_job_runs" (
  "id" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "runCount" INTEGER NOT NULL DEFAULT 1,
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "scheduled_job_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scheduled_job_runs_jobKey_finishedAt_idx" ON "scheduled_job_runs"("jobKey", "finishedAt");
