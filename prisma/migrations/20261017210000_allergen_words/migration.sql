-- Allergen-robotten (docs/DECISIONS.md 2026-10-17)
CREATE TYPE "AllergenWordStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "allergen_words" (
    "word" TEXT NOT NULL,
    "allergenKey" TEXT,
    "status" "AllergenWordStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "language" TEXT,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "exampleProductId" TEXT,
    "exampleContext" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "allergen_words_pkey" PRIMARY KEY ("word")
);

CREATE INDEX "allergen_words_status_idx" ON "allergen_words"("status");
CREATE INDEX "allergen_words_firstSeenAt_idx" ON "allergen_words"("firstSeenAt");

CREATE TABLE "allergen_word_scans" (
    "productId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allergen_word_scans_pkey" PRIMARY KEY ("productId")
);
