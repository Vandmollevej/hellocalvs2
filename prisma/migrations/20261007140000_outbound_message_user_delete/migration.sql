-- AlterTable
ALTER TABLE "outbound_messages" ADD COLUMN "userDeletedAt" TIMESTAMP(3),
ADD COLUMN "userPurgedAt" TIMESTAMP(3);
