# Optimering af dm, EDEKA, REWE og Wolt efter Bilka-mønsteret — rapport 2026-10-11

*Tallene gælder min kørsel 11/10 (kl. 06:55–13:49). Andre sessioner har ændret arkene siden (fx dyrefoder fjernet fra EDEKA, vin-rettelser, Co-brand-kolonnen 15/10), og mappen Excelark ligger nu i `Produkter/Backup/Excelark`.*

Alle ændringer er kun lavet i **egne kolonner**. Originalkolonnerne (Original Title, Product Name, Subtitle, Source URL, Manufacturer, Image File, Parse Status, Servings) og titelformlerne i kolonne A/B er uændrede (kontrolleret mod backup efter hver kørsel). Vin, spiritus og øl (rækker med `_is_alcohol`) ejes af vin-sessionen og er kun rettet hygiejnisk. Der er ikke slettet nogen rækker.

## 1. Kort overblik

| Ark | Rækker | Faste regler (celler) | AI-gennemgang (celler) | Heraf Product Type | Heraf Variation | Til gennemgang (lav sikkerhed) | Ikke-mad | Dyrefoder |
|---|---|---|---|---|---|---|---|---|
| dm (Tyskland) | 1691 | 3619 | 2147 | 609 | 878 | 1 | 16 | 0 |
| EDEKA (Tyskland) | 4901 | 3693 | 7367 | 2974 | 2746 | 43 | 165 | 33 |
| REWE (Tyskland) | 8664 | 3562 | 13128 | 5677 | 5482 | 54 | 100 | 0 |
| Wolt (Danmark) | 1914 | 431 | 2075 | 977 | 943 | 70 | 21 | 0 |
| **I alt** | 17170 | **11305** | **24717** | 10237 | 10049 | 168 | 302 | 33 |

## 1b. Før og efter (udfyldte celler pr. kolonne; før = ark 11/10 kl. 06:55, efter = ark efter min sidste kørsel 11/10 kl. 13:46)

| Kolonne | dm før → efter | EDEKA før → efter | REWE før → efter | Wolt før → efter |
|---|---|---|---|---|
| Product Type | 1687 → **1691** | 4591 → **4851** | 8664 | 1889 → **1909** |
| Variation | 1149 → **1449** | 974 → **3271** | 636 → **5703** | 39 → **948** |
| Keyword 1 | 1271 → **1288** | 1521 → **2063** | 676 → **1978** | 8 → **139** |
| Keyword 2 | 1065 → **1071** | 557 → **661** | 93 → **193** | 0 → **3** |
| Brand | 1691 | 4895 → **4859** | 7946 → **7945** | 1405 → **1456** |
| Subbrand | 0 | 303 → **272** | 703 → **711** | 0 → **19** |
| Quantity | 1658 | 4776 → **4742** | 8200 | 496 |
| Pack Count | 265 → **272** | 695 → **703** | 897 → **925** | 75 → **109** |
| Packaging | 0 | 3 → **100** | 0 → **203** | 1 → **3** |
| _is_organic | 1166 | 688 → **698** | 1338 → **1340** | 323 → **326** |
| _is_glutenfree | 837 | 177 | 143 → **145** | 6 → **11** |
| _is_lactose_free | 1035 | 107 → **108** | 41 → **42** | 6 |
| _is_vegan | 1235 | 239 | 503 → **531** | 0 |
| _is_sugar_free | 107 → **124** | 44 → **120** | 22 → **56** | 18 → **19** |
| _is_fat | 4 | 41 → **45** | 34 → **44** | 16 → **19** |
| _is_frozen | 0 | 0 | 120 → **212** | 1 |
| _is_decaf | 0 → **4** | 0 → **15** | 0 → **12** | 0 → **6** |
| _is_whole_grain | 0 → **20** | 0 → **34** | 0 → **62** | 0 → **15** |
| _is_country_of_origen | 23 → **24** | 868 → **869** | 568 | 42 |
| _is_animal_welfare | 0 | 0 | 0 → **10** | 0 |
| **Product Type = butikkens kategori** | 178 → **155** | 2305 → **594** | 7468 → **2384** | 0 → **0** |
| **Forskellige produkttyper** | 810 → **530** | 1294 → **1564** | 747 → **2244** | 1668 → **1128** |
| Rækker | 1691 → 1691 | 4901 → 4865 | 8664 → 8664 | 1914 → 1914 |

