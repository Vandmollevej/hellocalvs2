-- Roadmap-punkt (bruger 2026-10-08): undersøg om kikærter og kidneybønner er på
-- dåse eller tørrede. Datamigration, fordi roadmappen ligger i databasen.
INSERT INTO "roadmap_items" ("id", "title", "description", "status", "createdBy", "sortOrder")
SELECT 'roadmap_chickpeas_kidney_beans',
       'Undersøg kikærter og kidneybønner: dåse eller tørrede?',
       'Undersøg varerne "Kikærter" og "Røde Kidneybønner" (REMA, begge markeret "Konserves" i emballage-feltet) for at afgøre, om de er på dåse eller tørrede. Resultatet afgør nøgleord og billede på den generiske vare.',
       'PLANNED', 'Claude',
       COALESCE((SELECT MAX("sortOrder") + 1 FROM "roadmap_items" WHERE "status" = 'PLANNED'), 0)
ON CONFLICT ("id") DO NOTHING;