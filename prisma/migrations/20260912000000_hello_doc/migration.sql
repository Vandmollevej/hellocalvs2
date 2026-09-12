-- Hello Doc: del fremgang med læge/diætist (docs/DECISIONS.md 2026-09-12).
-- Hand-written, same reason as other recent migrations in this project — no
-- local PostgreSQL reachable from this workstation to run `prisma migrate dev`.

-- AlterEnum
ALTER TYPE "MessageEvent" ADD VALUE 'DOCTOR_SHARE_INVITATION';

-- CreateEnum
CREATE TYPE "DoctorShareStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DoctorShareHistoryRange" AS ENUM ('LAST_7_DAYS', 'LAST_MONTH', 'LAST_YEAR', 'ALL');

-- CreateTable
CREATE TABLE "doctor_shares" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "DoctorShareStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "historyRange" "DoctorShareHistoryRange" NOT NULL DEFAULT 'ALL',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "doctor_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_shares_token_key" ON "doctor_shares"("token");

-- CreateIndex
CREATE INDEX "doctor_shares_ownerId_idx" ON "doctor_shares"("ownerId");

-- AddForeignKey
ALTER TABLE "doctor_shares" ADD CONSTRAINT "doctor_shares_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
