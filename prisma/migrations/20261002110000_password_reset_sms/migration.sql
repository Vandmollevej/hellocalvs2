-- SMS-gendannelse af adgangskode (docs/DECISIONS.md 2026-10-02).
CREATE TABLE "password_reset_sms_codes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_sms_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_reset_sms_codes_userId_idx" ON "password_reset_sms_codes"("userId");

ALTER TABLE "password_reset_sms_codes"
  ADD CONSTRAINT "password_reset_sms_codes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
