-- Partnersider (docs/DECISIONS.md 2026-10-02): virksomhedsoplysninger,
-- fakturering/betaling, sponsoraftaler, reklamespots med banner/aftalte tal/
-- triggere, samt sti og eksponeringstid pr. visning.

DO $$ BEGIN CREATE TYPE "PartnerPaymentMethod" AS ENUM ('INVOICE', 'BANK_TRANSFER', 'CARD', 'MOBILEPAY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "partners"
  ADD COLUMN IF NOT EXISTS "cvr" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "addressStreet" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "addressZip" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "addressCity" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "phone" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "contactName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "managerName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "managerTitle" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "managerEmail" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "billingName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "billingEmail" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "billingAddress" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "ean" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "billingReference" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "paymentTermsDays" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS "paymentMethod" "PartnerPaymentMethod" NOT NULL DEFAULT 'INVOICE',
  ADD COLUMN IF NOT EXISTS "paymentNote" TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS "sponsor_agreements" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "budgetDkk" INTEGER NOT NULL DEFAULT 0,
    "cpmDkk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpcDkk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sponsor_agreements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sponsor_agreements_partnerId_idx" ON "sponsor_agreements"("partnerId");
DO $$ BEGIN
  ALTER TABLE "sponsor_agreements" ADD CONSTRAINT "sponsor_agreements_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "ad_locations"
  ADD COLUMN IF NOT EXISTS "inventoryKey" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "targetUrl" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "agreedImpressions" INTEGER,
  ADD COLUMN IF NOT EXISTS "agreedClicks" INTEGER,
  ADD COLUMN IF NOT EXISTS "triggerCategory" "ProductCategory",
  ADD COLUMN IF NOT EXISTS "triggerProductType" TEXT,
  ADD COLUMN IF NOT EXISTS "agreementId" TEXT;
CREATE INDEX IF NOT EXISTS "ad_locations_agreementId_idx" ON "ad_locations"("agreementId");
DO $$ BEGIN
  ALTER TABLE "ad_locations" ADD CONSTRAINT "ad_locations_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "sponsor_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "ad_events"
  ADD COLUMN IF NOT EXISTS "path" TEXT,
  ADD COLUMN IF NOT EXISTS "seconds" INTEGER;
