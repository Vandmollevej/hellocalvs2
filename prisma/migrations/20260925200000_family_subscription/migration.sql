-- Familieabonnement og børneprofiler (docs/FAMILY.md, docs/DECISIONS.md 2026-09-25).
-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('INDIVIDUAL', 'FAMILY');

-- CreateEnum
CREATE TYPE "ProfileAccessAction" AS ENUM ('OPENED', 'VIEWED', 'CREATED', 'UPDATED', 'DELETED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accessLogSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "plan" "SubscriptionPlan" NOT NULL DEFAULT 'INDIVIDUAL';

-- CreateTable
CREATE TABLE "families" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isChild" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_access_grants" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "granteeId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_login_codes" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "profileId" TEXT,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_access_logs" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "ProfileAccessAction" NOT NULL,
    "area" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "families_ownerId_key" ON "families"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_userId_key" ON "family_members"("userId");

-- CreateIndex
CREATE INDEX "family_members_familyId_idx" ON "family_members"("familyId");

-- CreateIndex
CREATE INDEX "family_access_grants_subjectId_idx" ON "family_access_grants"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "family_access_grants_granteeId_subjectId_key" ON "family_access_grants"("granteeId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "family_login_codes_codeHash_key" ON "family_login_codes"("codeHash");

-- CreateIndex
CREATE INDEX "family_login_codes_profileId_idx" ON "family_login_codes"("profileId");

-- CreateIndex
CREATE INDEX "profile_access_logs_subjectId_createdAt_idx" ON "profile_access_logs"("subjectId", "createdAt");

-- AddForeignKey
ALTER TABLE "families" ADD CONSTRAINT "families_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_access_grants" ADD CONSTRAINT "family_access_grants_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_access_grants" ADD CONSTRAINT "family_access_grants_granteeId_fkey" FOREIGN KEY ("granteeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_access_grants" ADD CONSTRAINT "family_access_grants_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_login_codes" ADD CONSTRAINT "family_login_codes_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_login_codes" ADD CONSTRAINT "family_login_codes_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_access_logs" ADD CONSTRAINT "profile_access_logs_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_access_logs" ADD CONSTRAINT "profile_access_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

