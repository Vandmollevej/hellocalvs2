-- Privacy-by-architecture (docs/PRIVACY.md, docs/DECISIONS.md 2026-09-23).
-- Genereret med prisma migrate diff mod HEAD-schema (ingen lokal PostgreSQL).

-- CreateEnum
CREATE TYPE "KeyEnvelopeKind" AS ENUM ('PASSKEY_PRF', 'RECOVERY');

-- CreateEnum
CREATE TYPE "RecoveryRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EmailLinkPurpose" AS ENUM ('SIGNUP', 'RECOVERY');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailHash" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "displayName" SET DEFAULT '';

-- CreateTable
CREATE TABLE "key_envelopes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "KeyEnvelopeKind" NOT NULL,
    "credentialId" TEXT,
    "prfSalt" TEXT,
    "iv" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "key_envelopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_shares" (
    "userId" TEXT NOT NULL,
    "serverShare" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_shares_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "recovery_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "status" "RecoveryRequestStatus" NOT NULL DEFAULT 'PENDING',
    "releaseTokenHash" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_link_tokens" (
    "id" TEXT NOT NULL,
    "purpose" "EmailLinkPurpose" NOT NULL,
    "emailHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaults" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_records" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_inboxes" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_inboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_inbox_items" (
    "id" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "epk" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "key_envelopes_credentialId_key" ON "key_envelopes"("credentialId");

-- CreateIndex
CREATE INDEX "key_envelopes_userId_kind_idx" ON "key_envelopes"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_requests_caseCode_key" ON "recovery_requests"("caseCode");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_requests_releaseTokenHash_key" ON "recovery_requests"("releaseTokenHash");

-- CreateIndex
CREATE INDEX "recovery_requests_status_idx" ON "recovery_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "email_link_tokens_tokenHash_key" ON "email_link_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "email_link_tokens_emailHash_idx" ON "email_link_tokens"("emailHash");

-- CreateIndex
CREATE INDEX "vault_records_vaultId_updatedAt_idx" ON "vault_records"("vaultId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "vault_records_vaultId_tag_recordId_key" ON "vault_records"("vaultId", "tag", "recordId");

-- CreateIndex
CREATE INDEX "vault_inbox_items_inboxId_createdAt_idx" ON "vault_inbox_items"("inboxId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailHash_key" ON "users"("emailHash");

-- AddForeignKey
ALTER TABLE "key_envelopes" ADD CONSTRAINT "key_envelopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_shares" ADD CONSTRAINT "recovery_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_requests" ADD CONSTRAINT "recovery_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_requests" ADD CONSTRAINT "recovery_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_records" ADD CONSTRAINT "vault_records_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_inbox_items" ADD CONSTRAINT "vault_inbox_items_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "vault_inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

