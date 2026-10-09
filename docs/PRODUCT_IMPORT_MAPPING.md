# Produktark → database: kolonne-mapping (Bilka + REMA 1000)

Beslutning: docs/DECISIONS.md 2026-09-27 "Butiksvarer i tre tabeller" og
2026-10-02 "Butiksimporten: alt fra arkene med".
Kode: `scripts/store-products-import/` (`build_data.py` lokalt → JSON,
`agent.py` på NAS'en → database). Hele kataloget bygges med
`py build_data.py --all --out <mappe> --images-from <forrige store_products.json>`
og kopieres til NAS'ens `data/store-products-import/` (kun nye varers billeder
ligger i `<mappe>/images`).

## Kilder

Arkene og billederne ligger siden 2026-10-02 på NAS-sharet
`\\192.168.1.90\Hello Cal\Arkiv - historiske kilde- og importfiler\Oprydning 2026-09-29\`
(`build_data.py` finder det selv; `HELLO_CAL_ROOT` kan pege et andet sted hen).

- `Produkter klar til import/Produktark/bilka.xlsx` (10.766 rækker)
- `Produkter klar til import/Produktark/rema1000_version 2.xlsx` (2.773 rækker)
- Næring/ingredienser: `Productdatabase/Bilka/bilka_product_information.xlsx`
  (join på EAN, rækker uden EAN på Source URL) og
  `Productdatabase/REMA1000/rema1000_product_information.xlsx` (join på Source URL)
- Vitaminer/mineraler: `Productdatabase/Bilka/bilka_vitamins.xlsx` fra
  `bilka_vitamins.py` (panelet "Info om vitaminer og mineraler"; join på Source URL).
  Brugeren kører scriptet selv; uden filen har ingen vare producentens vitaminer.
- Billeder: `Produkter klar til import/Færdige produktbilleder` (fritlagte,
  tag "Cutout") og `Productdatabase/Product Images` (originaler)

## Regler

- Arkene flettes ikke fysisk; én vare pr. EAN. Rækker uden EAN (107) får
  butikkens eget vare-id som nøgle (`bilka-144638`, `rema1000-411556`).
- Samme EAN i begge ark (500 stk.) = ét produkt med begge kæder.
- Bilka vinder ved uenighed; REMA udfylder tomme felter (fx energi,
  varedeklaration).
- Slettes en række som stregkode-gænger i et andet butiksark, skal den
  tabende butiks kæde altid gemmes på vinderen (Kæder/`product_stores`):
  skriv EAN + kæde i `scripts/store-products-import/data/store_links.json`.
  Agenten kobler ved hver kørsel; varer der endnu ikke er i databasen
  (SPAR/tyske ark) kobles, når de kommer ind. Overblik på NAS'en:
  `Productdatabase\Kaeder for slettede EAN-gengangere.xlsx`.
- En eksisterende vare med samme stregkode opdateres i stedet for at blive
  dubleret; har den næring fra andetsteds (bruger, Open Food Facts), beholder
  den sin næring, hvor arkene ingen har.
- Alle rækker kommer med (brugerens valg 2026-10-02). Uden kcal:
  `nutritionMissing` – 0 som pladsholder, skjult i appen og uden
  stregkode-række, til næringen er hentet (planlagt: Frida). Med kcal men
  uden protein/kulhydrat/fedt: den manglende makro er 0 og markeret
  ESTIMATED (~). I dag: 13.039 varer, heraf 2.364 skjulte og 151 med ~.
- Energi repareres pr. butik: kJ skrevet som 1,105 for 1105 (Bilka-arkets
  talformat), kJ og kcal i hinandens kolonner, kJ = 0 ved siden af kcal, og
  en kcal der modsiges af både kJ og makroerne (kcal rettes til kJ ÷ 4,184).
  Aldrig makro-dom på alkohol. Alle rettelser står i tjeklisten
  `Produktark/Tjekliste - mistænkelige rækker.csv`.
- Filterfelter er ikke ja/nej: tom = nej/ukendt, udfyldt = ja, og teksten er
  det ord/logo der vises ("Økologisk", i Tyskland "Biologisch").
  "Yes"/"Ja" fra arkene oversættes til det beskrivende ord.
- Drikkevarer (ml): Bilka "Drikkevarer", REMA "Drikkevare" eller en mængde
  i l/cl/ml – undtagen drikkeyoghurt. Alt andet: gram.
- Billeder: fritlagt > Bilka-original > REMA-original. Også ikke-fritlagte
  bruges nu og erstattes senere. Filerne bruges uændret i fuld opløsning
  (retina) og vises bag produktcirklens maske.
- Alle varianter i det vindende niveau (EAN, EAN_2, EAN_3, .jpg + .png …)
  gemmes som ekstra billeder med tag `Import` og vises under admin
  "Dubletter" → Produktbilleder, til admin har valgt.
- Varer i begge kæder får hver butiks egne felter i `product_source_records`
  (admin "Dubletter" → Produkter). Det admin har gennemgået, overskrives ikke.
- Senere: kun fritlagte PNG'er bryder cirklen – portræt 10 % over toppen,
  vandrette 10 % ud til højre (som HelloFresh).

## Tabel 1 – Basisinfo (`products` + `barcodes` + `product_stores` + `product_images`)

| Database | Bilka | REMA |
|---|---|---|
| name | HelloCal_Title uden ", mængde (Brand)"; er der kun et tal eller et løst "m" tilbage (varer opkaldt efter brandet: "Coca Cola", "Breezer m. appelsin"), Original Title. Første bogstav stort | Hello Cal product title uden brand foran |
| brand | Brand | Brand |
| subbrand | Subbrand | Subbrand |
| productType | Product Type | Product type |
| variant | Variation | Variant |
| flavor (ny) | Flavor (info-ark) | taste |
| packageSizeText | Quantity | Quantity |
| packCount (ny) | Pack Count | Amount ("6-pak" → 6) |
| productCategory (g/ml) | følger Hello Cal-kategorien | følger Hello Cal-kategorien |
| category | Hello Cal-kategoritræet (regler i build_data.py; Bilka-afdelingen bruges kun som hint) | Type bruges kun som hint |
| packaging (ny) | ord i titlen (dåse, flaske …) | is_Packaging (Konserves → Dåse, Brik → Karton, Bakke, Flaske) |
| barcodes | EAN | EAN |
| product_stores | Bilka | Rema 1000 |
| keywords (ny) | Keyword 1–5; Labels "Uden tilsat sukker" | Keyword 1, is_Packaging (Bakke, Brik, i Skiver, Færdigretter …), "Light", ikke-alkohol "%", ord i `fat` ("0 Kalorier", "Light", "Fedtreduceret"); Labels "Ikke tilsat sukker" → "Uden tilsat sukker" |
| ingredientsText | Ingredients (info-ark) | Ingredients (info-ark) |
| allergens | Allergens (info-ark) | Allergens (info-ark) |
| additives | E-Numbers (info-ark) | – |
| imageUrl + product_images | se regler | se regler |
| Bruges ikke | Original Title, Product Name*, Subtitle, Clean Subtitle, Manufacturer, Parse Status | Manufacturer, Parse status |

\* Product Name bruges kun, når oprydningen har skåret en forkortelse af
("u. tilsat sukker" → "u").

## Tabel 2 – Næring pr. 100 g/ml

- På `products` (appen læser dem dér): kcal, protein, kulhydrat, fedt,
  mættet fedt.
- I `product_nutrition_features`: sukkerarter, fiber, salt, kJ,
  enkeltumættet og flerumættet fedt, natrium, alkohol, B2 (mg), B12 (µg),
  calcium (mg), fosfor (mg).
- Vitaminer og mineraler (info-arkets fire kolonner + `bilka_vitamins.xlsx`)
  også i `products.micronutrientsPer100g` med kilde LABEL – det er dér,
  varesiden læser dem (nøgler som `src/lib/nutrients.ts`).
- "1.477" og 1,477 kJ læses som 1477 (se Regler). Umulige værdier (sukker >
  kulhydrat, mættet fedt > fedt) droppes.

## Tabel 3 – Filtre (`product_filters`)

| Filter | Bilka | REMA |
|---|---|---|
| organic | _is_organic | is_biological |
| glutenFree | _is_glutenfree | is_gluten_free |
| lactoseFree | _is_lactose_free | is_lactose_free |
| sugarFree | _is_sugar_free | is_sugar_free ("Sukkerfri") – kun med højst 0,5 g sukker; ellers er det REMA's "Ikke tilsat sukker" → noAddedSugar |
| lowSugar / noAddedSugar / reducedSugar / lightSugar | udledes (nøgleord, navn, variant, sukker pr. 100 g); "sukkerfri" i teksten på en vare med over 0,5 g sukker → noAddedSugar | udledes; REMA "Light" i is_sugar_free |
| sweeteners | _is_sweeteners | – |
| vegan | _is_vegan | is_vegan ("Ja") |
| vegetarian | – | is_vegan ("Vegetarisk") |
| meatType | _is_meat | is_meat (Oksekød → Okse) |
| alcohol | _is_alcohol (tekst) | is_alcohol_free |
| alcoholPercent | _is_alcohol (procent) | % (kun øl/vin/spiritus) |
| fatPercent | _is_fat | fat (kun værdier med %) |
| countryOfOrigin | _is_country_of_origen / Country of Origin | is_country_of_origin; ellers "Oprindelsesland: X" / "Født, opvokset og slagtet i: Danmark" i Additional Product Information eller Labels "Dansk" |
| wholeGrain | Labels "Fuldkorn" | is_whole_grain; Labels "Fuldkorn" |
| keyhole | – | is_healthy ("Nøglehul") |
| toxins (liste) | – | is_healthy ("Overfladebehandlet") |
| animalWelfare (liste) | – | is_animal_wellfare; Labels (Bedre Dyrevelfærd 1–3, Anbefalet af Dyrenes Beskyttelse) |
| certifications (liste) | – | is_social_responsibility; Labels (MSC, ASC, Fairtrade, Rainforest Alliance, Svanemærket) |
| vegetarian / vegan / organic / glutenFree / lactoseFree | Labels udfylder, hvor arket er tomt | Labels udfylder, hvor arket er tomt |
| storage | Packaging ("Frozen" → "Frost") | is_Packaging ("Konserves") |
| size | – | size |
| (tom i begge) | _is_allergy | _is_allergies |
