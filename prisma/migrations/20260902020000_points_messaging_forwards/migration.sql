-- CreateEnum
CREATE TYPE "PointsReason" AS ENUM ('PRODUCT_APPROVED', 'PRODUCT_INGREDIENTS_BONUS', 'PRODUCT_PHOTOS_BONUS', 'BUG_REPORT_APPROVED', 'FRIEND_FORWARD_FULFILLED', 'FRIEND_REFERRAL', 'FREE_MONTH_REDEEMED');

-- CreateEnum
CREATE TYPE "BugReportStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MessageEvent" AS ENUM ('ACCOUNT_CREATED', 'EMAIL_VERIFICATION', 'PASSWORD_RESET', 'FRIEND_REFERRAL', 'PRODUCT_APPROVED', 'PRODUCT_REJECTED', 'PRODUCT_ESCALATION_ADMIN', 'BUG_REPORT_ESCALATION_ADMIN', 'BUG_REPORT_RESOLVED', 'POINTS_AWARDED', 'FRIEND_FORWARD_RECEIVED');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'PUSH', 'BOTH');

-- CreateEnum
CREATE TYPE "OutboundStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ForwardStatus" AS ENUM ('PENDING', 'OPENED', 'FULFILLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ForwardKind" AS ENUM ('PRODUCT', 'DISH');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "forwardAbuseFlaggedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "products" ADD COLUMN "approvalToken" TEXT;
ALTER TABLE "products" ADD COLUMN "escalationSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "points_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" "PointsReason" NOT NULL,
    "amount" INTEGER NOT NULL,
    "productId" TEXT,
    "bugReportId" TEXT,
    "forwardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "screenshotUrl" TEXT,
    "status" "BugReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "approvalToken" TEXT,
    "escalationSentAt" TIMESTAMP(3),

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "event" "MessageEvent" NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'EMAIL',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "pushTitle" TEXT,
    "pushBody" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "toEmail" TEXT,
    "event" "MessageEvent" NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "status" "OutboundStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" "MessageEvent" NOT NULL,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forwards" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "kind" "ForwardKind" NOT NULL,
    "productId" TEXT,
    "dishId" TEXT,
    "status" "ForwardStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "forwards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_approvalToken_key" ON "products"("approvalToken");

-- CreateIndex
CREATE INDEX "points_transactions_userId_idx" ON "points_transactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bug_reports_approvalToken_key" ON "bug_reports"("approvalToken");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_event_key" ON "message_templates"("event");

-- CreateIndex
CREATE INDEX "outbound_messages_status_idx" ON "outbound_messages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_event_key" ON "notification_preferences"("userId", "event");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "forwards_token_key" ON "forwards"("token");

-- CreateIndex
CREATE INDEX "forwards_senderId_idx" ON "forwards"("senderId");

-- CreateIndex
CREATE INDEX "forwards_recipientId_idx" ON "forwards"("recipientId");

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_bugReportId_fkey" FOREIGN KEY ("bugReportId") REFERENCES "bug_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_forwardId_fkey" FOREIGN KEY ("forwardId") REFERENCES "forwards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwards" ADD CONSTRAINT "forwards_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwards" ADD CONSTRAINT "forwards_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwards" ADD CONSTRAINT "forwards_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwards" ADD CONSTRAINT "forwards_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
