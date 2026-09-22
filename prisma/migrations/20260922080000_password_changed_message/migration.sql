-- Skift adgangskode (docs/DECISIONS.md, 2026-09-22).
-- Hand-written, same reason as other recent migrations in this project — no
-- local PostgreSQL reachable from this workstation to run `prisma migrate dev`.

-- AlterEnum: add PASSWORD_CHANGED to the existing MessageEvent enum.
ALTER TYPE "MessageEvent" ADD VALUE 'PASSWORD_CHANGED';
