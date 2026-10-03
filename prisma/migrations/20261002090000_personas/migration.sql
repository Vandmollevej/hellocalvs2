-- Personas (docs/DECISIONS.md 2026-10-02): by på login-hændelser + snapshots
-- af de anonyme gruppetal og AI-modellens personas.
ALTER TABLE "login_events" ADD COLUMN "city" TEXT;

CREATE TABLE "persona_snapshots" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL,
  "buildId" TEXT,
  "userCount" INTEGER NOT NULL,
  "model" TEXT,
  "aggregates" JSONB NOT NULL,
  "personas" JSONB,
  "error" TEXT,
  "durationMs" INTEGER,
  CONSTRAINT "persona_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "persona_snapshots_createdAt_idx" ON "persona_snapshots"("createdAt");
CREATE INDEX "persona_snapshots_buildId_idx" ON "persona_snapshots"("buildId");
