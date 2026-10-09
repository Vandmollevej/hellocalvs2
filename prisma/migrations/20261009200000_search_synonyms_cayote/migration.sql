-- cayote = kayote (100 %)
INSERT INTO "search_synonyms" ("id", "language", "termA", "termB", "similarity", "updatedAt") VALUES
  (gen_random_uuid()::text, 'DA', 'cayote', 'kayote', 100, CURRENT_TIMESTAMP)
ON CONFLICT ("language", "termA", "termB") DO NOTHING;
