-- "Indberet fejl": fire ikon-knapper (EAN/energi/indhold/produktbillede) lader
-- brugeren tagge hvilken del af produktdata der er forkert. Hand-written,
-- same reason as other recent migrations in this project — no local
-- PostgreSQL reachable from this workstation to run `prisma migrate dev`.
CREATE TYPE "BugReportCategory" AS ENUM ('EAN', 'ENERGY', 'CONTENT', 'PRODUCT_IMAGE');

ALTER TABLE "bug_reports" ADD COLUMN "categories" "BugReportCategory"[] NOT NULL DEFAULT '{}';
