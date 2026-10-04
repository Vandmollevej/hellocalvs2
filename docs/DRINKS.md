# Drinks

Ny tilføjelseskategori (2026-10-04). Web og app deler samme sider.

- Tilføj-menuen (`/add/menu`, `ADD_ACTIONS` i `src/lib/add-actions.ts`): "Drinks" er altid nederste punkt.
- `/drinks`: gitter over aktive drinks. `/drinks/[id]`: billede i cirkel øverst (som varesiden), derefter ÉN skyder pr. ingrediens, startende på `defaultAmount`.
- Gem → `POST /api/drinks/log` → én `Registration` (snapshot): titel = drinkens navn, summeret næring beregnet på serveren (`src/lib/drinks.ts`), `amountGrams` = samlet ml.
- Datamodel: `Drink` + `DrinkIngredient` (migration `20261004100000_drinks`).

## Regneark → database (kommer)

Brugeren udfylder et regneark; import-scriptet er ikke skrevet endnu. Forventet format, én række pr. ingrediens:

| Kolonne | Betydning |
| --- | --- |
| drink | Drinkens navn (gentages for hver ingrediens) |
| imageUrl | Billede (kun på første række pr. drink) |
| ingredient | Ingrediensens navn |
| unit | cl (standard) / dl / ml |
| default | Standardmængde = skyderens startværdi |
| min / max / step | Skyderens grænser og trin |
| kcal, protein, carbs, fat, sugar | Pr. 100 ml af ingrediensen |
| alcoholPercent | Vol.-% (gemmes til senere alkoholstatistik) |
