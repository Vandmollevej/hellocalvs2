-- Startbonus med tilbagevirkende kraft (ejerens valg 2026-10-03): alle
-- eksisterende almindelige brugere får 35 points én gang. Egen migration,
-- fordi den nye enum-værdi ikke kan bruges i samme transaktion, som tilføjer
-- den. Admin-konti, glemte brugere og familieprofiler oprettet af betaleren
-- (family_members."createdById" sat) springes over — som i awardSignupBonus().
INSERT INTO "points_transactions" ("id", "userId", "reason", "amount", "createdAt")
SELECT replace(gen_random_uuid()::text, '-', ''), u."id", 'SIGNUP_BONUS', 35, NOW()
FROM "users" u
WHERE u."role" = 'USER'
  AND u."forgottenAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "family_members" fm
    WHERE fm."userId" = u."id" AND fm."createdById" IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM "points_transactions" pt
    WHERE pt."userId" = u."id" AND pt."reason" = 'SIGNUP_BONUS'
  );
