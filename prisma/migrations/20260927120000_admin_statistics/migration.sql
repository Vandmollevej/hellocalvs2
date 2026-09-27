-- Admin-statistik: log-in-hændelser og søgninger uden resultat (docs/DECISIONS.md 2026-09-27).
CREATE TABLE "login_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_events_createdAt_idx" ON "login_events"("createdAt");
CREATE INDEX "login_events_userId_createdAt_idx" ON "login_events"("userId", "createdAt");

ALTER TABLE "login_events" ADD CONSTRAINT "login_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "search_misses" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_misses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "search_misses_createdAt_idx" ON "search_misses"("createdAt");
