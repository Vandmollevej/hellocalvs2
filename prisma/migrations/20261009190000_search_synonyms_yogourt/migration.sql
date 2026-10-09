-- yogourt = yogurt = yoghurt (100 %); bolcher/bolsjer findes allerede som 100 %
INSERT INTO "search_synonyms" ("id", "language", "termA", "termB", "similarity", "updatedAt") VALUES
  (gen_random_uuid()::text, 'DA', 'yogourt', 'yogurt', 100, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'DA', 'yogourt', 'yoghurt', 100, CURRENT_TIMESTAMP)
ON CONFLICT ("language", "termA", "termB") DO NOTHING;
