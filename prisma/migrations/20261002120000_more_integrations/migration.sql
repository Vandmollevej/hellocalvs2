-- Flere integrationer (docs/DECISIONS.md 2026-10-02): Garmin, Whoop og
-- Huawei Health i skyen; Eufy, Renpho, Xiaomi og Tuya via Health Connect /
-- Apple Health. Håndskrevet (ingen lokal PostgreSQL).

ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'WHOOP';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'HUAWEI_HEALTH';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'EUFY';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'RENPHO';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'XIAOMI';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'TUYA';

ALTER TYPE "WeightSource" ADD VALUE IF NOT EXISTS 'GARMIN';
ALTER TYPE "WeightSource" ADD VALUE IF NOT EXISTS 'HUAWEI_HEALTH';

ALTER TYPE "ActivitySource" ADD VALUE IF NOT EXISTS 'WHOOP';
ALTER TYPE "ActivitySource" ADD VALUE IF NOT EXISTS 'HUAWEI_HEALTH';

ALTER TYPE "HealthMetricSource" ADD VALUE IF NOT EXISTS 'WHOOP';
ALTER TYPE "HealthMetricSource" ADD VALUE IF NOT EXISTS 'HUAWEI_HEALTH';

ALTER TABLE "integrations" ADD COLUMN "externalUserId" TEXT;
CREATE INDEX "integrations_provider_externalUserId_idx" ON "integrations"("provider", "externalUserId");
