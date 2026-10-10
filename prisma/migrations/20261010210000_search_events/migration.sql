-- Søgestatistik (docs/DECISIONS.md 2026-10-10): alle søgninger, raffineringer og
-- vurdering af søgninger uden resultat (admin → Analyse → Søgning).
CREATE TABLE "search_events" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "device" TEXT,
    "screen" TEXT,
    "sessionKey" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "fullMatchCount" INTEGER NOT NULL,
    "engine" TEXT NOT NULL,
    "correctedQuery" TEXT,
    "refinedFromId" TEXT,
    "clickedItemId" TEXT,
    "clickedItemType" TEXT,
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "search_events_createdAt_idx" ON "search_events"("createdAt");
CREATE INDEX "search_events_sessionKey_updatedAt_idx" ON "search_events"("sessionKey", "updatedAt");
CREATE INDEX "search_events_normalizedQuery_idx" ON "search_events"("normalizedQuery");
CREATE INDEX "search_events_region_createdAt_idx" ON "search_events"("region", "createdAt");

ALTER TABLE "search_events" ADD CONSTRAINT "search_events_refinedFromId_fkey" FOREIGN KEY ("refinedFromId") REFERENCES "search_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "search_query_reviews" (
    "normalizedQuery" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "suggestion" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_query_reviews_pkey" PRIMARY KEY ("normalizedQuery")
);

CREATE INDEX "search_query_reviews_kind_idx" ON "search_query_reviews"("kind");
