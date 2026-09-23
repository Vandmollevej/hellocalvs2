-- Videresendelse uden gemt modtager; krypteret payload (docs/PRIVACY.md).

-- DropForeignKey
ALTER TABLE "forwards" DROP CONSTRAINT "forwards_recipientId_fkey";

-- DropIndex
DROP INDEX "forwards_recipientId_idx";

-- AlterTable
ALTER TABLE "forwards" DROP COLUMN "recipientId",
ADD COLUMN     "payloadCiphertext" TEXT,
ADD COLUMN     "payloadIv" TEXT;

