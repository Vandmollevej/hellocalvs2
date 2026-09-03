-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('DA', 'EN');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'TRIALING', 'FREE_MONTH', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('REEPAY', 'QUICKPAY', 'STRIPE', 'MOBILEPAY_ONLINE');

-- CreateEnum
CREATE TYPE "PaymentMethodBrand" AS ENUM ('VISA', 'MASTERCARD', 'APPLE_PAY', 'GOOGLE_PAY', 'MOBILEPAY');

-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('IMPERSONATE_USER', 'GDPR_FORGET_USER');

-- AlterEnum (add new PointsReason values used by referral + redemption flows)
-- Already included directly in the CreateEnum statement of migration
-- 20260902020000_points_messaging_forwards (edited before this migration was
-- written, since that migration had not been applied anywhere yet).

-- AlterTable: users.locale
ALTER TABLE "users" ADD COLUMN "locale" "Locale" NOT NULL DEFAULT 'DA';

-- AlterTable: users.forgottenAt
ALTER TABLE "users" ADD COLUMN "forgottenAt" TIMESTAMP(3);

-- AlterTable: users.referralCode (backfilled for existing rows, then made
-- required + unique, since Prisma's @default(cuid()) is a client-side
-- default with no direct SQL equivalent).
ALTER TABLE "users" ADD COLUMN "referralCode" TEXT;
UPDATE "users" SET "referralCode" = replace(gen_random_uuid()::text, '-', '') WHERE "referralCode" IS NULL;
ALTER TABLE "users" ALTER COLUMN "referralCode" SET NOT NULL;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "provider" "PaymentProvider",
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "freeMonthsRemaining" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "brand" "PaymentMethodBrand" NOT NULL,
    "last4" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "providerPaymentMethodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "targetUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "payment_methods_userId_idx" ON "payment_methods"("userId");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
