-- Produktkategori (docs/DECISIONS.md, 2026-09-24): drikkevare vises i ml/cl,
-- alt andet i g. Hand-written, same reason as other recent migrations in this
-- project — no local PostgreSQL reachable from this workstation to run
-- `prisma migrate dev`.
CREATE TYPE "ProductCategory" AS ENUM ('DRINK', 'GENERIC', 'PROCESSED', 'RAW', 'INGREDIENT');

ALTER TABLE "products" ADD COLUMN "productCategory" "ProductCategory";
