-- Låst start-vægt, ændring kun via e-mailverificeret engangslink (docs/DECISIONS.md, 2026-09-22).
-- Hand-written, same reason as other recent migrations in this project — no
-- local PostgreSQL reachable from this workstation to run `prisma migrate dev`.

-- AlterEnum
ALTER TYPE "MessageEvent" ADD VALUE 'START_WEIGHT_CHANGE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "startWeightUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "start_weight_change_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "start_weight_change_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "start_weight_change_tokens_tokenHash_key" ON "start_weight_change_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "start_weight_change_tokens_userId_idx" ON "start_weight_change_tokens"("userId");

-- CreateIndex
CREATE INDEX "start_weight_change_tokens_expiresAt_idx" ON "start_weight_change_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "start_weight_change_tokens" ADD CONSTRAINT "start_weight_change_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