**Sådan læses tabellen:** i EDEKA og REWE er butikkens grove kategori ("Soßen", "Konserven", "Fertiggerichte") erstattet af varens eget navn ("Sauce Hollandaise", "Thunfisch", "Protein Bowl"); derfor falder antallet af rækker hvor Product Type bare er kategorien (EDEKA 2305 → 594, REWE 7468 → 2384), og antallet af forskellige produkttyper stiger. I dm og Wolt falder antallet af forskellige typer, fordi smag/sort er flyttet ud af typen og ind i Variation ("Kräutertee Pfefferminze" → type "Kräutertee" + variation "Pfefferminze"). Rækkeforskellen i EDEKA (4901 → 4865) er 36 dyrefoder-rækker, som en anden session fjernede (dyrefoder-spærringen) — ikke mig.

### Eksempler (Product Type / Variation / Keywords før → efter)

**dm (Tyskland)**

| Original titel | Product Type før → efter | Variation før → efter | Keywords før → efter |
|---|---|---|---|
| Meine vegane Carbonara, 27 g | Meine Carbonara → **Sauce Carbonara** | - → **-** | Ohne Farbstoffe, Ohne Konservierungsstoffe, Ohne Aromastoffe → **ohne Farbstoffe, ohne Konservierungsstoffe, ohne Aromastoffe** |
| Raspberry Chocolate Fudgy Cake, 105 g | Raspberry Chocolate Fudgy Cake → **Fudgy Cake** | - → **Raspberry Chocolate** | Ohne Farbstoffe, Ohne Aromastoffe, Ohne Konservierungsstoffe → **ohne Farbstoffe, ohne Aromastoffe, ohne Konservierungsstoffe** |
| Saaten, Kräuter, 1 St | Saaten → **Saatgut** | Kräuter → **Kräuter** | Ohne Farbstoffe, Ohne Konservierungsstoffe, Ohne Aromastoffe → **-** |
| Pasta Bucatini No 6, 500 g | Pasta Bucatini No 6 → **Nudeln** | - → **Bucatini No. 6** | Ohne Aromastoffe, Ohne Farbstoffe, Ohne Konservierungsstoffe → **ohne Aromastoffe, ohne Farbstoffe, ohne Konservierungsstoffe** |
| Kräutertee Kamille, Vanille & Manuka-Honig (20 Beutel), 32 g | Kräutertee Kamille → **Kräutertee** | Vanille/ Manuka-Honig → **Kamille, Vanille und Manuka-Honig** | Ohne Farbstoffe, Ohne Konservierungsstoffe, Ohne Aromastoffe → **ohne Farbstoffe, ohne Konservierungsstoffe, ohne Aromastoffe** |
| Natives Olivenöl extra, 750 ml | Natives Olivenöl extra → **Olivenöl** | - → **nativ extra** | Ohne Farbstoffe, Ohne Konservierungsstoffe → **ohne Farbstoffe, ohne Konservierungsstoffe** |
| Proteinriegel 50%, Fudgy Brownie Geschmack, 45 g | Proteinriegel 50% → **Proteinriegel** | Fudgy Brownie Geschmack → **Fudgy Brownie** | Ohne Farbstoffe → **ohne Farbstoffe** |
| Trockenfrüchte, Ingwer-Würfel kandiert, 100 g | Trockenfrüchte → **Ingwerwürfel** | Ingwer-Würfel kandiert → **kandiert** | Ohne Aromastoffe, Ohne Farbstoffe, Ohne Konservierungsstoffe → **ohne Aromastoffe, ohne Farbstoffe, ohne Konservierungsstoffe** |

**EDEKA (Tyskland)**

| Original titel | Product Type før → efter | Variation før → efter | Keywords før → efter |
|---|---|---|---|
| EDEKA Herzstücke Feine Mahlzeit Junior mit Rind & Huhn 12x400G |  → **Feine Mahlzeit Junior mit Rind & Huhn** | - → **-** | Ohne Zuckerzusatz, Mit wertvollen Vitaminen → **mit wertvollen Vitaminen** |
| Schwarzwaldhof Landjäger 160G | Würstchen geräuchert → **Landjäger** | - → **-** | Ohne Zusatzstoff Geschmacksverstärker → **geräuchert, ohne Geschmacksverstärker** |
| EDEKA Herzstücke Urgetreide Brot 350G | Frühstück & Snacks → **Brot** | - → **Urgetreide** | Mit Urgetreidesorten → **-** |
| elkos VIVEDE Husten- & Bronchialtee 20ST 40G | Arzneitee bei Symptomen der Bronchitis → **Husten- und Bronchialtee** | - → **Spitzwegerichkraut** | Mit Spitzwegerichkraut, Kräuter-Tee → **Kräutertee, Arzneitee** |
| Hohes C Plus Eisen 1L | Getränke → **C Plus Eisen** | - → **-** | - → **-** |
| Lorenz Snack-Hits 280G | Chips & Knabbereien → **Kartoffelchips** | - → **Western Style** | - → **-** |
| Fuchs Bruschetta Gewürzzubereitung 50G | Würzmittel & Brühen → **Gewürzzubereitung** | - → **Bruschetta** | - → **-** |
| Bad Reichenhaller Alpensaline Mittelgrobes Alpensalz 1KG | Speisesalz traditionell aus reiner Natursole → **Alpensalz** | - → **mittelgrob** | Aus den Tiefen der Alpen, Ohne Zusätze, Ohne Trennmittel → **aus Natursole, ohne Zusätze, ohne Trennmittel** |

