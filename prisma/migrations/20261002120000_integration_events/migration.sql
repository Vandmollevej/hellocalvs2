-- Hændelseslog pr. integration til admin → Integrationer (docs/DECISIONS.md 2026-10-02).
CREATE TYPE "IntegrationEventType" AS ENUM ('CONNECTED', 'DISCONNECTED', 'SYNC', 'SYNC_ERROR', 'PUSH', 'SETTINGS_CHANGED');

CREATE TABLE "integration_events" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "type" "IntegrationEventType" NOT NULL,
  "itemCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "integration_events_provider_createdAt_idx" ON "integration_events"("provider", "createdAt");
CREATE INDEX "integration_events_type_createdAt_idx" ON "integration_events"("type", "createdAt");

ALTER TABLE "integration_events"
  ADD CONSTRAINT "integration_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nuværende tilkoblinger får en CONNECTED-hændelse på tilkoblingsdatoen, så
-- graferne ikke starter tomme. Allerede frakoblede springes over: deres
-- frakoblingsdato kendes ikke, og "aktive over tid" ville ellers skride.
INSERT INTO "integration_events" ("id", "userId", "provider", "type", "createdAt")
SELECT 'mig_' || "id", "userId", "provider", 'CONNECTED', "connectedAt"
FROM "integrations"
WHERE "connectedAt" IS NOT NULL AND "status" <> 'DISCONNECTED';
