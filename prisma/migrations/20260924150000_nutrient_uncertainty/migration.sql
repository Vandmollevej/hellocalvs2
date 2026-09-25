-- Usikkerheds-~ + admin "Uncertainties" + admin "Cron-jobs"
-- (docs/DECISIONS.md 2026-09-24/2026-09-25). Hand-written, same reason as
-- other recent migrations in this project — no local PostgreSQL reachable
-- from this workstation to run `prisma migrate dev`.
ALTER TABLE "products" ADD COLUMN "micronutrientsPer100g" JSONB;
ALTER TABLE "products" ADD COLUMN "nutrientSources" JSONB;
ALTER TABLE "products" ADD COLUMN "nutrientTolerances" JSONB;

ALTER TABLE "generic_ingredients" ADD COLUMN "micronutrientsPer100g" JSONB;

ALTER TABLE "ai_product_analyses" ADD COLUMN "regions" JSONB;
ALTER TABLE "ai_product_analyses" ADD COLUMN "reviewed_at" TIMESTAMP(3);

CREATE TABLE "scheduled_jobs" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "runAtTime" TEXT,
    "intervalMinutes" INTEGER,
    "runRequestedAt" TIMESTAMP(3),
    "lastStartedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastMessage" TEXT,
    "lastDurationMs" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("key")
);
