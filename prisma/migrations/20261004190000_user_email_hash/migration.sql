-- Additiv: nullable emailHash (HMAC-SHA256) til opslag, mens User.email/displayName
-- krypteres i appen. Raekker backfilles af scripts/encrypt-user-data/backfill.cjs.
ALTER TABLE "User" ADD COLUMN "emailHash" TEXT;
CREATE UNIQUE INDEX "User_emailHash_key" ON "User"("emailHash");