**REWE (Tyskland)**

| Original titel | Product Type før → efter | Variation før → efter | Keywords før → efter |
|---|---|---|---|
| Ritter Sport Schokolade Voll-Nuss laktosefrei 100g | Nuss-Schokolade → **Nussschokolade** | - → **Voll-Nuss** | - → **-** |
| Reiss Pfefferbeisser | Rohwurst → **Pfefferbeißer** | - → **-** | - → **-** |
| BioGourmet Bio Demeter Gerstengraupen 500g | Getreide- & Dinkelflocken → **Gerstengraupen** | - → **-** | - → **Demeter** |
| Greenlegend Steaks Wild Pepper vegan 160g | Veggie-Steaks → **Veggie-Steak** | - → **Wild Pepper** | - → **-** |
| Hohes C Vitamin Water Electrolytes Zitrone Limette 6x0,75l | Wasser mit Vitaminen → **Vitaminwasser** | - → **Zitrone und Limette** | - → **Electrolytes** |
| Palatum Getrocknete Tomaten | Gemischte Antipasti → **Getrocknete Tomaten** | - → **-** | - → **-** |
| Dr. Oetker Ristorante Pizza Spinaci 390g | Pizza Spinat → **Pizza** | - → **Spinaci** | - → **-** |
| Bernard Matthews Hähnchensteaks Kräuter 2 Stück | Steaks → **Hähnchensteak** | - → **Kräuter** | - → **-** |

**Wolt (Danmark)**

| Original titel | Product Type før → efter | Variation før → efter | Keywords før → efter |
|---|---|---|---|
| Ketchup u. tilsat sukker, Heinz | Ketchup u → **Ketchup** | - → **-** | - → **-** |
| GB CREME FRAICHE DRESSING ØKO | Creme fraiche dressing → **Dressing** | - → **creme fraiche** | - → **-** |
| ANSJOSFILET I ØKO OLIVENOLIE | Ansjosfilet i olivenolie → **Ansjosfilet** | - → **olivenolie** | - → **-** |
| RYNKEBY CITRON LEMONADE ØKO | Citron lemonade → **Lemonade** | - → **Citron** | - → **-** |
| RICOLA HYLDEBLOMST SUKKERFRI | Hyldeblomst → **Urtebolsjer** | - → **hyldeblomst** | - → **-** |
| NATURLI SALTY CARAMEL VAFFEL | Salty caramel vaffel → **Vaffel** | - → **Salty Caramel** | - → **-** |
| BAGEL CHILI CHEDDAR 4-PAK 340G | Bagel chili cheddar 4-pak → **Bagel** | - → **chili og cheddar** | - → **-** |
| Hotdogbrød smørbagt, Kohberg | Hotdogbrød smørbagt → **Hotdogbrød** | - → **Smørbagt** | - → **-** |

## 2. Faste regler (script `optimer_ark.py`)

### dm (Tyskland) — 3619 celler

