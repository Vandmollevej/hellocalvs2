-- SMS-bekraeftelse via TeamMessage (docs/DECISIONS.md 2026-10-02).
ALTER TABLE "users"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE TABLE "sms_verifications" (
  "id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "userId" TEXT,
  "resetTokenHash" TEXT,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sms_verifications_phone_createdAt_idx" ON "sms_verifications"("phone", "createdAt");
