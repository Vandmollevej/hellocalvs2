-- Additiv: soft-slet af indbakke-beskeder (Profil -> Beskeder -> Slettet).
ALTER TABLE "outbound_messages" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "outbound_messages_userId_deletedAt_idx" ON "outbound_messages"("userId", "deletedAt");
