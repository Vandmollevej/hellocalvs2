-- "Inviter familiemedlem" (docs/FAMILY.md 2026-10-03): invitationen sendes
-- som mail med det krypterede tilknytningslink, og koden husker modtagerens
-- navn og de profiler, personen får indsigt i.
ALTER TYPE "MessageEvent" ADD VALUE IF NOT EXISTS 'FAMILY_INVITATION';

ALTER TABLE "family_login_codes"
  ADD COLUMN "inviteeName" TEXT,
  ADD COLUMN "grantSubjectIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
