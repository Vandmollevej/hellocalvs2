CREATE TABLE "ad_events" (
    "id" TEXT NOT NULL,
    "adKey" TEXT NOT NULL,
    "placement" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ad_events_adKey_createdAt_idx" ON "ad_events"("adKey", "createdAt");
CREATE INDEX "ad_events_createdAt_idx" ON "ad_events"("createdAt");
