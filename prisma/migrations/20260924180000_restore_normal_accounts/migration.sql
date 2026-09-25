-- Almindelige konti igen (docs/DECISIONS.md 2026-09-24 "Normalt login").
-- Den krypterede boks, passkey-only-login, gendannelsesfil, anonym
-- statistik og supportpakker fjernes. Brugerdata ligger i de almindelige
-- tabeller, som aldrig blev slettet. Nyt: Google/Apple/Facebook-konti,
-- kendte enheder (advarsel ved nyt login) og favoritter på delte retter.

-- Konti oprettet med passkey-only har ingen e-mail; de får en ugyldig
-- pladsholder, så kolonnen kan blive NOT NULL igen uden at slette noget.
UPDATE "users" SET "email" = 'no-email+' || "id" || '@invalid.hellocal' WHERE "email" IS NULL;
UPDATE "users" SET "displayName" = '' WHERE "displayName" IS NULL;
UPDATE "doctor_shares" SET "name" = '' WHERE "name" IS NULL;
UPDATE "doctor_shares" SET "email" = '' WHERE "email" IS NULL;

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'APPLE', 'FACEBOOK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageEvent" ADD VALUE 'NEW_DEVICE_LOGIN';
ALTER TYPE "MessageEvent" ADD VALUE 'ADMIN_MESSAGE';

-- DropForeignKey
ALTER TABLE "key_envelopes" DROP CONSTRAINT "key_envelopes_userId_fkey";

-- DropForeignKey
ALTER TABLE "recovery_shares" DROP CONSTRAINT "recovery_shares_userId_fkey";

-- DropForeignKey
ALTER TABLE "recovery_requests" DROP CONSTRAINT "recovery_requests_userId_fkey";

-- DropForeignKey
ALTER TABLE "recovery_requests" DROP CONSTRAINT "recovery_requests_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "vault_records" DROP CONSTRAINT "vault_records_vaultId_fkey";

-- DropForeignKey
ALTER TABLE "vault_inbox_items" DROP CONSTRAINT "vault_inbox_items_inboxId_fkey";

-- DropForeignKey
ALTER TABLE "invite_links" DROP CONSTRAINT "invite_links_inviterId_fkey";

-- DropForeignKey
ALTER TABLE "invite_rewards" DROP CONSTRAINT "invite_rewards_userId_fkey";

-- DropForeignKey
ALTER TABLE "support_packages" DROP CONSTRAINT "support_packages_grantId_fkey";

-- DropIndex
DROP INDEX "users_emailHash_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "emailHash",
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "displayName" DROP DEFAULT;

-- AlterTable
ALTER TABLE "integrations" DROP COLUMN "inboxId";

-- AlterTable
ALTER TABLE "device_tokens" DROP COLUMN "inboxId";

-- AlterTable
ALTER TABLE "product_nutrition_reports" DROP COLUMN "replyInboxId",
ADD COLUMN     "reporterUserId" TEXT;

-- AlterTable
ALTER TABLE "dishes" ADD COLUMN     "sharedRecipeId" TEXT;

-- AlterTable
ALTER TABLE "forwards" DROP COLUMN "payloadCiphertext",
DROP COLUMN "payloadIv",
ADD COLUMN     "recipientId" TEXT;

-- AlterTable
ALTER TABLE "doctor_shares" DROP COLUMN "snapshotCiphertext",
DROP COLUMN "snapshotIv",
DROP COLUMN "snapshotUpdatedAt",
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- DropTable
DROP TABLE "key_envelopes";

-- DropTable
DROP TABLE "recovery_shares";

-- DropTable
DROP TABLE "recovery_requests";

-- DropTable
DROP TABLE "email_link_tokens";

-- DropTable
DROP TABLE "vaults";

-- DropTable
DROP TABLE "vault_records";

-- DropTable
DROP TABLE "vault_inboxes";

-- DropTable
DROP TABLE "vault_inbox_items";

-- DropTable
DROP TABLE "invite_links";

-- DropTable
DROP TABLE "invite_rewards";

-- DropTable
DROP TABLE "newsletter_subscriptions";

-- DropTable
DROP TABLE "support_keys";

-- DropTable
DROP TABLE "support_packages";

-- DropTable
DROP TABLE "analytics_buckets";

-- DropTable
DROP TABLE "product_usage_daily";

-- DropEnum
DROP TYPE "KeyEnvelopeKind";

-- DropEnum
DROP TYPE "RecoveryRequestStatus";

-- DropEnum
DROP TYPE "EmailLinkPurpose";

-- CreateTable
CREATE TABLE "shared_recipe_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "recipe" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_recipe_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_oauth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "user_oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_known_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "country" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_known_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shared_recipe_favorites_userId_recipeId_key" ON "shared_recipe_favorites"("userId", "recipeId");

-- CreateIndex
CREATE INDEX "user_oauth_accounts_userId_idx" ON "user_oauth_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_oauth_accounts_provider_providerAccountId_key" ON "user_oauth_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "user_known_devices_userId_deviceHash_key" ON "user_known_devices"("userId", "deviceHash");

-- CreateIndex
CREATE INDEX "forwards_recipientId_idx" ON "forwards"("recipientId");

-- AddForeignKey
ALTER TABLE "product_nutrition_reports" ADD CONSTRAINT "product_nutrition_reports_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwards" ADD CONSTRAINT "forwards_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_recipe_favorites" ADD CONSTRAINT "shared_recipe_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_oauth_accounts" ADD CONSTRAINT "user_oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_known_devices" ADD CONSTRAINT "user_known_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

