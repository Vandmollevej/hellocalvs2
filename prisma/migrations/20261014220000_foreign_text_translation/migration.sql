-- Varetekst på fremmedsprog (docs/DECISIONS.md 2026-10-14): originalerne for
-- alle oversatte felter, sproget varen er oversat til, oversættelser til
-- andre app-sprog, og brugerens kontakt under Visning.
ALTER TABLE "products" ADD COLUMN "textOriginals" JSONB;
ALTER TABLE "products" ADD COLUMN "translationTargetLang" TEXT;
ALTER TABLE "products" ADD COLUMN "textTranslations" JSONB;

ALTER TABLE "users" ADD COLUMN "translateForeignText" BOOLEAN NOT NULL DEFAULT true;
