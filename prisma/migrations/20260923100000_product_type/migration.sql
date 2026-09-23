-- Produkttype (navneord, fx "Skyr") som selvstændig kolonne på Product —
-- se docs/DECISIONS.md 2026-09-23. Produktnavnet (name) sammensættes af
-- Sub brand + Produkttype + Variant. Hand-written, same reason as other
-- recent migrations in this project — no local PostgreSQL reachable from
-- this workstation to run `prisma migrate dev`.

-- AlterTable
ALTER TABLE "products" ADD COLUMN "productType" TEXT;
