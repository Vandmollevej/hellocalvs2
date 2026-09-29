-- CreateEnum
DO $$ BEGIN CREATE TYPE "AdEventType" AS ENUM ('IMPRESSION', 'CLICK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ReportFrequency" AS ENUM ('WEEKLY', 'MONTHLY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "partner_contacts" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ad_locations" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placement" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ad_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ad_events" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "type" "AdEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "partner_report_schedules" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "frequency" "ReportFrequency" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_report_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "partner_report_sends" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_report_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partner_contacts_partnerId_idx" ON "partner_contacts"("partnerId");
CREATE INDEX IF NOT EXISTS "ad_locations_partnerId_idx" ON "ad_locations"("partnerId");
CREATE INDEX IF NOT EXISTS "ad_events_locationId_type_createdAt_idx" ON "ad_events"("locationId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "partner_report_schedules_enabled_nextRunAt_idx" ON "partner_report_schedules"("enabled", "nextRunAt");
CREATE INDEX IF NOT EXISTS "partner_report_sends_partnerId_createdAt_idx" ON "partner_report_sends"("partnerId", "createdAt");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ad_locations" ADD CONSTRAINT "ad_locations_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "ad_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "partner_report_schedules" ADD CONSTRAINT "partner_report_schedules_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "partner_report_sends" ADD CONSTRAINT "partner_report_sends_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
