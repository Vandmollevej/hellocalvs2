-- Testperson-program pr. integration (docs/DECISIONS.md 2026-10-02).
ALTER TYPE "PointsReason" ADD VALUE 'INTEGRATION_TESTER';

CREATE TYPE "IntegrationTesterStatus" AS ENUM ('PENDING', 'APPROVED');

CREATE TABLE "integration_testers" (
  "id" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "IntegrationTesterStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  CONSTRAINT "integration_testers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_testers_provider_key" ON "integration_testers"("provider");
CREATE INDEX "integration_testers_userId_idx" ON "integration_testers"("userId");

ALTER TABLE "integration_testers"
  ADD CONSTRAINT "integration_testers_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
