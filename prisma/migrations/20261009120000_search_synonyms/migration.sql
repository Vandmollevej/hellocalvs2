-- CreateTable
CREATE TABLE "search_synonyms" (
    "id" TEXT NOT NULL,
    "language" "Locale" NOT NULL DEFAULT 'DA',
    "termA" TEXT NOT NULL,
    "termB" TEXT NOT NULL,
    "similarity" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_synonyms_language_termA_termB_key" ON "search_synonyms"("language", "termA", "termB");

-- CreateIndex
CREATE INDEX "search_synonyms_termA_idx" ON "search_synonyms"("termA");

-- CreateIndex
CREATE INDEX "search_synonyms_termB_idx" ON "search_synonyms"("termB");

-- Seed examples
INSERT INTO "search_synonyms" ("id", "language", "termA", "termB", "similarity", "updatedAt") VALUES
  ('syn_da_gris_svin', 'DA', 'gris', 'svin', 100, CURRENT_TIMESTAMP),
  ('syn_da_ko_okse', 'DA', 'ko', 'okse', 80, CURRENT_TIMESTAMP),
  ('syn_da_porter_stout', 'DA', 'porter', 'stout', 90, CURRENT_TIMESTAMP),
  ('syn_da_ipa_indian_pale_ale', 'DA', 'indian pale ale', 'ipa', 100, CURRENT_TIMESTAMP),
  ('syn_en_porter_stout', 'EN', 'porter', 'stout', 90, CURRENT_TIMESTAMP),
  ('syn_en_ipa_indian_pale_ale', 'EN', 'indian pale ale', 'ipa', 100, CURRENT_TIMESTAMP),
  ('syn_en_pig_pork', 'EN', 'pig', 'pork', 90, CURRENT_TIMESTAMP),
  ('syn_en_cow_beef', 'EN', 'beef', 'cow', 80, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
