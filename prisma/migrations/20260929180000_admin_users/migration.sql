-- CreateEnum
CREATE TYPE "AdminAccessLevel" AS ENUM ('READ', 'FULL');
CREATE TYPE "AdminLoginOutcome" AS ENUM ('SUCCESS', 'PASSWORD_FAILED', 'CODE_FAILED', 'IP_BLOCKED', 'APPROVAL_SENT', 'APPROVED', 'DISABLED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "adminAccessLevel" "AdminAccessLevel" NOT NULL DEFAULT 'FULL',
ADD COLUMN "adminDisabledAt" TIMESTAMP(3),
ADD COLUMN "adminSessionsValidFrom" TIMESTAMP(3),
ADD COLUMN "adminAllowedIps" TEXT;

-- CreateTable
CREATE TABLE "admin_invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessLevel" "AdminAccessLevel" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedUserId" TEXT,
    "acceptSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ip" TEXT,
    "country" TEXT,
    "city" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "admin_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_login_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outcome" "AdminLoginOutcome" NOT NULL,
    "method" TEXT NOT NULL,
    "ip" TEXT,
    "country" TEXT,
    "city" TEXT,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_login_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_login_approvals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "ip" TEXT,
    "country" TEXT,
    "city" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_login_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_invites_tokenHash_key" ON "admin_invites"("tokenHash");
CREATE INDEX "admin_invites_email_idx" ON "admin_invites"("email");
CREATE UNIQUE INDEX "admin_devices_userId_deviceId_key" ON "admin_devices"("userId", "deviceId");
CREATE INDEX "admin_login_events_userId_createdAt_idx" ON "admin_login_events"("userId", "createdAt");
CREATE INDEX "admin_login_events_createdAt_idx" ON "admin_login_events"("createdAt");
CREATE UNIQUE INDEX "admin_login_approvals_tokenHash_key" ON "admin_login_approvals"("tokenHash");

-- AddForeignKey
ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_devices" ADD CONSTRAINT "admin_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_login_events" ADD CONSTRAINT "admin_login_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_login_approvals" ADD CONSTRAINT "admin_login_approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
