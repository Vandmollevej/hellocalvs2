-- B2B-brugere (docs/DECISIONS.md 2026-10-02): login til partnerportalen,
-- oprettes kun af en administrator via invitation.
CREATE TABLE IF NOT EXISTS "partner_users" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "sessionsValidFrom" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "partner_users_email_key" ON "partner_users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "partner_users_inviteTokenHash_key" ON "partner_users"("inviteTokenHash");
CREATE INDEX IF NOT EXISTS "partner_users_partnerId_idx" ON "partner_users"("partnerId");

DO $$ BEGIN
  ALTER TABLE "partner_users" ADD CONSTRAINT "partner_users_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "partner_users" ADD CONSTRAINT "partner_users_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
