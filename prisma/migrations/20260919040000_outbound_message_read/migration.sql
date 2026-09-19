-- AlterTable
ALTER TABLE "outbound_messages" ADD COLUMN "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "outbound_messages_userId_readAt_idx" ON "outbound_messages"("userId", "readAt");
