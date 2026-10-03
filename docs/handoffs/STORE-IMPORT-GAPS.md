# Bilka + REMA-importen: alt fra arkene med (overlevering 2026-10-02)

Branch: `claude/store-import-all-products` (WIP, ikke flettet i master, intet deployet).
Sessionen stoppede på forbrugsgrænsen midt i arbejdet. Live-data er uændret.

## Brugerens beslutninger (spørgeboks 2026-10-02)

- **Varer uden næring:** "Det er lige meget om de har protein mv. med. Så tager vi det fra
  Frida senere." → alle varer skal med; næring hentes fra Frida i en senere opgave.
- **Vitaminer:** hentes fra Bilka med et tillægs-script, som brugeren selv kører.
- **REMA "Sukkerfri":** kun varer med højst 0,5 g sukker; resten får nøgleordet
  "Uden tilsat sukker".

## Hvor data ligger

- Arkene og billederne er flyttet til NAS-sharet
  `\\192.168.1.90\Hello Cal\Arkiv - historiske kilde- og importfiler\Oprydning 2026-09-29\`
  (`build_data.py` finder det selv; ellers `HELLO_CAL_ROOT`).
- Importmappen: `\\192.168.1.90\docker\App\hellocal-v2\data\store-products-import\`
  (live-kataloget fra 2026-09-28: 10.524 varer, 7.218 billeder).

## Færdigt på branchen

- `scripts/store-products-import/build_data.py`: energi-reparation (kJ 1,105 → 1105 på
  ca. 4.900 varer, byttede kolonner, 25 kcal-rettelser hvor kJ og makroer er enige mod
  arkets kcal), info-arkenes "Labels" og oprindelsesland, REMA `fat`-ord som nøgleord,
  sukkerfri-reglen (44 varer), navne som "0"/"M appelsin" rettet (129 varer), alle rækker
  bygges: `nutritionMissing` (2.364) og `estimatedMacros` (151), rækker uden EAN får
  `externalId` (107), `--images-from` genbruger billedfelter fra forrige katalog,
  vitaminer læses fra `Productdatabase/Bilka/bilka_vitamins.xlsx`, hvis filen findes.
- `scripts/store-products-import/agent.py`: skjulte varer (ingen stregkode-række, 0 som
  pladsholder), eksisterende vare beholder sin næring, skjult dublet fjernes, kJ
  overskrives altid, admin-gennemgang bevares når kun kJ ændres, vitaminer skrives til
  `micronutrientsPer100g` som LABEL, manglende makroer markeres ESTIMATED.
- `prisma`: `Product.nutritionMissing` + migration `20261002213000_product_nutrition_missing`.
- Testet mod en lokal PostgreSQL med alle migrationer (gammelt katalog → nyt katalog,
  13.039 varer, 0 fejl, alle kontroller grønne efter sidste rettelse af kJ under 10).

## Mangler (i denne rækkefølge)

1. App-koden: `nutritionMissing: false` i de brugerrettede opslag med `discontinued: false`
   (`api/products/route.ts`, `products/recognize-text`, `products/match-nutrition`,
   `products/generic-candidates`, `ai/recognize-product-photo`, `ai/interpret-meal`,
   `ai/analyze-meal-photo`, `shared-recipes/route.ts`, `admin/search-ranking/preview`);
   `api/products/[id]` skal sende `hasKnownNutrition: false`, og `AddProductView` vise
   "Næringsindhold ukendt" også for varer; admin (ProductTablesPanel + produktlisten)
   skal vise "Mangler næring" i stedet for 0 kcal. Derefter lint + typecheck + build.
2. Vitamin-script `bilka_vitamins.py` (Playwright, klik på "Info om vitaminer og
   mineraler", checkpoints i Temp, output `bilka_vitamins.xlsx` med kolonnerne i
   `VITAMIN_COLUMNS` i build_data.py + "Source URL"), lægges også i Bilka-mappen på NAS'en.
3. Byg hele kataloget: `py build_data.py --all --out <mappe> --images-from <NAS-json>`,
   kopiér JSON + de nye varers billeder til importmappen.
4. Docs: `PRODUCT_IMPORT_MAPPING.md`, `DECISIONS.md` (2026-10-02 "Butiksimporten: alt fra
   arkene med"), `STATUS.md`, og en række i `OPEN-TASKS.md` for Frida-opgaven.
5. Flet i master (migrationen køres af deployet, agenten importerer ved start) og
   kontrollér i admin → Cron-jobs: "Imported/updated 13039 of 13039 … hidden".

## Senere (brugerens plan)

- Næring fra Frida til de skjulte varer (`WHERE "nutritionMissing"`): udfyld, sæt
  `nutritionMissing = false` og opret stregkode-rækken.
- Brugeren kører vitamin-scriptet; derefter ny bygning + import.
