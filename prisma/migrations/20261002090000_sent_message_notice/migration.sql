-- AlterEnum
ALTER TYPE "MessageChannel" ADD VALUE 'SMS';

-- AlterTable
ALTER TABLE "outbound_messages" ADD COLUMN "noticeAckAt" TIMESTAMP(3);

-- Beskeder sendt før funktionen fandtes skal ikke give en popup.
UPDATE "outbound_messages" SET "noticeAckAt" = CURRENT_TIMESTAMP WHERE "sentAt" IS NOT NULL;