| Regel | Celler | Eksempel (række: før → efter) |
|---|---|---|
| Keywords: "Ohne …" med småt, dobbeltord fjernet, huller lukket | 3115 | 1216 Keyword 3: `Ohne Konservierungsstoffe` → `ohne Konservierungsstoffe` |
| Variation: "/" → "a, b und c", procent/mængde fjernet, funktionsord med småt, dobbeltord | 296 | 574 Variation: `Kurkuma/ Zimt/ Ingwer` → `Kurkuma, Zimt und Ingwer` |
| Brand: samme mærke, anden stavemåde (store/små bogstaver, punktum) → Bilkas stavemåde ("Dr Oetker" → "Dr. Oetker") | 51 | 1533 Brand: `followfood` → `Followfood` |
| Clean Subtitle følger brand/mængde ("Brand | mængde") | 51 | 718 Clean Subtitle: `mentos / 70 g` → `Mentos / 70 g` |
| Product Type: brand, mængde, procent og dobbeltord fjernet | 27 | 1511 Product Type: `Stevia Tabletten 100 St` → `Stevia Tabletten` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_whole_grain | 20 | 1050 _is_whole_grain: `` → `vollkorn` |
| Keyword flyttet til sin egen kolonne (ohne Zuckerzusatz → `_is_sugar_free`, entkoffeiniert → `_is_decaf` …) | 19 | 1281 _is_sugar_free: `` → `ohne zuckerzusatz` |
| `_is_`-værdier med småt (lande med stort): "Enthält Alkohol" → "enthält alkohol", "Rind" → "rind" | 18 | 1559 _is_meat: `Rind` → `rind` |
| Tal i tekstfelt (fx nøgleordet 2026) gemt som tekst, ikke som tal | 8 | 6 Keyword 1: `2026` → `2026` |
| Pack Count fra titlen ("6er Pack", "4 Stück") | 5 | 1014 Pack Count: `` → `3` |
| Tom/ugyldig Product Type (butikkens temakategori eller bare brandet) erstattet af navnet uden brand/mængde | 4 | 1691 Product Type: `` → `Süßungsmittel, Chunky Flavour Salted Car` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_decaf | 2 | 682 _is_decaf: `` → `entkoffeiniert` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_sugar_free | 2 | 996 _is_sugar_free: `` → `ohne zuckerzusatz` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_country_of_origen | 1 | 72 _is_country_of_origen: `` → `Deutschland` |

### EDEKA (Tyskland) — 3693 celler

| Regel | Celler | Eksempel (række: før → efter) |
|---|---|---|
| `_is_`-værdier med småt (lande med stort): "Enthält Alkohol" → "enthält alkohol", "Rind" → "rind" | 1266 | 865 _is_meat: `Rind` → `rind` |
| Keywords: "Ohne …" med småt, dobbeltord fjernet, huller lukket | 1043 | 2368 Keyword 1: `Mit Kakao aus West-Afrika` → `mit Kakao aus West-Afrika` |
| Tom/ugyldig Product Type (butikkens temakategori eller bare brandet) erstattet af navnet uden brand/mængde | 391 | 4708 Product Type: `` → `High Protein Köllnflocken Kakao` |
| Variation: "/" → "a, b und c", procent/mængde fjernet, funktionsord med småt, dobbeltord | 297 | 1934 Variation: `Jod/ Folsäure Folsäure` → `Jod und Folsäure` |
| Clean Subtitle følger brand/mængde ("Brand | mængde") | 182 | 2824 Clean Subtitle: `Dr Oetker / 96 g` → `Dr. Oetker / 96 g` |
| Brand: samme mærke, anden stavemåde (store/små bogstaver, punktum) → Bilkas stavemåde ("Dr Oetker" → "Dr. Oetker") | 180 | 2821 Brand: `Dr Oetker` → `Dr. Oetker` |
| Dose/Glas/PET/Flasche fra keyword → Packaging | 97 | 550 Packaging: `` → `Dose` |
| Keyword flyttet til sin egen kolonne (ohne Zuckerzusatz → `_is_sugar_free`, entkoffeiniert → `_is_decaf` …) | 81 | 4729 _is_sugar_free: `` → `ohne zuckerzusatz` |
| Product Type: brand, mængde, procent og dobbeltord fjernet | 66 | 3187 Product Type: `Saugt ein vielfaches des Eigengewichtes ` → `Saugt ein vielfaches des Eigengewichtes` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_whole_grain | 31 | 4177 _is_whole_grain: `` → `vollkorn` |
| Pack Count fra Product Type/Variation | 14 | 2619 Pack Count: `` → `2` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_decaf | 13 | 1682 _is_decaf: `` → `entkoffeiniert` |
| `_is_organic` = bio fra eksplicit "Bio" i titlen | 11 | 3925 _is_organic: `` → `bio` |
| `_is_alcohol` = enthält alkohol, når alkohol-% findes | 7 | 1077 _is_alcohol#1: `` → `enthält alkohol` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_sugar_free | 5 | 680 _is_sugar_free: `` → `zuckerfrei` |
| `_is_fat` fra mejeri-titel ("3,5 %") | 4 | 1709 _is_fat: `` → `3.5%` |
| Blank Quantity udfyldt fra titlen | 2 | 908 Quantity: `` → `40 g` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_lactose_free | 1 | 4165 _is_lactose_free: `` → `laktosefrei` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_country_of_origen | 1 | 4574 _is_country_of_origen: `` → `Griechenland` |
| Tal i tekstfelt (fx nøgleordet 2026) gemt som tekst, ikke som tal | 1 | 1614 Keyword 2: `21` → `21` |

### REWE (Tyskland) — 3562 celler

