-- CreateEnum
CREATE TYPE "SpellingIssueStatus" AS ENUM ('AUTO_FIXED', 'PENDING', 'ACCEPTED', 'REJECTED', 'REVERTED');

-- CreateTable
CREATE TABLE "spelling_issues" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "field" TEXT NOT NULL DEFAULT 'ingredientsText',
    "word" TEXT NOT NULL,
    "suggestion" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "contextBefore" TEXT NOT NULL,
    "contextAfter" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "SpellingIssueStatus" NOT NULL,
    "appliedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "spelling_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spelling_rules" (
    "word" TEXT NOT NULL,
    "replacement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "spelling_rules_pkey" PRIMARY KEY ("word")
);

-- CreateTable
CREATE TABLE "spelling_words" (
    "word" TEXT NOT NULL,
    "productCount" INTEGER NOT NULL,

    CONSTRAINT "spelling_words_pkey" PRIMARY KEY ("word")
);

-- CreateTable
CREATE TABLE "spelling_scans" (
    "productId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spelling_scans_pkey" PRIMARY KEY ("productId")
);

-- CreateIndex
CREATE INDEX "spelling_issues_status_createdAt_idx" ON "spelling_issues"("status", "createdAt");

-- CreateIndex
CREATE INDEX "spelling_issues_productId_idx" ON "spelling_issues"("productId");
