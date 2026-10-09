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

## Bilka/REMA: ental/flertal-titler og nye regler (2026-10-09, senest)
- `HelloCal_Title` / `Hello Cal product title` er fjernet i `bilka_ny.xlsx` og `rema1000_version 2_ny.xlsx` (originalerne var låst af Excel). Erstattet af formelkolonnerne `Product title singular` / `Product title plural` (samme formler som Frida) + `Product type plural`, `_is_frozen`, `_is_raw`, `_is_cooked`. Genereret med `Excelark/titel_ental_flertal.py`; flertalsordet er gættet af regler og skal gennemses.
- Kolonner hedder som i serverens database: brand, subbrand, productType, variant, flavor (REMA taste), packageSizeText, packCount, packaging, category, barcode, keyword1-5. `_is_*`-navne beholdt.
- Original Title, Product Name, Subtitle, Source URL, Image File, Parse Status står bagerst.
- Alle `_is_`-værdier, variant og keywords med småt (undtagen store forkortelser og egennavne).
- Sukkerfri / uden tilsat sukker står i sukker-kolonnen, aldrig i variant/keyword.
- Intet ord må stå dobbelt på tværs af productType, `_is_`-felter, variant og keywords (funktionsord undtaget).
