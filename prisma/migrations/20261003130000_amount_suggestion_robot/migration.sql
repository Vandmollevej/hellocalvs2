-- 2026-09-25: Mængde-robot + fælles robot-konfiguration (docs/DECISIONS.md).
CREATE TYPE "AmountContext" AS ENUM ('EATEN', 'RECIPE');

CREATE TABLE "robot_configs" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "runRequestedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "lastRunStartedAt" TIMESTAMP(3),
    "lastRunFinishedAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastRunSummary" JSONB,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "robot_configs_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "amount_suggestions" (
    "id" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "context" "AmountContext" NOT NULL,
    "suggestedGrams" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "userCount" INTEGER NOT NULL,
    "p25Grams" DOUBLE PRECISION,
    "p75Grams" DOUBLE PRECISION,
    "method" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amount_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "amount_suggestions_itemType_itemId_context_key" ON "amount_suggestions"("itemType", "itemId", "context");
