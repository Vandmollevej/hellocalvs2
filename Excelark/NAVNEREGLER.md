# Navneregler for alle ark (globale — gælder Bilka, REMA, SPAR, Nemlig, Wolt, DRK, Frida m.fl.)

Brugerens regler 2026-10-09. Samme kolonner og samme regler i ALLE ark, så der er kontinuitet.
Kort version står også i `docs/REGLER.md`.

## Produkttitel — rækkefølge
1. `_is_cooked`
2. Product Type (småt begyndelsesbogstav, hvis det ikke er første ord i sætningen)
3. Variation
4. `_is_light`, `_is_alcohol`, `_is_glutenfree`, `_is_vegan`, `_is_lactose_free`
5. `(Packaging, Keyword 1, Keyword 2, Keyword 3, _is_raw)` — i parentes; `_is_raw` altid sidst

## `_is_cooked`
- Stegt/tørret/kogt/syltet/ristet/røget/bagt/grillet/dampet står altid FØRST i titlen.
- Ental/flertal følger varen: "Tørrede figner", "Friturestegte pommes frites", "Syltede jordbær", "Kogt kartoffel".
- Flere tilstande: "Tørrede og kogte hvide bønner" — aldrig "Tørret, Kogt".
- Ordet fjernes fra Product Type/Variation (kun ét sted).

## Forkortelser i de originale felter (Product Name / Original Title / Subtitle)
- `m.` `m/` `m` → **med**, `u.` `u/` → **uden**, samt `i`, `af`.
- Det, der står efter dem og ligger i Variation, skrives med lille begyndelsesbogstav og får ordet foran:
  "Ymerdrys m. kanel" → Variation `med farin og kanel`.
- med / uden / i / af / på / fra / tilsat står altid med småt i Variation og titel.

## Keywords
- Aldrig deles midt i en frase: `Uden tilsat sukker` er ét keyword (ikke `Uden` + `Tilsat sukker`).
- Vitaminer hører ikke hjemme i keywords, men i specifikationsarket (`*_vitamins.xlsx` / `*_product_information.xlsx`).

## Andet
- Instantkaffe hedder altid "Instantkaffe" (Product Type) — ikke "Kaffe, instant".
- Kolonner er ens i alle ark (se Bilka som master): HelloCal_Title, Product Name, Original Title, Subtitle, Quantity, Brand, Subbrand, EAN, Pack Count, Product Type, Variation, Category, Packaging, `_is_*`, Keyword 1-5, Source URL, Manufacturer, Image File, Parse Status.

## Lister, gram og fedt (tilføjet 2026-10-09)
- `/` og komma i Variation og Keywords bliver til almindelig opremsning: "hindbær/ blåbær/ solbær" → "med hindbær, blåbær og solbær"; kun to led → "a og b".
- Fedtprocent ("1/ 4% fedt") står i `_is_fat` (fx `1,4%`), ikke i Variation/keywords.
- Gram/kg står kun i Quantity — aldrig i Variation.
- Frida: kun `/` rettes (komma er Fridas egen adskiller).

## Nøgleord-regler fra Frida (2026-10-09) — gælder alle ark
- Disse ord/udtryk står som egne Keywords (ikke i Variation): Vild, Raffinol, Hydrogeneret, Grove (også "grov"), Parboiled, Tør, Sød, "På dåse/ konserves", "På glas", "I saltlage", "Uden sten", "Uden tilsat sukker", "Hele eller knækkede".
- "Rug-, groft" / "Hvede-, fint" → to keywords: "Rug-" og "Groft".
- Sammensatte produkttyper står i én celle: "Fennikelknold", "Ægte kastanje".
- "Kaffe, instant" → Product Type "Instantkaffe".
- "Linse, tørkage" → Product Type "Linse", keyword "Tørkage" (titel: Linse (Tørkage)).
- Én vare der dækker to ("Rødvin, rosévin") deles i to rækker, én pr. vare.
- Rækker fjernes helt: "Spirituosa, gennemsnitlige værdier", "ekstruderet" (snacks), "skumboller" som variation (Flødeboller beholdes).
- Titel: `[_is_cooked] type [variation] [light/alkohol/vegansk] (Keyword 1, 2, 3, _is_raw)`; første keyword med stort, resten småt, `_is_raw` sidst.

