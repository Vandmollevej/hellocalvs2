-- "Luk konto" kan fortrydes i 3 måneder (docs/DECISIONS.md 2026-10-03).
ALTER TABLE "users" ADD COLUMN "closedAt" TIMESTAMP(3);

ALTER TYPE "AdminAuditAction" ADD VALUE 'USER_CLOSE_ACCOUNT';
ALTER TYPE "AdminAuditAction" ADD VALUE 'USER_REOPEN_ACCOUNT';
