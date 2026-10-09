-- Additiv: nullable emailHash (HMAC-SHA256) til opslag, mens User.email/displayName
-- krypteres i appen. Raekker backfilles af scripts/encrypt-user-data/backfill.cjs.
-- Rettet 2026-10-07: tabellen hedder "users" (@@map), ikke "User" — den
-- oprindelige version fejlede i produktion. Idempotent, da den koeres igen.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailHash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_emailHash_key" ON "users"("emailHash");
