-- Additiv: nullable emailHash (HMAC-SHA256) til opslag, mens User.email/displayName
-- krypteres i appen. Raekker backfilles af scripts/encrypt-user-data/backfill.cjs.
-- Idempotent: foerste produktionskoersel (2026-10-06) fejlede og koeres igen.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailHash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_emailHash_key" ON "User"("emailHash");
