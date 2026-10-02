-- Telefonnummer på brugeren (docs/DECISIONS.md 2026-10-02): obligatorisk i
-- appen for alle, der kan logge ind (bruges til tofaktor-godkendelse).
-- Nullable i databasen, så eksisterende konti kan udfylde det ved næste login.
-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone" TEXT,
ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