| Regel | Celler | Eksempel (række: før → efter) |
|---|---|---|
| `_is_`-værdier med småt (lande med stort): "Enthält Alkohol" → "enthält alkohol", "Rind" → "rind" | 2420 | 1803 _is_meat: `Huhn` → `huhn` |
| Keywords: "Ohne …" med småt, dobbeltord fjernet, huller lukket | 239 | 6662 Keyword 1: `Ohne Zuckerzusatz` → `` |
| Dose/Glas/PET/Flasche fra keyword → Packaging | 203 | 4171 Packaging: `` → `Glas` |
| Clean Subtitle følger brand/mængde ("Brand | mængde") | 155 | 4046 Clean Subtitle: `Dr Oetker / 140 g` → `Dr. Oetker / 140 g` |
| Brand: samme mærke, anden stavemåde (store/små bogstaver, punktum) → Bilkas stavemåde ("Dr Oetker" → "Dr. Oetker") | 148 | 5709 Brand: `Dr Oetker` → `Dr. Oetker` |
| `_is_frozen` fra kategori (Tiefkühl-*, Eis …) eller "TK" i titlen | 92 | 1308 _is_frozen: `` → `frozen` |
| Variation: "/" → "a, b und c", procent/mængde fjernet, funktionsord med småt, dobbeltord | 69 | 7602 Variation: `blau` → `` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_whole_grain | 62 | 1003 _is_whole_grain: `` → `vollkorn` |
| Tom/ugyldig Product Type (butikkens temakategori eller bare brandet) erstattet af navnet uden brand/mængde | 62 | 3448 Product Type: `Kalbskotelett` → `Kalbfleisch von der Theke` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_sugar_free | 24 | 896 _is_sugar_free: `` → `zuckerfrei` |
| Keyword flyttet til sin egen kolonne (ohne Zuckerzusatz → `_is_sugar_free`, entkoffeiniert → `_is_decaf` …) | 20 | 5003 _is_animal_welfare: `` → `haltungsform 5` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_vegan | 14 | 7716 _is_vegan: `` → `vegan` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_decaf | 12 | 3372 _is_decaf: `` → `entkoffeiniert` |
| `_is_fat` fra mejeri-titel ("3,5 %") | 10 | 2205 _is_fat: `` → `3.8%` |
| `_is_alcohol` = enthält alkohol, når alkohol-% findes | 9 | 8300 _is_alcohol#1: `` → `enthält alkohol` |
| Pack Count fra titlen ("6er Pack", "4 Stück") | 7 | 3276 Pack Count: `` → `5` |
| Skrald i brandfeltet fjernet (lange reklametekster) | 4 | 7374 Brand: `in Deutschland* *Nielsen Handelspanel, A` → `` |
| Blankt brand udfyldt fra titlens første ord (kun kendte mærker) | 3 | 5102 Brand: `` → `Be-Kind` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_glutenfree | 2 | 1766 _is_glutenfree: `` → `glutenfrei` |
| `_is_organic` = bio fra eksplicit "Bio" i titlen | 2 | 3923 _is_organic: `` → `bio` |
| Product Type: brand, mængde, procent og dobbeltord fjernet | 2 | 6482 Product Type: `Salate To Go` → `Salate` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_sweeteners | 1 | 972 _is_sweeteners: `` → `süßungsmittel` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_lactose_free | 1 | 8236 _is_lactose_free: `` → `laktosefrei` |
| Tal i tekstfelt (fx nøgleordet 2026) gemt som tekst, ikke som tal | 1 | 6275 Keyword 2: `2024` → `2024` |

### Wolt (Danmark) — 431 celler

