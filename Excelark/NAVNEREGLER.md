# Navneregler for alle ark (globale — gælder Bilka, REMA, SPAR, Nemlig, Wolt, DRK, Frida m.fl.)

Brugerens regler 2026-10-09. Samme kolonner og samme regler i ALLE ark, så der er kontinuitet.
Kort version står også i `docs/REGLER.md`.

## Originalkolonnerne rettes ALDRIG (brugerens regel 2026-10-10, gælder alle ark)
- Originalkolonner = det butikken/skraberen leverede: `Original Title`, `Product Name`, `Subtitle`, `Source URL`, `Image File`, `Parse Status` + butikkens øvrige skrabede kolonner (`Manufacturer`, `Servings`, `Price`, `Venue`, SPAR `Subcategory`/`Vare`/`Variant`/`quantity`). De står bagerst i arket.
- De rettes aldrig — hverken i hånden eller med scripts: ingen stavning, forkortelser (m./u.), decimaltegn, store/små bogstaver eller flytning af tekst. De må kun læses (fx for at finde 45+, "revet", produkttypen). Alle rettelser skrives i vores egne kolonner (productType, variant, keyword1-5, `_is_*`, brand, subbrand, packageSizeText, Clean Subtitle …).
- Markeringer fra vores egne scripts (fx PET_FOOD, BRAND_GUESS) skrives i kolonnen `Flag`, aldrig i `Parse Status`.
- Er en originalkolonne blevet ændret, hentes den tilbage fra den rå skrabning (`omlaeg_til_bilka_kolonner.py` gør det automatisk).

## Alle ark har Bilkas kolonner (2026-10-10)
- Kolonne 1-43 er præcis som `Excelark/bilka.xlsx`: samme navne, samme rækkefølge og Bilkas titelformler i A (`Product title singular`) og B (`Product title plural`). Butikkens ekstra kolonner står bagerst efter `Parse Status`: først skrabede originaler, så vores egne (SPAR `Alternativ vægt`, `_is_certificate`, `Packing`; tyske ark `Flag`).
- Omlagt 2026-10-10 med `Excelark/omlaeg_til_bilka_kolonner.py`: `Produkter/SPAR/spar.xlsx`, `Produkter/Nemlig/nemlig.xlsx`, `Excelark/wolt_ny.xlsx`, `Excelark/drk.xlsx`, `Excelark/aarstiderne.xlsx`, `Excelark/dm_ny.xlsx`, `Excelark/edeka_ny.xlsx`, `Excelark/rewe_ny.xlsx`. Backups: `Excelark/backup/*_foer_bilka-kolonner.xlsx`. Scriptet kan køres igen fra en backup: `python omlaeg_til_bilka_kolonner.py spar --fra=backup/<fil>`.
- Danske ark har fået Bilka-reglerne (titel_ental_flertal + procent/ost + reglerne fra 2026-10-10: brand ud af productType, revet/i blok, ben, sukker i egen kolonne, "med kulsyre", dobbeltord, flertal fra Bilka, decimalpunktum). Keywords der bare er butikkens kategorinavne er fjernet; flag-ord (økologisk, glutenfri, vegansk, fuldkorn …) står i deres `_is_`-kolonne.
- Tyske ark (dm, EDEKA, REWE): kun kolonnerne + tyske ord i stedet for "Yes" (`bio`, `glutenfrei`, `laktosefrei`, `vegan`, `zuckerfrei`, `süßungsmittel`, `alkoholfrei`) + decimalpunktum. Titelformlen skriver "Tiefgekühlt" i stedet for "Frosset" og beholder stort begyndelsesbogstav i tyske navneord. `Product type plural` er tom (ingen dansk bøjning).
- Originalerne er hentet tilbage fra den rå skrabning, hvor tidligere omlægninger havde ændret dem: SPAR (Product Name og Original Title var byttet om), Wolt og de tyske ark (Product Name var overskrevet med en genereret titel; PET_FOOD/BRAND_GUESS i Parse Status → `Flag`).
- Frost følger kategorien Frost/Dybfrost (som Bilka). SPAR's gamle Packaging "Frozen" stod også på vin, sodavand osv. og er fjernet dér (390 rækker).
- Nemlig, DRK og Årstiderne er ikke gennemgået endnu: productType mangler for de fleste, og keywords er skraberens ord fra titlen — titlerne bliver først pæne, når de er gennemgået som Bilka.
- REMA (`Produkter/rema1000_version 2.xlsx`) har stadig sine egne kolonnenavne (`is_vegan`, `Type`, `size` …) og er ikke omlagt.

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
- Rettelsen skrives i Variation — selve originalfeltet røres ikke (se "Originalkolonnerne rettes ALDRIG").
- `m.` `m/` `m` → **med**, `u.` `u/` → **uden**, samt `i`, `af`.
- Det, der står efter dem og ligger i Variation, skrives med lille begyndelsesbogstav og får ordet foran:
  "Ymerdrys m. kanel" → Variation `med farin og kanel`.
- med / uden / i / af / på / fra / tilsat står altid med småt i Variation og titel.

## Keywords
- Aldrig deles midt i en frase: `Uden tilsat sukker` er ét keyword (ikke `Uden` + `Tilsat sukker`).
- Vitaminer hører ikke hjemme i keywords, men i specifikationsarket (`*_vitamins.xlsx` / `*_product_information.xlsx`).

## Andet
- Instantkaffe hedder altid "Instantkaffe" (Product Type) — ikke "Kaffe, instant".
- Kolonner er ens i alle ark (Bilka er master) — se "Alle ark har Bilkas kolonner" øverst.

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
- Intet ord må stå dobbelt på tværs af productType, `_is_`-felter, variant og keywords (funktionsord undtaget).
- Opdatering 2026-10-10: `Excelark/bilka.xlsx` og `Produkter/rema1000_version 2.xlsx` er selv omskrevet (ikke kun `_ny`). `scripts/store-products-import/build_data.py` læser både nye (databasenavne) og gamle kolonnenavne via `NEW_ALIAS` i `load()`.

## Tekst fra original titel → variant (2026-10-10, Bilka/REMA)
- Det, der står efter m./m/med, u./uden, i, af, "smag af" i den originale titel, og som ikke findes på rækken i forvejen, skrives i **variant** (med "med/uden/i" foran, alt med småt). Undtagelse: "i bundt" og "i bakke" er nøgleord.
- Kun hvis intet af ordene allerede findes et sted på rækken (produkttype, variant, nøgleord, `_is_`-felter, brand).
- Mærkenavne i variant/nøgleord skrives med stort (fx "Tyrkisk Peber", "Aqua d'Or", "San Pellegrino"). Mærket i Brand (fx "M&M's") tilføjes aldrig til variant.
- "m" i "M&M's" er ikke "med". HTML som `<BR>` i originalteksten skal ikke med.
- 45+ (osteprocent i tørstof) står i variant, ikke i produkttype.
