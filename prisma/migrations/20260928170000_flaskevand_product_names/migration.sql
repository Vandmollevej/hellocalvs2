-- Punkt 7: emballerede varer med produkttypen "Vand" hedder "Flaskevand",
-- så søgeresultatet ikke forveksles med vandregistreringen. Kun navne, der
-- starter med ordet "Vand" alene; registreringers snapshots røres ikke.
UPDATE "products"
SET "name" = 'Flaskevand' || substr("name", 5)
WHERE "name" ~* '^vand(\s|$)';
