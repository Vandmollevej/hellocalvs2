-- "Inviter familiemedlem": betaleren vælger pr. profil "se" eller "se og
-- oprette på deres vegne". grantSubjectIds er fortsat "se"; denne liste er de
-- af dem, personen også må oprette for (docs/DECISIONS.md 2026-10-03).
ALTER TABLE "family_login_codes" ADD COLUMN "grantWriteSubjectIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
