-- Familieabonnement: hvem oprettede en registrering, og må medlemmet slette andres (docs/FAMILY.md).
-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "family_members" ADD COLUMN     "canDeleteOthersEntries" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

