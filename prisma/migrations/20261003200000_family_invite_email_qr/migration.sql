-- Familiekoder bindes til en e-mail og kan vises igen som QR-kode; familien
-- kan få ekstra pladser (docs/DECISIONS.md 2026-10-03).
ALTER TABLE "families" ADD COLUMN "extraSeats" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "family_login_codes" ADD COLUMN "codeCipher" TEXT;
ALTER TABLE "family_login_codes" ADD COLUMN "email" TEXT;
