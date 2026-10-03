-- B2B-brugere: obligatorisk 2-faktor (TOTP), docs/DECISIONS.md 2026-10-02.
ALTER TABLE "partner_users" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