| Regel | Celler | Eksempel (række: før → efter) |
|---|---|---|
| Clean Subtitle følger brand/mængde ("Brand | mængde") | 119 | 235 Clean Subtitle: `Ritter sport` → `Ritter Sport` |
| Brand: samme mærke, anden stavemåde (store/små bogstaver, punktum) → Bilkas stavemåde ("Dr Oetker" → "Dr. Oetker") | 68 | 310 Brand: `Kims` → `KiMs` |
| Product Type: brand, mængde, procent og dobbeltord fjernet | 59 | 473 Product Type: `Fk booster sort` → `Fk sort` |
| Blankt brand udfyldt fra titlens første ord (kun kendte mærker) | 51 | 919 Brand: `` → `Dgs` |
| Pack Count fra titlen ("6er Pack", "4 Stück") | 34 | 5 Pack Count: `` → `3` |
| Variation: "/" → "a, b und c", procent/mængde fjernet, funktionsord med småt, dobbeltord | 27 | 323 Variation: `45+` → `45` |
| `_is_`-værdier med småt (lande med stort): "Enthält Alkohol" → "enthält alkohol", "Rind" → "rind" | 26 | 971 _is_country_of_origen: `kina` → `Kina` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_whole_grain | 15 | 544 _is_whole_grain: `` → `fuldkorn` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_decaf | 6 | 835 _is_decaf: `` → `koffeinfri` |
| Product type plural genberegnet (Wolt) | 6 | 591 Product type plural: `Granatæbler 2 pk` → `Granatæbler` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_glutenfree | 5 | 1500 _is_glutenfree: `` → `glutenfri` |
| Keywords: "Ohne …" med småt, dobbeltord fjernet, huller lukket | 4 | 1215 Keyword 1: `I tern` → `i tern` |
| `_is_organic` = økologisk fra "øko" i titlen (Wolt) | 3 | 1425 _is_organic: `` → `økologisk` |
| `_is_fat` fra mejeri-titel ("3,5 %") | 3 | 1771 _is_fat: `` → `3.5%` |
| Blankt subbrand udfyldt (kun kendt linje under mærket) | 2 | 269 Subbrand: `` → `Zero` |
| Dose/Glas/PET/Flasche fra keyword → Packaging | 2 | 272 Packaging: `` → `Dåse` |
| `_is_` udfyldt fra eksplicit ord i titlen: _is_sugar_free | 1 | 404 _is_sugar_free: `` → `sukkerfri` |

## 3. AI-gennemgang af Product Type, Variation og Keywords

Hver række blev gennemgået af en AI-agent efter Bilkas regler (produkttype = varens almindelige navn uden brand/mængde/påstande; variation = smag/sort/fyld; højst 5 keywords). Forslaget skrives kun ind, når det består validering: ingen brand/mængde/% i typen, ikke ALLE-STORE, ikke oversat, og cellen er ikke ændret af andre siden forslaget blev lavet. Sikkerhed ≥ 4 erstatter; 3 kun hvor feltet er tomt eller butikkens kategori; ≤ 2 skrives ikke (se lister).

### dm (Tyskland) — 2147 celler (1 koersler)

| Kolonne | Celler |
|---|---|
| Variation | 878 |
| Product Type | 609 |
| Keyword 1 | 252 |
| Keyword 2 | 173 |
| Keyword 3 | 147 |
| Keyword 4 | 75 |
| Keyword 5 | 11 |
| Pack Count | 2 |

Eksempler (række: Product Type før → efter):
- dm 943: `Mehl-Mix universal` → `Mehl-Mix`
- dm 1459: `Schokoriegel Milch` → `Schokoriegel`
- dm 288: `Doppelkeks Dinkel Kakao` → `Doppelkekse`
- dm 14: `Ahornsirup Grad C` → `Ahornsirup`
- dm 1441: `Schokolade Matcha Strawberry` → `Schokolade`
- dm 1124: `Organic Granola Bites` → `Granola Bites`
- dm 1066: `Nudeln` → `Spaghetti`
- dm 480: `Fruchtmark Apfel` → `Fruchtmark`

### EDEKA (Tyskland) — 7367 celler (2 koersler)

| Kolonne | Celler |
|---|---|
| Product Type | 2974 |
| Variation | 2746 |
| Keyword 1 | 1243 |
| Keyword 2 | 319 |
| Keyword 3 | 65 |
| Keyword 4 | 12 |
| Pack Count | 7 |
| Keyword 5 | 1 |

Eksempler (række: Product Type før → efter):
- edeka 4428: `Würzmittel & Brühen` → `Balsamico-Creme`
- edeka 961: `Fix-Produkte` → `Fix`
- edeka 748: `Essig` → `Aceto Balsamico`
- edeka 3173: `Schaschlik Sauce` → `Schaschliksauce`
- edeka 4119: `Tomatensoße-Pesto` → `Stückige Tomaten`
- edeka 2392: `Milch, Sahne, -Alternativen` → `H-Milch`
- edeka 4835: `Trockenshampoo Cherry Love` → `Trockenshampoo`
- edeka 1389: `Gewürze-Brühen` → `Kurkuma`

### REWE (Tyskland) — 13128 celler (1 koersler)

| Kolonne | Celler |
|---|---|
| Product Type | 5677 |
| Variation | 5482 |
| Keyword 1 | 1822 |
| Keyword 2 | 115 |
| Pack Count | 21 |
| Subbrand | 8 |
| Keyword 3 | 3 |

