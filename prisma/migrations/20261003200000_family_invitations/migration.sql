-- "Inviter familiemedlem" (docs/FAMILY.md 2026-10-03): invitation pr. mail
-- med modtagerens navn, e-mail og de profiler, personen får indsigt i.
ALTER TYPE "MessageEvent" ADD VALUE IF NOT EXISTS 'FAMILY_INVITATION';

ALTER TABLE "family_login_codes"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "inviteeName" TEXT,
  ADD COLUMN "grantSubjectIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
