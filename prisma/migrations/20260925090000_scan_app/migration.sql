-- Oprettelses-app (docs/OPRETTELSES-APP.md): invite-only medarbejdere,
-- hyldebilleder, indsendelser/aflønning og beskeder. Genereret med
-- `prisma migrate diff` (ingen lokal PostgreSQL på denne arbejdsstation).
-- CreateEnum
CREATE TYPE "ScanWorkerStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ShelfAnalysisStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ShelfItemStatus" AS ENUM ('MISSING', 'EXISTS', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "ScanSubmissionKind" AS ENUM ('NEW_PRODUCT', 'SUPPLEMENT');

-- CreateEnum
CREATE TYPE "ScanReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "scan_workers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "status" "ScanWorkerStatus" NOT NULL DEFAULT 'INVITED',
    "passwordHash" TEXT,
    "totpSecret" TEXT,
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "phone" TEXT,
    "address" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "cprEnc" TEXT,
    "bankName" TEXT,
    "bankRegNoEnc" TEXT,
    "bankAccountEnc" TEXT,
    "paypalEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_worker_profile_versions" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_worker_profile_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelf_photos" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION,
    "storeName" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analysisStatus" "ShelfAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisError" TEXT,

    CONSTRAINT "shelf_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelf_photo_items" (
    "id" TEXT NOT NULL,
    "shelfPhotoId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "w" DOUBLE PRECISION NOT NULL,
    "h" DOUBLE PRECISION NOT NULL,
    "detectedName" TEXT NOT NULL,
    "detectedBrand" TEXT,
    "detectedText" TEXT,
    "productId" TEXT,
    "matchConfidence" DOUBLE PRECISION,
    "status" "ShelfItemStatus" NOT NULL DEFAULT 'MISSING',
    "manuallyAssigned" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shelf_photo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_submissions" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shelfPhotoItemId" TEXT,
    "kind" "ScanSubmissionKind" NOT NULL,
    "payable" BOOLEAN NOT NULL DEFAULT true,
    "missingEnergy" BOOLEAN NOT NULL DEFAULT false,
    "missingIngredients" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION,
    "storeName" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amountOre" INTEGER NOT NULL,
    "reviewStatus" "ScanReviewStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReasonId" TEXT,
    "rejectionComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    "payoutId" TEXT,

    CONSTRAINT "scan_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_rejection_reasons" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_rejection_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "payPerItemOre" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_payouts" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "amountOre" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "scan_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_messages" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "fromAdmin" BOOLEAN NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "scan_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scan_workers_email_key" ON "scan_workers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "scan_workers_username_key" ON "scan_workers"("username");

-- CreateIndex
CREATE UNIQUE INDEX "scan_workers_inviteTokenHash_key" ON "scan_workers"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "scan_worker_profile_versions_workerId_createdAt_idx" ON "scan_worker_profile_versions"("workerId", "createdAt");

-- CreateIndex
CREATE INDEX "shelf_photos_workerId_capturedAt_idx" ON "shelf_photos"("workerId", "capturedAt");

-- CreateIndex
CREATE INDEX "shelf_photo_items_shelfPhotoId_idx" ON "shelf_photo_items"("shelfPhotoId");

-- CreateIndex
CREATE INDEX "scan_submissions_workerId_createdAt_idx" ON "scan_submissions"("workerId", "createdAt");

-- CreateIndex
CREATE INDEX "scan_submissions_reviewStatus_idx" ON "scan_submissions"("reviewStatus");

-- CreateIndex
CREATE INDEX "scan_payouts_workerId_paidAt_idx" ON "scan_payouts"("workerId", "paidAt");

-- CreateIndex
CREATE INDEX "scan_messages_workerId_createdAt_idx" ON "scan_messages"("workerId", "createdAt");

-- AddForeignKey
ALTER TABLE "scan_worker_profile_versions" ADD CONSTRAINT "scan_worker_profile_versions_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "scan_workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelf_photos" ADD CONSTRAINT "shelf_photos_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "scan_workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelf_photo_items" ADD CONSTRAINT "shelf_photo_items_shelfPhotoId_fkey" FOREIGN KEY ("shelfPhotoId") REFERENCES "shelf_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelf_photo_items" ADD CONSTRAINT "shelf_photo_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_submissions" ADD CONSTRAINT "scan_submissions_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "scan_workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_submissions" ADD CONSTRAINT "scan_submissions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_submissions" ADD CONSTRAINT "scan_submissions_shelfPhotoItemId_fkey" FOREIGN KEY ("shelfPhotoItemId") REFERENCES "shelf_photo_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_submissions" ADD CONSTRAINT "scan_submissions_rejectionReasonId_fkey" FOREIGN KEY ("rejectionReasonId") REFERENCES "scan_rejection_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_submissions" ADD CONSTRAINT "scan_submissions_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "scan_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_payouts" ADD CONSTRAINT "scan_payouts_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "scan_workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_messages" ADD CONSTRAINT "scan_messages_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "scan_workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Startliste over afvisningsårsager (redigerbar i admin) og global sats.
INSERT INTO "scan_rejection_reasons" ("id", "label", "sortOrder") VALUES
  ('scanreason_not_food', 'Ikke en fødevare', 1),
  ('scanreason_blurry', 'Ulæseligt/sløret billede', 2),
  ('scanreason_duplicate', 'Dublet af eksisterende produkt', 3),
  ('scanreason_barcode', 'Forkert/manglende stregkode', 4),
  ('scanreason_missing_data', 'Mangler energitabel/ingredienser', 5),
  ('scanreason_other', 'Andet', 6);

INSERT INTO "scan_settings" ("id", "payPerItemOre") VALUES (1, 100);