Eksempler (række: Product Type før → efter):
- rewe 2066: `Fleischwurst & Mortadella` → `Aufschnitt`
- rewe 6088: `Rindfleisch` → `Rinder-Minutensteak`
- rewe 7661: `Universelle Würze` → `Würze`
- rewe 5946: `Prä- & Probiotische Getränke` → `Limonade`
- rewe 521: `Bohnenkaffee ganze Bohnen` → `Kaffeebohnen`
- rewe 8648: `Zwiebeln & Knoblauch` → `Zwiebel`
- rewe 1265: `Eingelegte Zwiebeln` → `Onion Jam`
- rewe 7544: `Tomaten-Konserven` → `Stückige Tomaten`

### Wolt (Danmark) — 2075 celler (2 koersler)

| Kolonne | Celler |
|---|---|
| Product Type | 977 |
| Variation | 943 |
| Keyword 1 | 135 |
| Subbrand | 17 |
| Keyword 2 | 3 |

Eksempler (række: Product Type før → efter):
- wolt 934: `Kyllingenudler` → `Nudler`
- wolt 1507: `Sdr j frist skagensalat` → `Skagensalat`
- wolt 577: `Gm tropisk juice` → `Juice`
- wolt 922: `Kylling/bacon salat` → `Salat`
- wolt 575: `Gm juice æble/hyldeblomst` → `Juice`
- wolt 843: `Kapsler mattinata longo` → `Kaffekapsler`
- wolt 1648: `Squash Sportsvand` → `Squash`
- wolt 1040: `Marcipan makroner` → `Makron`

## 4. Billeder og URL'er

`Image File` og `Source URL` er originalkolonner og er **ikke ændret** (regel: aldrig rettes). Kontrolleret mod filerne på NAS'en (`Productdatabase\Product Images`, `Produkter klar til import\Færdige/Mangler/Fejlet`):

| Ark | Rækker | Billedfil findes | Via EAN-navn | Mangler fil | Tom Image File |
|---|---|---|---|---|---|
| bilka | 10766 | 10646 | 19 | 71 | 30 |
| dm | 1691 | 1682 | 0 | 9 | 0 |
| edeka | 4901 | 4858 | 0 | 43 | 0 |
| rewe | 8664 | 8659 | 0 | 5 | 0 |
| wolt | 1914 | 1850 | 0 | 64 | 0 |

Alle `Source URL` er udfyldt, begynder med https og er unikke; værten passer til butikken. De 222 rækker uden billedfil står i fanen *Billeder mangler* i `Produkter/Backup/Excelark/gengangere-fund.xlsx`.

## 5. Stregkoder

| Ark | Gyldige | Tomme | Ugyldig længde | Forkert kontrolciffer | Instore-koder (2…) |
|---|---|---|---|---|---|
| bilka | 10647 | 83 | 16 | 20 | 0 |
| dm | 1691 | 0 | 0 | 0 | 0 |
| edeka | 6 | 4895 | 0 | 0 | 0 |
| rewe | 8245 | 29 | 0 | 0 | 390 |
| wolt | 0 | 1914 | 0 | 0 | 0 |

EDEKA og Wolt har ingen stregkoder i kilden (EDEKA24 og Wolt viser dem ikke). Listen over problemkoder står i fanen *Stregkode-problemer* i gengangerrapporten.

## 6. Gengangere

Se `Produkter/Backup/Excelark/gengangere-fund.xlsx` (kun rapport — intet er slettet eller sammenlagt). Samme produkt kan have forskellig stregkode i to lande; derfor sammenlignes brand + mængde + navn, ikke kun EAN.

- **5.388 kandidatpar** (samme brand + samme mængde + lignende navn, men forskellig eller manglende stregkode) blev vurderet af AI-agenter og derefter prøvet afvist af skeptiske kontrollører; de sidste 137 par er kontrolleret af Codex.
- **Resultat:** 3.510 par er forskellige produkter (smag, størrelse, økologi, fedt …), **1.174 er samme produkt**, **704 er usikre** (fx snaps/akvavit uden variant), 0 er ukontrollerede.
- De 1.174 "samme produkt" fordeler sig sådan: **981** hvor den ene række **mangler stregkode** og kan låne den fra den anden (mest Bilka–Nemlig 393, Nemlig–SPAR 150, Nemlig–REMA 121, EDEKA–REWE 75), **96 hvor begge rækker HAR stregkode, men forskellige** (dit eksempel: samme vare med to stregkoder — Bilka–REWE 30, Bilka–REMA 15, Bilka–SPAR 15, REWE–SPAR 8 …) og **97** hvor ingen af rækkerne har stregkode (mest EDEKA–Nemlig 43, Nemlig–Wolt 24).
- Vin hvor kun årgangen adskiller er behandlet som egen kategori; der er ikke slået noget sammen.
- Samme stregkode i både DK- og DE-ark (14 grupper) og stregkoder med fejl i kontrolcifferet (36 rækker, mest Bilka) står i hver sin fane. Rækkenumre i rapporten er fra udtrækket 11/10 — brug Source URL til at finde rækken, fordi dyrefoder-rækker senere er fjernet.

