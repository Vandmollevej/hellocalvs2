-- Admin → Brugere → Tildel points (docs/DECISIONS.md 2026-10-03): points
-- givet manuelt af en administrator, fx som kompensation.
ALTER TYPE "PointsReason" ADD VALUE 'ADMIN_GRANT';
ALTER TYPE "AdminAuditAction" ADD VALUE 'ADMIN_GRANT_POINTS';

ALTER TABLE "points_transactions" ADD COLUMN "note" TEXT;
ALTER TABLE "points_transactions" ADD COLUMN "grantedById" TEXT;

CREATE INDEX "points_transactions_reason_createdAt_idx" ON "points_transactions"("reason", "createdAt");
