-- Hello Doc: krypteret rapport fra ejerens enhed; modtager i boksen (docs/PRIVACY.md).

-- AlterTable
ALTER TABLE "doctor_shares" ADD COLUMN     "snapshotCiphertext" TEXT,
ADD COLUMN     "snapshotIv" TEXT,
ADD COLUMN     "snapshotUpdatedAt" TIMESTAMP(3),
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