## 6a. Manglende stregkoder kopieret (16/10, efter dit ja)

Du svarede ja til at flytte manglende stregkoder over på den række der mangler dem. **570 stregkoder er skrevet** i arkene (kun cellen EAN; ingen rækker slettet eller sammenlagt; backup før hvert ark i `Produkter/Backup/*_foer_ean-kopi.xlsx`; log celle for celle i `Produkter/Backup/ean_kopi_2026-10-16_0652.csv`):

| Ark | Stregkoder skrevet | Kommer fra |
|---|---|---|
| Nemlig | 443 | Bilka 279, SPAR 86, REMA 78 |
| Wolt | 58 | SPAR 47, REMA 6, Bilka 5 |
| EDEKA | 64 | REWE 63, dm 1 |
| DRK | 3 | Bilka 2, REMA 1 |
| Årstiderne | 2 | Bilka 2 |

Fordi en forkert stregkode er værre end en manglende, er kun de sikreste par brugt: AI-sikkerhed 5 (eller 4 med næsten identisk titel), titellighed ≥ 0,6, kun inden for samme land, kun gyldige GS1-stregkoder, aldrig en stregkode der allerede fandtes i arket, og ikke hvor flere forskellige stregkoder var mulige. **Ikke kopieret:** 124 par på tværs af lande (DK ↔ DE), 209 par med for svag titellighed (fx Kærgården Original ≠ Smørbar), 37 med lav sikkerhed, 15 tvetydige. Efterkontrol: 570 ændrede celler i alt — alle i kolonnen EAN — titelformler uændrede, ingen stregkode-dubletter opstået.

## 6b. Hændelser undervejs (ærlig status)

- **Fejl i min slutoprydning:** ved en fejl blev et indledende "mit/ohne/aus/in" fjernet i 1.076 variationer ("ohne Knochen" blev til "Knochen"). Opdaget samme dag, funktionen er rettet, og alle 1076 celler er gendannet fra ændringslisten (`gendan_variation.py`). Efterkontrol: originalkolonner og titelformler uændrede.
- **Rækkenumre forskød sig** i EDEKA, da en anden session fjernede 36 dyrefoder-rækker. Konfliktkontrollen i `anvend_ai_forslag.py` standsede 3.110 forkerte skrivninger; scriptet matcher nu på Source URL.
- **EDEKA og REWE var åbne i Excel** under kørslen. Jeg overskrev dem ikke; et job prøvede igen hvert 90. sekund, til filerne var lukket.
- **Brugsgrænsen blev ramt flere gange** midt i AI-kørslerne. Færdige batches blev genbrugt (cache), og kun de afbrudte blev genkørt; kontrolleddet for hver 8. række blev derfor sparet væk, og usikre rækker (sikkerhed ≤ 2) blev i stedet holdt ude af arkene.

## 7. Det der ikke er gjort — og hvorfor

- `_is_cooked`/`_is_raw` er ikke udfyldt i de tyske ark: titelformlen sætter dem forrest uden tysk bøjning ("Geräuchert Lachs"). Kræver en tysk version af formlen.
- `_is_meat` er ikke udfyldt automatisk (for mange falske hits som "Chili con Carne").
- Product type plural er tom i de tyske ark (ingen tysk bøjning).
- Vin/spiritus/øl røres ikke af denne optimering (vin-sessionen).
- Nøgleordene "ohne Farbstoffe / Konservierungsstoffe / Aromastoffe" fra dm står stadig som keywords (ingen egen kolonne) og fylder i titlerne — beslut om de skal væk.
- Ikke-mad (husholdning, kosmetik) og dyrefoder er listet, men rækkerne er ikke slettet.

## 8. Filer

- Scripts: `Produkter/Backup/Excelark/optimer_ark.py`, `anvend_ai_forslag.py`, `gendan_variation.py` (mappen Excelark blev 15/10 flyttet hertil; scripts er committet lokalt på grenen `deploy`).
- Backups før hver kørsel: `Produkter/Backup/Excelark/backup/*_foer_optimering.xlsx`, `*_foer_ai-forslag.xlsx` og `*_foer_gendan-variation.xlsx`.
- Alle ændringer celle for celle: `Produkter/Backup/Excelark/backup/optimering_2026-10-11_*.csv` og `ai_<butik>_*_aendringer.csv`.
- Lister: `ai_<butik>_*_til_gennemgang.csv`, `*_ikke_mad.csv`, `*_dyrefoder.csv`.
