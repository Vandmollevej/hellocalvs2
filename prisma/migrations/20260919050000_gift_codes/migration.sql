-- Gavekoder (docs/DECISIONS.md 2026-09-19): admin-oprettede engangskoder,
-- der ved indløsning giver et fast antal dage Seriøs uden krav om nogen
-- betalingsmetode.
-- Hand-written, same reason as other recent migrations in this project — no
-- local PostgreSQL reachable from this workstation to run `prisma migrate dev`.

-- CreateTable
CREATE TABLE "gift_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "redeemedById" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gift_codes_code_key" ON "gift_codes"("code");

-- AddForeignKey
ALTER TABLE "gift_codes" ADD CONSTRAINT "gift_codes_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
