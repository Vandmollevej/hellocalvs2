-- Login-godkendelse via push (docs/DECISIONS.md 2026-10-03).
ALTER TABLE "users" ADD COLUMN "loginApprovalEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "login_approvals" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "device" TEXT NOT NULL,
  "country" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "login_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_approvals_userId_status_idx" ON "login_approvals"("userId", "status");
