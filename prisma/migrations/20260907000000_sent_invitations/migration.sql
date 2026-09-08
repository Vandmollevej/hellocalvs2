-- AlterEnum
ALTER TYPE "MessageEvent" ADD VALUE 'FRIEND_INVITATION';

-- CreateTable
CREATE TABLE "sent_invitations" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "sent_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sent_invitations_inviterId_idx" ON "sent_invitations"("inviterId");

-- AddForeignKey
ALTER TABLE "sent_invitations" ADD CONSTRAINT "sent_invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
