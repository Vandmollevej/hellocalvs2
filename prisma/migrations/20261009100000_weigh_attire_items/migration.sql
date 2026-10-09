-- AlterTable
ALTER TABLE "weight_entries" ADD COLUMN "attireItems" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Udled de enkelte valg af det gamle ene valg (NAKED = ingen valg).
UPDATE "weight_entries" SET "attireItems" = ARRAY['UNDERWEAR']::TEXT[] WHERE "attire" = 'UNDERWEAR';
UPDATE "weight_entries" SET "attireItems" = ARRAY['UNDERWEAR','PANTS','TOP']::TEXT[] WHERE "attire" = 'CLOTHED';
UPDATE "weight_entries" SET "attireItems" = ARRAY['UNDERWEAR','PANTS','TOP','POCKET_ITEMS']::TEXT[] WHERE "attire" = 'CLOTHED_PHONE';
