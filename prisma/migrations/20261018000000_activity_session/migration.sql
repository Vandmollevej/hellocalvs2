-- Træningspas: flere øvelser gemt under samme træning deler sessionId.
ALTER TABLE "activities" ADD COLUMN "sessionId" TEXT;
CREATE INDEX "activities_sessionId_idx" ON "activities"("sessionId");