## HelloCal_Title er en formel (Frida, 2026-10-09)
- Kolonne A i Frida-ark er en Excel-formel (LET/TEXTJOIN) der sætter titlen sammen af: `_is_cooked` (I), Product Type (B / D), Variation (E), `_is_light` (K), `_is_alcohol` (L), `_is_vegan` (T), Keyword 1-3 (O-Q) og `_is_raw` (H). Ret felterne — aldrig titlen.
- Kolonne D "Product type plural" udfyldt = typen står i flertal i titlen og `_is_cooked` bøjes i flertal (Tørret → Tørrede).
- Flere tilstande i `_is_cooked` skrives "Tørret og kogt" / "Kogt eller røget".
- Flere nøgleord: UHT, "Alle typer", Rug-/Hvede- + groft/fint; Sortmundfilet og Blåhvilling er to rækker.

## Flere Frida-regler (2026-10-09, senere)
- Keywords: "Med tilsat …" (sukker, kunstig sødestof, calcium) skrives altid med "Med" foran; Dybvands, Sur, Sød/Søde, "Alle typer", UHT, Colostrum, Overgangsmælk (10. dag efter fødslen), årstider/måneder ("Maj til september", "Efterår (oktober til december)").
- Sur/Sød/Søde står i titlen FORAN produkttypen: "Sød hvidvin", "Sur hindbærsaft".
- "Fast" + ost → Product Type "Fast-ost".
- "Detailbageri" → `_is_cooked` = "Færdiglavet".
- "Uden alkohol"/"Alkoholfri" har egen kolonne `_is_alcohol_free` (= "Alkoholfri"); `_is_alcohol` rummer kun "Indeholder alkohol" + procent.
- Salatdressinger er egne produkttyper: "Thousand island dressing", "Creme fraiche dressing", "Hvidløgsdressing", "Cæsar dressing".
- Celler må aldrig starte/slutte med mellemrum.
- To varer i én række deles (Sapote / Stor sapodil).
- Variation gemmes altid med lille begyndelsesbogstav (undtagen egennavne: Beluga, Hokkaido, Thüringer, Schwarzwalder, Serrano, Marmite, Curacao).
- Flere nøgleord: Ikke beriget, Saltet/Usaltet, Fra opdræt (havopdræt), Med lavt sukkerindhold, Med tilsat kunstig sødestof.
- `_is_cooked`: "Færdigbagt" kun for kager og småkager (kategori Kager, Kiks og småkager); alt andet færdigt (brød, røræg, detailbageri m.m.) er "Færdiglavet".
- "Torsk rogn" → Product Type "Torskerogn".
- **Tilstand foran i titlen**: `_is_raw` → `_is_cooked` → `_is_frozen` står altid forrest i navnet: "Rå jordbær", "Tørrede figner", "Frosset mango"/"Frosne rejer", "Kogte frosne rejer". Fersk/Rå følger ental/flertal ("Fersk"→"Ferske"). Flertal styres af kolonne D. `_is_raw` står ikke længere i parentesen.
- Sur/Sød/Søde står efter tilstandsordene og foran produkttypen.
- **Titelkolonner (Frida)**: C = `Product title singular` (formel, ental: "Tørret figen"), D = `Product title plural` (formel, flertal: "Tørrede figner"), Z = `Product type plural` (indtastet flertalsnavneord; tom = ingen flertalstitel). `Product Type` (B) står altid i ental ("Rød linse"). A = `HelloCal_Title` = flertalstitlen hvis den findes, ellers ental.
- **Rettelse**: `_is_raw` bliver i parentesen, men står FØR nøgleordene: `(rå, keyword 1, keyword 2, keyword 3)` — fx "Skinke (Fersk, afpudset)". (Erstatter tidligere "_is_raw sidst" og "_is_raw forrest".)

## Frida-ark: kolonner og sukker (2026-10-09, senest)
- Kolonnen `HelloCal_Title` er fjernet. Titlerne ligger i `Product title singular` (C→B) og `Product title plural` (D→C), begge formler. `Product Type` står i ental; flertalsnavneordet står i `Product type plural` (sidste kolonne) og er udfyldt for alle rækker (utælleligt/uændret = samme ord).
- **Sukker (Bilka-modellen)**: `_is_sugar_free` = "Sukkerfri" eller "Uden tilsat sukker" (aldrig Yes/No); "Med tilsat sukker"/"Med lavt sukkerindhold" er nøgleord; `_is_sweeteners` = "Sødestoffer". Frida er gennemført; Bilka er masteren, REMA ("Ikke tilsat sukker") og de øvrige ark mangler.
- UHT hedder "Langtidsholdbar" (nøgleord). "På dåse/ konserves" (med skråstreg).
- To varer i én række deles: "Græsk og Tyrkisk stil" → "græsk stil" og "tyrkisk stil".

