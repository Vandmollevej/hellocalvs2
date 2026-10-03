# Produktark → database: kolonne-mapping (Bilka + REMA 1000)

Beslutning: docs/DECISIONS.md 2026-09-27 "Butiksvarer i tre tabeller".
Kode: `scripts/store-products-import/` (`build_data.py` lokalt → JSON,
`agent.py` på NAS'en → database). Hele kataloget bygges med `--all --out` og kopieres til NAS'ens `data/store-products-import/`.

## Kilder

- `Produkter klar til import/Produktark/bilka.xlsx` (10.766 rækker)
- `Produkter klar til import/Produktark/rema1000_version 2.xlsx` (2.773 rækker)
- Næring/ingredienser: `Productdatabase/Bilka/bilka_product_information.xlsx`
  (join på EAN) og `Productdatabase/REMA1000/rema1000_product_information.xlsx`
  (ingen EAN – join på Source URL)
- Billeder: `Produkter klar til import/Færdige produktbilleder` (fritlagte,
  tag "Cutout") og `Productdatabase/Product Images` (originaler)

## Regler

- Arkene flettes ikke fysisk; én vare pr. EAN.
- Samme EAN i begge ark (501 stk.) = ét produkt med begge kæder.
- Bilka vinder ved uenighed; REMA udfylder tomme felter (fx energi,
  varedeklaration).
- En eksisterende vare med samme stregkode opdateres i stedet for at blive
  dubleret.
- Varer uden kcal/protein/kulhydrat/fedt springes over (2.408 i dag).
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
| name | HelloCal_Title uden ", mængde (Brand)" | Hello Cal product title uden brand foran |
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
| keywords (ny) | Keyword 1–5 | Keyword 1, is_Packaging (Bakke, Brik, i Skiver, Færdigretter …), "Light", ikke-alkohol "%" |
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
- "1.477" kJ læses som 1477. Umulige værdier (sukker > kulhydrat, mættet
  fedt > fedt) droppes.

## Tabel 3 – Filtre (`product_filters`)

| Filter | Bilka | REMA |
|---|---|---|
| organic | _is_organic | is_biological |
| glutenFree | _is_glutenfree | is_gluten_free |
| lactoseFree | _is_lactose_free | is_lactose_free |
| sugarFree | _is_sugar_free | is_sugar_free ("Sukkerfri") |
| lowSugar / noAddedSugar / reducedSugar / lightSugar | udledes (nøgleord, navn, variant, sukker pr. 100 g) | udledes; REMA "Light" i is_sugar_free |
| sweeteners | _is_sweeteners | – |
| vegan | _is_vegan | is_vegan ("Ja") |
| vegetarian | – | is_vegan ("Vegetarisk") |
| meatType | _is_meat | is_meat (Oksekød → Okse) |
| alcohol | _is_alcohol (tekst) | is_alcohol_free |
| alcoholPercent | _is_alcohol (procent) | % (kun øl/vin/spiritus) |
| fatPercent | _is_fat | fat |
| countryOfOrigin | _is_country_of_origen / Country of Origin | is_country_of_origin |
| wholeGrain | – | is_whole_grain |
| keyhole | – | is_healthy ("Nøglehul") |
| toxins (liste) | – | is_healthy ("Overfladebehandlet") |
| animalWelfare (liste) | – | is_animal_wellfare |
| certifications (liste) | – | is_social_responsibility |
| storage | Packaging ("Frozen" → "Frost") | is_Packaging ("Konserves") |
| size | – | size |
| (tom i begge) | _is_allergy | _is_allergies |
