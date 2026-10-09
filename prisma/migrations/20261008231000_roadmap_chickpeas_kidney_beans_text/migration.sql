-- Præciserer roadmap-punktet om kikærter og kidneybønner: brugeren skal selv
-- tjekke billedet først.
UPDATE "roadmap_items"
SET "title" = 'Tjek billederne af kikærter og røde kidneybønner: dåse eller tørrede?',
    "description" = 'Brugeren skal selv kigge på billederne af "Kikærter" og "Røde Kidneybønner" (REMA) for at afgøre, om varerne er på dåse eller tørrede. Emballagefeltet i arket siger "Konserves", men det er sandsynligvis forkert. Indtil billedet er tjekket, skal varerne ikke markeres som konserves.'
WHERE "id" = 'roadmap_chickpeas_kidney_beans';