## Nye globale felter og regler (Frida, 2026-10-09 sent)
- **`_is_decaf`** (global): kun værdien "Koffeinfri". "Koffeinfri" i Variation/titel flyttes hertil og vises i titlen efter variationen. (Ingen "indeholder koffein"-værdi.)
- Foran produkttypen i titlen (efter tilstandsordene): Sur, Sød/Søde, Groft/Fint/Grove/Fine, Dobbelte, Instant — fx "Instant kakaopulver", "Groft knækbrød". "Instant kaffepulver"/"Kaffe, instant" = Product Type "Instantkaffe".
- Kommaer i Variation fjernes (Frida brugte dem som adskiller): "med/uden/af/i/på…"-led sættes med mellemrum, øvrige led "a, b og c": "vildt og kød", "ben med kød og skind".
- "Sukrede" → "med sukker", "usukrede" → "uden sukker". "Hvedemel durum" → "Hvedemeldurum". "Høstsild/fedsild" → to rækker (Høstsild, Fed sild).
- "blade" skrives altid sammen med ordet før: Teblade, Korianderblade, Spinatblade (aldrig "Koriander blade"). Gælder alle ark.

## "ben" er del af produkttypen (brugerens regel 2026-10-10, alle ark)
- "ben" alene i Variation hører til produkttypeordet og skrives sammen med det: "Skiver af okse" + "ben" → "Skiver af okseben" (som Okseben, Stegeben, Kamben). Variation ryddes.
- "med ben" / "uden ben" flyttes samlet ind i produkttypen: "Ibérico kotelet med ben", "Koteletter af gris uden ben". `Product type plural` rettes ens.
- Rettet i Bilka 2026-10-10: række 267, 268, 269 (backup `Excelark/backup/bilka_2026-10-10_0946_foer_ben.xlsx`). REMA har ingen tilsvarende rækker. "skind og ben og barbecuekrydderi" (række 3363) er en opremsning og er ikke rørt.

## Ost: "revet" og "i blok" (brugerens regel 2026-10-10, alle ark)
- Al revet ost: ordet "revet" fjernes fra produkttype/variant og står som keyword **`revet`** (titel: "Mozzarella (Revet)"). "Revet ost" → "Ost" + keyword `revet`.
- Al fast ost og "i stykke" (samt "i blok", der stod i typen): fjernes fra produkttypen og står som keyword **`i blok`** (titel: "Modnet fast ost 45+ (I blok)"). "fast" bliver stående i typen.
- Gælder ikke ost i skiver/tern/revet (skiveost, "i skiver", "i tern") og ikke "halvfast". Originaltitel afgør, hvis arket har mistet ordet ("Revet pastaost", "Salatost i blok").
- Rettet 2026-10-10: Bilka 99 rækker, REMA 8 rækker (variant "revet" → keyword). Backups `Excelark/backup/*_foer_ost.xlsx`.

## Bilka/REMA: ental/flertal-titler og nye regler (2026-10-09, senest)
- `HelloCal_Title` / `Hello Cal product title` er fjernet i `bilka_ny.xlsx` og `rema1000_version 2_ny.xlsx` (originalerne var låst af Excel). Erstattet af formelkolonnerne `Product title singular` / `Product title plural` (samme formler som Frida) + `Product type plural`, `_is_frozen`, `_is_raw`, `_is_cooked`. Genereret med `Excelark/titel_ental_flertal.py`; flertalsordet er gættet af regler og skal gennemses.
- Kolonner hedder som i serverens database: brand, subbrand, productType, variant, flavor (REMA taste), packageSizeText, packCount, packaging, category, barcode, keyword1-5. `_is_*`-navne beholdt.
- Original Title, Product Name, Subtitle, Source URL, Image File, Parse Status står bagerst.
- Alle `_is_`-værdier, variant og keywords med småt (undtagen store forkortelser og egennavne).
- Sukkerfri / uden tilsat sukker står i sukker-kolonnen, aldrig i variant/keyword.
- Intet ord må stå dobbelt på tværs af productType, `_is_`-felter, variant og keywords (funktionsord undtaget). Undtagelse: `_is_meat`/`is_meat` må gentage ordet (brugerens regel 2026-10-10).
- REMA: kolonnen `%` findes ikke længere — fedt% står i `_is_fat` (tidl. `fat`), alkohol% i `_is_alcohol` (tekst, fx "13,5%") (2026-10-10).
- Frost står kun i `_is_frozen` — aldrig "Frozen" i packaging (fjernet i Bilka 2026-10-10, 531 rækker; packaging beholdes pga. Bakke/Dåse/Tube).
- Opdatering 2026-10-10: `Excelark/bilka.xlsx` og `Produkter/rema1000_version 2.xlsx` er selv omskrevet (ikke kun `_ny`). `scripts/store-products-import/build_data.py` læser både nye (databasenavne) og gamle kolonnenavne via `NEW_ALIAS` i `load()`.

## Procent og ost (brugerens regel 2026-10-10) — gælder alle ark
- **% må aldrig stå i produkttype, variant eller keywords.** Fedt-% → `_is_fat` (mejeri, kød "8-12% fedt", fedtstoffer, plantedrikke); alkohol-% → `_is_alcohol` (spiritus, øl, vin, likør, cocktails). Ingrediens-% (fx "49% nougat", "70% kakao", "80% kød", "mindst 50% frugtindhold") er hverken fedt eller alkohol og fjernes fra teksten (står stadig i Original Title).
- **"45+" o.l. (NN+) betyder ost**: står altid FØRST i variant, adskilt med komma fra resten: "45+", "45+, med kommen". Står det kun i Original Title, hentes det derfra. Blandinger af flere oste beholder NN+ ved hver ost ("hvid cheddar 50+, hård modnet ost 40+ og maasdammer 45+"). Er ostens NN+ (≥45) fejlagtigt lagt i `_is_fat` som "NN%", fjernes den.
- **Produkttype der starter med %** er fejlet: typen findes i Original Title (fx P-tærter → "Fransknougat"); ingredienserne flyttes til variant hvis den er tom, ellers til et keyword.
- Gennemført i `Excelark/bilka.xlsx` 2026-10-10 (562 rækker) med `Excelark/procent_ost_regler.py`; reglen er også bygget ind i `titel_ental_flertal.py`. REMA havde ingen % i tekstfelterne.

## Dobbeltord, brand, sukker/fedt/alkohol og flertal (brugerens regler 2026-10-10, gælder alle ark)
- **Intet ord to gange i samme celle** ("Carpaccio Carpaccio", "med chokoladesmag, med chokoladesmag" → ét). Undtaget er brandnavne, der selv gentager et ord (Mogu Mogu, Yum Yum, Chop Chop).
- **Brandnavnet står aldrig i productType**: står hele brand-/subbrandnavnet i productType, fjernes det derfra ("Carlsberg Pilsner" → "Pilsner", "Gulerod Rema1000" → "Gulerod"). Brandet selv ændres ikke, og et ord der bare er en del af brandet bliver stående ("To Øl" + "Øl", "Pasta Di Maria" + "Frisk pasta").
- **Sukker, fedt og alkohol står kun i deres egne kolonner** og fjernes fra productType/variant/keywords: "med tilsat sukker", "uden tilsat sukker", "sukkerfri", "usødet" → `_is_sugar_free`; "fedtreduceret", "med mindre fedt", fedt-% → `_is_fat`; "alkoholfri" → `_is_alcohol_free`, "indeholder alkohol"/alkohol-% → `_is_alcohol`. Ingredienser og produktnavne (rørsukker, vaniljesukker, svinefedt) bliver stående. Importen (`build_data.py`) læser "med tilsat sukker" i sukker-kolonnen som keyword, ikke som sukkerfri.
- **Flertal kun for ord der har flertal**: `Product type plural` er tom for masse-ord (kylling, is, kaffe, laks, skinke, sodavand …), så flertalstitlen ikke bliver "Kogte kylling". Flertalsformer (dumplings, rejer, boller) og ord med ens flertal (jordbær, løg, brød, spyd) beholder flertallet.
- **Ord der allerede står i flertal** (dumplings, rejer, boller): ental-titlen bøjes også i flertal ("Frosne dumplings", ikke "Frosset dumplings"). Formlen i kolonne A bruger flertal, når `Product type plural` = productType.
- Keyword "tilsat kulsyre" hedder "med kulsyre" (så "tilsat" ikke står dobbelt med "med tilsat sukker").
- Står brandet (fx vandkilden) i et keyword ("fra Aqua d'Or kilden"), fjernes keywordet. Linjenavne i brandet flyttes til subbrand ("Arla Protein" → Arla + Protein) og fjernes så fra productType/keywords.
