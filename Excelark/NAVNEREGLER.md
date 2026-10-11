# Navneregler for alle ark (globale — gælder Bilka, REMA, SPAR, Nemlig, Wolt, DRK, Frida m.fl.)

Brugerens regler 2026-10-09. Samme kolonner og samme regler i ALLE ark, så der er kontinuitet.
Kort version står også i `docs/REGLER.md`.

## Originalkolonnerne rettes ALDRIG (brugerens regel 2026-10-10, gælder alle ark)
- Originalkolonner = det butikken/skraberen leverede: `Original Title`, `Product Name`, `Subtitle`, `Source URL`, `Manufacturer`, `Image File`, `Parse Status`, `Servings` (kolonne 38-45). De står bagerst i arket.
- De rettes aldrig — hverken i hånden eller med scripts: ingen stavning, forkortelser (m./u.), decimaltegn, store/små bogstaver eller flytning af tekst. De må kun læses (fx for at finde 45+, "revet", produkttypen). Alle rettelser skrives i vores egne kolonner (Product Type, Variation, Keyword 1-5, `_is_*`, Brand, Subbrand, Quantity, Clean Subtitle …).
- Markeringer fra vores egne scripts (fx PET_FOOD, BRAND_GUESS) skrives aldrig i `Parse Status`.
- Er en originalkolonne blevet ændret, hentes den tilbage fra den rå skrabning (`omlaeg_til_bilka_kolonner.py` gør det automatisk).

## Alle ark har Bilkas kolonner (2026-10-10)
- Alle butiksark er 100 % identiske med `Excelark/bilka.xlsx`: de samme 45 kolonner med samme navne og rækkefølge (se "Kolonner — ens i ALLE ark" nederst), Bilkas titelformler i A og B og **ingen ekstra kolonner** (brugeren: "de skulle være fucking identiske").
- Arbejdsarkene (altid de originale filnavne, aldrig `_ny`/`_ens`-kopier): `Excelark/bilka.xlsx`, `Produkter/rema1000_version 2.xlsx`, `Produkter/SPAR/spar.xlsx`, `Produkter/Nemlig/nemlig.xlsx`, `Excelark/wolt.xlsx`, `Excelark/drk.xlsx`, `Excelark/aarstiderne.xlsx`, `Excelark/dm.xlsx`, `Excelark/edeka.xlsx`, `Excelark/rewe.xlsx`. Dagens arbejde fra `dm_ny`/`edeka_ny`/`rewe_ny`/`wolt_ny` er flyttet ind i de originale filer 2026-10-10 (kopierne ligger i `Excelark/backup/*_ny_*_flyttet-til-*.xlsx`); de rå skrabninger, originalkolonnerne hentes fra, ligger i `Excelark/backup/<butik>_2026-10-10_raa-skrabning.xlsx` (REMA: `rema1000 - To be compaired.xlsx`).
- Omlagt med `Excelark/omlaeg_til_bilka_kolonner.py` (REMA med `omlaeg_rema.py`). `--ens` gør et omlagt ark identisk med Bilka igen (navne, rækkefølge, Quantity-stil, EAN som tekst) uden at køre reglerne igen. Backups: `Excelark/backup/*_foer_bilka-kolonner.xlsx` og `*_foer_ens-stil.xlsx`.
- Data fra de fjernede ekstra kolonner (SPAR `Subcategory`/`Vare`/`Variant`/`quantity`/`Alternativ vægt`/`_is_certificate`/`Packing`, Wolt `Price`/`Venue`, tyske `Flag` med PET_FOOD/BRAND_GUESS) ligger i `Excelark/backup/*_2026-10-10_1918_foer_ens-stil.xlsx`.

## Quantity — samme stil i alle ark (brugerens regel 2026-10-10)
- Som Bilka: tal, mellemrum, enhed med små bogstaver: `200 g`, `75 cl`, `1.5 l`, `500 ml`, `1 kg`, `6 stk`; flere stk: `6 x 0.33 l`; cirka: `ca. 600 g`. Aldrig `200g`, `1Ltr`, `200 g.`, `1 ltr.` eller `Stk`.
- Pakninger skrives med småt: `1 bakke`, `1 pose`, `1 bdt`, `1 glas`, `1 potte`, `1 net`. SPAR's koder: "400 BK" (400 g i bakke) → `400 g`, "1 PT" → `1 potte`. Tekst uden tal og "_" er ikke en mængde og ryddes. Bilkas "5 L.B" (saft til opblanding) bevares.
- Rettet 2026-10-10: Bilka 5, REMA 2773, SPAR 4904 (+ koderne), Nemlig 28, DRK 726, Årstiderne 2 (`norm_qty` i `omlaeg_til_bilka_kolonner.py`).
- Danske ark har fået Bilka-reglerne (titel_ental_flertal + procent/ost + reglerne fra 2026-10-10: brand ud af productType, revet/i blok, ben, sukker i egen kolonne, "med kulsyre", dobbeltord, flertal fra Bilka, decimalpunktum). Keywords der bare er butikkens kategorinavne er fjernet; flag-ord (økologisk, glutenfri, vegansk, fuldkorn …) står i deres `_is_`-kolonne.
- Tyske ark (dm, EDEKA, REWE): kun kolonnerne + tyske ord i stedet for "Yes" (`bio`, `glutenfrei`, `laktosefrei`, `vegan`, `zuckerfrei`, `süßungsmittel`, `alkoholfrei`) + decimalpunktum. Titelformlen skriver "Tiefgekühlt" i stedet for "Frosset" og beholder stort begyndelsesbogstav i tyske navneord. `Product type plural` er tom (ingen dansk bøjning).
- Tyske ark, `_is_` og brand (2026-10-10): `Excelark/tyske_is_og_brand.py` udfylder tomme `_is_`-kolonner med tyske ord ud fra titlen/kategorien (bio, glutenfrei, laktosefrei, vegan, zuckerfrei/ohne zuckerzusatz, süßungsmittel, alkoholfrei, enthält alkohol + "4.8%", entkoffeiniert, light, frozen, geräuchert/gekocht/getrocknet …, roh/frisch, fedt "3.5%", kødtype rind/schwein/hähnchen …, haltungsform N, oprindelsesland) og kopierer brand/subbrand 1:1 med dansk stavemåde, når et mærke fra de danske ark står forrest i den tyske titel (subbrand kun hvis det også står i titlen). Intet eksisterende overskrives, undtagen samme mærke med anden stavemåde eller `BRAND_GUESS`. Match-listen gemmes som CSV i `Excelark/backup`. Kør: `python Excelark\tyske_is_og_brand.py` (Excel-arkene lukket).
- Originalerne er hentet tilbage fra den rå skrabning, hvor tidligere omlægninger havde ændret dem: SPAR (Product Name og Original Title var byttet om), Wolt og de tyske ark (Product Name var overskrevet med en genereret titel; PET_FOOD/BRAND_GUESS i Parse Status er fjernet derfra).
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

## Frida-gennemgangen 2026-10-09/10 — samlet (gælder alle ark)
- **Nøgleord (egne Keywords, ikke Variation)**: vild, raffinol, hydrogeneret, grove/groft/fint, parboiled, tør, sød/søde, "på dåse/ konserves", "på glas", "i saltlage", "uden sten", "hele eller knækkede", "ikke beriget", saltet/usaltet, fra opdræt, acidophilus, UHT = "langtidsholdbar", colostrum, årstider/måneder ("maj til september"), "med tilsat sukker"/"med tilsat kunstig sødestof", dobbelte, instant.
- **Foran produkttypen i titlen**: sur, sød/søde, groft, fint, grove, dobbelte, instant ("Instant kakaopulver", "Groft knækbrød"). "Kaffe, instant" = Product Type "Instantkaffe".
- **Sammensatte produkttyper i én celle**: Fennikelknold, Ægte kastanje, Torskerogn, Hvedemeldurum, Korianderblade; "blade" sættes altid sammen med ordet før (Teblade). Fast + ost = "Fast-ost".
- **Delte varer**: to varer i én række deles (Rødvin/rosévin, Sortmundfilet/blåhvilling, Høstsild/fed sild, Riskiks/riskage, Sapote/stor sapodil, græsk/tyrkisk stil).
- **`_is_cooked`**: "Færdigbagt" kun for kager/småkager; alt andet færdigt (brød, røræg, detailbageri) = "Færdiglavet".
- **Små bogstaver**: alle `_is_`-værdier (også land), Keyword 1-5 og Variation starter med småt (undtagen egennavne: Beluga, Hokkaido, Thüringer, Serrano m.fl.).
- **Ental/flertal**: `Product title singular`/`plural` er formler; flertalsord i `Product type plural` (tom for masse-ord → flertalstitel = ental-titel). Flagene bøjes: vegansk→veganske, -fri→-frie; "panerede" i flertal.
- **Kommaer i Variation** fjernes (Frida brugte dem som adskiller): "med/uden/af/i/på"-led sættes med mellemrum, øvrige led "a, b og c".
- **Frida publiceres til databasen** (`scripts/frida-import/build_sheet.py` → `sheet/frida_sheet.json`, `agent.py apply_sheet`); søgereglen (flertal → plural-titel, ental → singular-titel) står i `GET /api/products`. Se docs/FRIDA.md.

## Brugerens regler 2026-10-11 (DRK- og EDEKA-gennemgangen) — gælder ALLE ark

Kilde: brugerens ordrette kommentarer efter første produkttype-kørsel i DRK, Årstiderne, Wolt, SPAR, DM, EDEKA og REWE.
Disse regler var ikke noteret før, og de blev brudt. Tjek ALLE punkter før et ark afleveres.

### Mængde, antal og enheder
1. **Quantity må aldrig indeholde både vægt/volumen og stk-tal** ("6 stk 370 g" er forbudt). Quantity = kun vægt/volumen (`370 g`, `0.5 l`).
2. **Antal stk/pak/N-pak/N x står kun i `Pack Count`** (heltal, uden tekst). Står stk-tallet også i Quantity eller titel, fjernes det dér — **ingen gentagelser på tværs af kolonner**. Var Quantity kun "N stk", ryddes Quantity (brugerens eget mønster, `Produkter/Bilka/Bilka_moenster_egne_felter.md`, punkt 6).
3. **"XX stk" må ikke stå i Quantity noget sted** (heller ikke i andre ark) — ret alle ark.
4. **Liter hedder ens på tværs af ark** (`l`; aldrig ltr/Ltr/liter/L). **Pack Count angives ens på tværs af ark** (kun tal; ikke "6-pak", "10 stk", "1 bakke").
5. **MHD og datoer ("MHD 29.09.2026") fjernes fra alt** i vores kolonner — PÅ ALLE ARK.

### Brand, produkttype, variation
6. **Brand og subbrand er egne kolonner.** Produktlinjer/underbrands (Lotus **Biscoff**, Dr. Oetker **Zitronello/Aranca**, Milka, Kanzen …) er `Subbrand`/`Brand` — aldrig i Product Type eller Variation. **Brandnavn må aldrig gentages** i Product Type, Variation eller Keywords (hverken helt eller delvist).
7. **Brandgæt må kun ske på ord der ikke er almindelige ord.** "Indbagt", "Fuldkorns", "Riesling," er ikke brands. Hellere tomt Brand end forkert brand.
8. **Product Type = selve varen** (Cider, Pils, Rotwein, Puddingcreme, Brausebonbon, Haselnüsse, Rooibos …). **Aldrig butikkens kategori** (Aromen, Getränk, Alkoholisches Getränk, Bonbons & Kaugummi, Backen & Desserts, Backzutaten & Dekor, Aromatisiertes Getränkepulver, Konserven …) og **aldrig et tal** ("5 Pils", "5 Original Weizenbier" — 5 er alkoholprocent → `_is_alcohol`).
9. **Variation = smagsvarianter og særlige kendetegn der er centrale for navn og produktbeskrivelse.** Ikke hele titlen, og ikke "hele lortet i Keyword" (DRK).
10. **Ingen ord to gange på tværs af Product Type, Variation, Keywords, Brand/Subbrand og `_is_`-felter** ("Rotwein"/"rot"; "Haselnüsse"/"Haselnüssen"/"Ganze"; "Alpenmilch…" i både type og variation).
11. **Sammensatte ord må ikke deles** ("Artischockenherzen", "Edamamebohnen") og der må ikke efterlades bindestregs-rester ("Husten-").
12. **Ordet skal være fordelt**: som udgangspunkt må intet ord fra original-teksten stå tilbage uden at være fordelt til en kolonne (Brand, Subbrand, Product Type, Variation, Keyword, `_is_`, Quantity, Pack Count). Findes der et rest-ord, er det en fejl, og der skal reageres (markeres/rettes).

### `_is_`-felter og lande
13. **Flag-ord flyttes automatisk til `_is_`-kolonnerne**: alkoholfri, sukkerfri, glutenfri, laktosefri, vegansk, økologisk/bio … — og fjernes fra Product Type/Variation/Keywords.
14. **Oprindelses-adjektiver (fransk, italiensk, chilensk …) i Variation flyttes til `_is_country_of_origen`** som landenavn (Frankrig, Italien) — **undtagen vin**, hvor de må blive i Variation.
15. **Alkoholprocent ("Alkoholgehalt: 14% vol", "5% vol")** → `_is_alcohol` (procent-kolonnen) — ikke i tekst.
16. **Certifikater (MSC, ASC, Fairtrade …) renses ud som certifikat** — ikke i Product Type/Variation.
17. **Farvestof ("Farbstoff") er Keyword; "Rosa"/farve er Variation.**

### Fjern helt
18. **Dyremad (kattemad, hundefoder …) skal fjernes fra arkene og være blacklistet** (`Produkter/Blacklistede produkter`, `src/data/pet-food-*.json`, `docs/PET-FOOD-FILTER.md`). Rækker som "Alleinfuttermittel für ausgewachsene Katzen", "Feine Mahlzeit in Gelee" skal væk.

### Arbejdsgang
19. **Overskriv aldrig tidligere korrekt udfyldte felter.** Udfyld kun tomme eller åbenlyst forkerte (kategori, tal, brand-ord, dato). Tag backup, markér ændringer med **gul** baggrund, og lad Keyword/`_is_`-kolonner være, medmindre en regel kræver det.
20. **Gennemgå → rens → kontrollér mod ALLE reglerne → ret → åbn arkene.** Ret ikke noget, før hele arket er gennemgået mod reglerne.

## Procent og ost (brugerens regel 2026-10-10) — gælder alle ark
- **% må aldrig stå i produkttype, variant eller keywords.** Fedt-% → `_is_fat` (mejeri, kød "8-12% fedt", fedtstoffer, plantedrikke); alkohol-% → `_is_alcohol` (spiritus, øl, vin, likør, cocktails). Ingrediens-% (fx "49% nougat", "70% kakao", "80% kød", "mindst 50% frugtindhold") er hverken fedt eller alkohol og fjernes fra teksten (står stadig i Original Title).
- **"45+" o.l. (NN+) betyder ost**: står altid FØRST i variant, adskilt med komma fra resten: "45+", "45+, med kommen". Står det kun i Original Title, hentes det derfra. Blandinger af flere oste beholder NN+ ved hver ost ("hvid cheddar 50+, hård modnet ost 40+ og maasdammer 45+"). Er ostens NN+ (≥45) fejlagtigt lagt i `_is_fat` som "NN%", fjernes den.
- **Produkttype der starter med %** er fejlet: typen findes i Original Title (fx P-tærter → "Fransknougat"); ingredienserne flyttes til variant hvis den er tom, ellers til et keyword.
- Gennemført i `Excelark/bilka.xlsx` 2026-10-10 (562 rækker) med `Excelark/procent_ost_regler.py`; reglen er også bygget ind i `titel_ental_flertal.py`. REMA havde ingen % i tekstfelterne.


## Titel: én parentes og tekst-flag (2026-10-10, gælder alle ark)
- **Brand og subbrand** vises som ikoner — aldrig i titlen. Det samme gælder de fleste `_is_`-felter, men **sukkerfri, glutenfri og alkoholfri** (samt koffeinfri) står også i selve teksten, fordi de er så vigtige.
- Rækkefølge i titlen: `_is_cooked` / `_is_frozen` først (som "Tørrede …", "Frosne …") → foranstillede ord (sur, sød, groft, fint, dobbelte, instant) → Product Type → Variation (lige efter produkttypen) → tekst-flag i rækkefølge: `_is_decaf`, `_is_sugar_free`, `_is_glutenfree`, `_is_lactose_free`, `_is_alcohol_free`, `_is_vegan`, light, "indeholder alkohol" → **én** parentes sidst.
- **Kun ÉN parentes**: `_is_raw` står først i parentesen efterfulgt af nøgleordene, adskilt med komma: "Skinke (fersk, afpudset)". Står der en parentes i Product Type eller Variation ("Æg (burhøns)"), flettes dens indhold ind i den samme parentes — aldrig to parenteser.
- Flertal bøjer også flagene: vegansk → veganske, -fri → -frie ("sukkerfrie").
- `_is_meat` bruges kun til vegetarer/veganere og statistik — ikke i titlen.


## Dobbeltord, brand, sukker/fedt/alkohol og flertal (brugerens regler 2026-10-10, gælder alle ark)
- **Intet ord to gange i samme celle** ("Carpaccio Carpaccio", "med chokoladesmag, med chokoladesmag" → ét). Undtaget er brandnavne, der selv gentager et ord (Mogu Mogu, Yum Yum, Chop Chop).
- **Brandnavnet står aldrig i productType**: står hele brand-/subbrandnavnet i productType, fjernes det derfra ("Carlsberg Pilsner" → "Pilsner", "Gulerod Rema1000" → "Gulerod"). Brandet selv ændres ikke, og et ord der bare er en del af brandet bliver stående ("To Øl" + "Øl", "Pasta Di Maria" + "Frisk pasta").
- **Sukker, fedt og alkohol står kun i deres egne kolonner** og fjernes fra productType/variant/keywords: "med tilsat sukker", "uden tilsat sukker", "sukkerfri", "usødet" → `_is_sugar_free`; "fedtreduceret", "med mindre fedt", fedt-% → `_is_fat`; "alkoholfri" → `_is_alcohol_free`, "indeholder alkohol"/alkohol-% → `_is_alcohol`. Ingredienser og produktnavne (rørsukker, vaniljesukker, svinefedt) bliver stående. Importen (`build_data.py`) læser "med tilsat sukker" i sukker-kolonnen som keyword, ikke som sukkerfri.
- **`Product type plural` må aldrig stå tom** (brugerens regel 2026-10-11). Har ordet ingen anden flertalsform, står samme ord (kylling, is, kaffe). Ryddet 2026-10-10 ved en fejl og sat tilbage fra backup 2026-10-11 (Bilka 692, REMA 1.493).
- **Ord der allerede står i flertal** (dumplings, rejer, boller): ental-titlen bøjes også i flertal ("Frosne dumplings", ikke "Frosset dumplings"), men masse-ord bliver i ental ("Kogt kylling"). Formlen i kolonne A bøjer i flertal, når `Product type plural` = productType OG hovedordet (sidste ord før " i ") ender på -er/-s og ikke er laks, is, ris, majs, ananas, gyros, lakrids, fars, mos, sukker, peber, lever, cider eller pulver.
- Keyword "tilsat kulsyre" hedder "med kulsyre" (så "tilsat" ikke står dobbelt med "med tilsat sukker").
- Står brandet (fx vandkilden) i et keyword ("fra Aqua d'Or kilden"), fjernes keywordet. Linjenavne i brandet flyttes til subbrand ("Arla Protein" → Arla + Protein) og fjernes så fra productType/keywords.
- **Lande og "/" står aldrig i brand** (brugerens regel 2026-10-10): et land eller en oprindelse i brand ("Peru", "Danmark/Tyskland", "Hollandsk") flyttes til `_is_country_of_origen` (med stort begyndelsesbogstav, flere lande med " / ": "Danmark / Tyskland" — ændret 2026-10-10 fra små bogstaver, se "SPAR: anb, zinf, bdt, øko, lande"), og brand tømmes. "/" alene er aldrig et brand.
- **Ord fra brandet må aldrig bare forsvinde** (brugerens regel 2026-10-10): når brandfeltet renses, flyttes logo-ord til subbrand ("Mini Babybel" → Babybel + subbrand Mini), varianter til variant ("Tic Tac Exotic Escape" → variant "Exotic Escape"). Kun varekoder ("G54 X 24") slettes.


## Decimaltegn: punktum i arkene (brugerens regel 2026-10-10, gælder alle ark)
- Decimaler skrives altid med punktum i arkene: "1.5 l", "3.6%", "13.5%", "0.5% fedt", "462.50/Kg". Appen viser selv komma for Danmark og de andre komma-lande ("1,5 liter") og punktum for punktum-lande (docs/DECISIONS.md 2026-10-10 på master).
- Intet tusindtalspunktum: "1.080 g" → "1080 g" (ellers læses det som 1.08 g). "8 x 24.125 g" er allerede et decimaltal og bliver stående.
- Ødelagte decimaler med mellemrum ("0, 5 l", "462, 50/Kg", "3, 5-3, 7 kg") rettes til punktum i mængde, Clean Subtitle og produkttype. Komma med mellemrum i navne er en opremsning ("Batch 99, 75cl", "45+, med kommen") og røres ikke. Originalkolonnerne (Original Title, Product Name, Subtitle, Source URL, Image File) røres aldrig.
- Gennemført 2026-10-10 i vores egne kolonner: `Excelark/bilka.xlsx`, `Produkter/rema1000_version 2.xlsx` (191) og `Frida-ark/frida.xlsx` (11). Bilkas originalkolonner (Original Title, Product Name, Subtitle — 12.207 celler), som ved en fejl også blev rettet, er hentet tilbage fra backuppen. Bilka række 2 (Björnsted mørk chokolade) havde "70%" kakao som tallet 0.7 i variant — ryddet (ingrediens-%). Backups `Excelark/backup/*_foer_decimalpunktum.xlsx`. De øvrige ark (SPAR, Nemlig, Wolt, DRK m.fl.) får reglen, når de tages op.
- Indført 2026-10-10 i SPAR, Nemlig, Wolt, DRK, Årstiderne, dm, EDEKA og REWE — kun i vores egne kolonner. Originalkolonnerne får aldrig punktum (se "Originalkolonnerne rettes ALDRIG"). NB: decimal-passet på Bilka ændrede også Bilkas originaler (Original Title 150, Product Name 1291, Subtitle alle rækker); de kan hentes tilbage fra `Excelark/backup/bilka_2026-10-10_1445_foer_decimalpunktum.xlsx`.


## REMA: flavor er lagt ind i variant (brugerens regel 2026-10-10)
- Kolonnen `flavor` er slettet; smagen står nu i `variant`. Tom variant → smagen; "med …"-led sættes efter ("grill med hvidløg", "med tykmælk og æg"); to smagsord → "vanilje og skovbær"; ellers med mellemrum som titlen viste før ("cultura hindbær", "max lime"). "røget" → `_is_cooked`, "saltet"/"usaltet" → `keyword1`. Titelformlerne bruger nu kun `variant`.


## Engelsk "sugarfree" (brugerens regel 2026-10-10, gælder alle ark)
- Kun sukkerfeltet rettes: står der engelsk sugarfree / sugar free / zero sugar / no sugar på varen, skal sukkerfeltet være "sukkerfri" ("no added sugar" → "uden tilsat sukker"). Ordet fjernes IKKE fra navn/variant, da det ofte er en del af det engelske produkt- eller brandnavn (Coca-Cola Zero Sugar). Rettet 2026-10-10: Bilka 1 række (Mirinda zero sugar); REMA's 6 rækker havde allerede "sukkerfri".


## Kolonner — ens i ALLE ark (2026-10-10, også de tyske)
Samme navne og rækkefølge i Frida, Bilka, REMA, Årstiderne, DRK, Nemlig, DM, Edeka m.fl. (kontrolleret):
1 Product title singular · 2 Product title plural · 3 Quantity · 4 Brand · 5 Subbrand · 6 EAN · 7 Pack Count · 8 Product Type · 9 Variation · 10 Category · 11 Packaging ·
12 _is_alcohol · 13 _is_country_of_origen · 14 _is_organic · 15 _is_glutenfree · 16 _is_lactose_free · 17-21 Keyword 1-5 · 22 _is_sweeteners · 23 _is_meat · 24 _is_vegan ·
25 _is_allergy · 26 _is_sugar_free · 27 _is_fat · 28 _is_alcohol (%) · 29 Clean Subtitle · 30 _is_whole_grain · 31 _is_animal_welfare · 32 _is_frozen · 33 _is_raw ·
34 _is_cooked · 35 _is_decaf · 36 _is_alcohol_free · 37 Product type plural · 38 Original Title · 39 Product Name · 40 Subtitle · 41 Source URL · 42 Manufacturer · 43 Image File ·
44 Parse Status · 45 Servings · derefter ark-specifikke kolonner (fx FoodID, _is_processed, _is_light).
- Aldrig `barcode`/`variant`/`keyword1` — kolonnerne hedder `EAN`, `Variation`, `Keyword 1`. EAN vises som helt tal (talformat 0).


## SPAR: anb, zinf, bdt, øko, lande (brugerens regler 2026-10-10, gælder alle ark)
- **anb / anbrud** = anbrud (åbnet/brudt kolli): ordet slettes fra alle egne kolonner (Keyword, Product Type, Variation, Subbrand); aldrig i originalkolonnerne.
- **zinf** (også zinfa/zinfandl/zinfandel14) = **zinfandel**: erstattes; står ordet allerede i Variation, slettes keywordet (intet dobbeltord).
- **Nbdt** (fx 14bdt) = **N per bundt**: keywordet skrives "14 per bundt".
- **Øko** (økol, øko, økoo, Øko-… og sammensætninger som Økohavregryn): `_is_organic` = "økologisk", og selve øko-ordet slettes fra de øvrige egne kolonner (Økohavregryn → Havregryn). Et brand der hedder Økolandet bliver stående, men rækken får `_is_organic`. NB: "Org" i slik/snack betyder Original, ikke økologisk.
- **Lande** i `_is_country_of_origen` skrives med stort begyndelsesbogstav ("Frankrig", "New Zealand", "Danmark / Irland").
- **Keyword 1-5**: ord der allerede står i brand/subbrand/produkttype/variant/`_is_`-felter (eller er afkortede/stavefejl af dem) slettes; delte fraser samles ("ice" + "cream" → "ice cream"); huller lukkes mod venstre. Script: `Excelark/spar_ikke_vin_rettelser.py` (kører på alle rækker undtagen Category "Vin og spiritus", som vin-sessionen ejer). Indført i SPAR 2026-10-10.
- Samme regler kørt på SPAR, Wolt, Årstiderne og Frida 2026-10-10 (brandnavn som keyword slettes, sukker/fedt/alkohol i egne kolonner, "med kulsyre"). "med tilsat kunstig sødestof" → `_is_sweeteners` = sødestoffer. Flertal (ental = flertal) rettes IKKE automatisk — gennemgås med brugeren til sidst. Nemlig og DRK venter, til produkttypen er flyttet ud af Keyword 1.



## Vin: produkttype, brand, subbrand, variation og nøgleord (brugerens ønske 2026-10-10, alle ark)
- **Omfang**: alle vin-rækker i Bilka, REMA, SPAR, Nemlig, Wolt, DRK, EDEKA og REWE (Årstiderne og dm har ingen vin). Hvor spiritus ligger sammen med vin (SPAR "Vin og spiritus", Nemlig, DRK, REMA) er den med; spiritus får kun ryddet brand/subbrand/variation/nøgleord.
- **Product Type** (ental, stort begyndelsesbogstav): Rødvin, Hvidvin, Rosévin, Orangevin, Mousserende vin, Champagne, Cava, Prosecco, Crémant, Portvin, Sherry, Madeira, Marsala, Vermouth, Hedvin, Dessertvin, Sangria, Kirsebærvin/Frugtvin, "Vin" kun når farven umulig kan afgøres. Tysk: Rotwein, Weißwein (altid ß), Roséwein, Schaumwein, Sekt, Prosecco, Champagner, Crémant, Cava, Perlwein, Portwein, Sherry, Wermut, Glühwein, Fruchtwein. Alkoholfri vin har samme type som vinen + `_is_alcohol_free`. Kategorinavne ("Prosecco & Perlwein", "Weinspezialitäten") og beskrivende tekster er aldrig produkttype. `Product type plural`: Rødvine, Hvidvine, Rosévine …; Champagne/Cava/Prosecco/Crémant = samme ord; Sherry/Vermouth/Madeira/Marsala tom; tyske ark tom.
- **Brand** = producent/mærke fuldt udskrevet ("El" → "El Coto", "Finca" → "Finca de la Vega"). Aldrig druesort, appellation, land, farve eller importør.
- **Subbrand** kun for en linje under brandet med eget logo ("B by Black Tower", "Cordon Negro"). Appellationer og cuvéenavne står i Variation (SPAR havde ~195 appellationer i Subbrand). Er man i tvivl: tom.
- **Variation** = vinens navn efter brand og type: appellation + cuvée + druesorter, i titlens rækkefølge ("chablis la pierrelée", "pinot noir", "côtes du rhône, grenache og syrah"). Små bogstaver i danske ark, tysk stavning i tyske. Lister "a, b og c" / "a, b und c". Farveordet (rød/hvid/rosé) er typen og står ikke igen. Brandord fjernes kun, hvor de bare gentager brandet.
- **Nøgleord** (højst 5): sødme/stil (tør, brut, sec, demi-sec / Trocken, Halbtrocken, Feinherb), kvalitet (reserva, gran reserva, crianza, riserva, DOC, DOCG, AOC, IGT, Kabinett, Spätlese), årgang (4 cifre). Tyske ark: region (Baden, Pfalz …) først. Afkortede ord (cab, sauv, chard, zinf, rosä, bib, tempranil) er rettet eller slettet; brandord står aldrig som nøgleord.
- **Egne felter**: `_is_country_of_origen` (stort begyndelsesbogstav; kun hvis angivet eller entydigt af appellation/producent — aldrig udledt af EAN-præfiks eller pris), `_is_organic` (øko/bio), `_is_alcohol_free`, alkohol-% i anden `_is_alcohol`-kolonne (decimalpunktum, tom for alkoholfri), `Packaging` = "Bag-in-box"/"Karton" kun hvis teksten selv siger det. Årstal står som nøgleord; anb/anbrud slettes; zinf → zinfandel.
- **Gennemført 2026-10-10** (backup `Backup\*_foer_vin.xlsx`; kun egne celler, rækker matchet på Source URL, originalkolonner uændrede): Bilka 1.499 celler i 635 rækker, REMA 281/141, SPAR 2.291/782, Nemlig 760/85, EDEKA 1.009/406, REWE 531/254, Wolt 65/15, DRK 262/39 (i alt 6.698). 5 rækker (SPAR 3, Wolt 2) blev sprunget over, fordi andre ændrede dem undervejs. Kvalitet: 1.201 usikre rækker gennemgået af en anden agent, uafhængig stikprøve (128 rækker) gav samme resultat i ~94 %.
- **Kendt rest**: ~17 småfund — spiritus uden produkttype (fx Ga-Jol, Sevablødda), "&" i tre REWE-variationer ("Steitz & Beck" under brandet Weinfreunde), "Hakket grisekød" med produkttype Hvidvin i Bilka er rettet.
- **Værktøj**: reglerne som agenterne fik står i `Excelark/vin_regler_spec.md`; skrivningen (backup, match på Source URL, kun egne celler) er `Excelark/vin_regler.py` + `vinlib.py`.


## Open Food Facts-import: Lidl, Aldi, Kvickly/Coop (brugerens ønske 2026-10-11)
- **Ark**: `Excelark/lidl.xlsx`, `aldi.xlsx`, `kvickly.xlsx` (Coop-mærkerne) — Bilkas 45 kolonner, Bilkas titelformler, ingen ekstra kolonner. Menu/Meny har ingen egne mærker ud over Dagrofas (Gestus, First Price, Grøn Balance, Omhu, Spicefield, Banderos), som allerede står i `spar.xlsx`.
- **Kilde**: `Excelark/off_hent.py` henter rå OFF-poster (kun `countries_tags` = Danmark) til `Backup/off_raa/brand_<slug>.json` / `store_<slug>.json`; `Excelark/off_import.py` bygger arkene. Rækkerne er kun varer med et af butikkens egne mærker (listen står i `STORES` i `off_import.py`); kædenavnet alene (Lidl/Aldi/Coop) tæller kun, hvis varen er registreret i den butik.
- **Originalkolonnerne = rå OFF** (`Original Title` = `product_name`, `Product Name` = `product_name_da` eller `product_name`, `Subtitle` = generic name, `Source URL` = OFF-siden, `Image File` = OFF-billed-URL, `Manufacturer` = andre mærker på varen, `Servings` = serving_size). De rettes aldrig; `Parse Status` er tom.
- **Felter krydstjekkes mellem OFF's signaler** (label, navn, ingredienser, allergener, næringsindhold): økologisk = label og/eller navn (ikke "ikke økologisk"); glutenfri sættes ikke, hvis allergenerne har gluten; vegansk sættes ikke, hvis allergenerne har mælk/æg; sukkerfri sættes ikke, hvis sukker pr. 100 g er over 2,5 (så "uden tilsat sukker"); sødestoffer fra ingredienslisten; fedt-% kun for mejeri/kød/fedtstoffer og krydstjekkes mod næringsindholdet; alkohol-% kun i anden `_is_alcohol`; kategorien Frost sætter `_is_frozen`.
- **Product Type** hentes først fra de eksisterende arks vokabular (Bilka, SPAR, REMA, Wolt; længste hele-ord-match), derefter OFF's mest specifikke danske kategori, ellers navnet. Kategori og flertal følger vokabularet. Alt der ikke er i vokabularet står som "Mistanke" i `Excelark/off_kvalitetskontrol.xlsx`.
- **Håndrettelser**: `Excelark/off_rettelser.txt` (`EAN|Product Type|Variation|Category|nøgle=værdi;…`, `~` = tøm, `drop` = fjern, `qa=` = note) lægges ovenpå reglerne ved hver kørsel; før/efter logges i kvalitetskontrollen. Fremmedsprogede OFF-poster uden dansk dokumentation er fravalgt (fanen "Fravalgt manuelt").
- Kør: `py -3 Excelark\off_hent.py brand <slug> …` / `store <slug> …`, derefter `py -3 Excelark\off_import.py` (Excel-arkene lukket). Backups: `Backup/<butik>_*_foer_off-import.xlsx`.
- **Flertalstitlen (kolonne B)** = ental-titlen, når `Product type plural` = Product Type og hovedordet er et masse-ord (samme test som kolonne A). Så står der aldrig "Kogte kylling" — hverken i ental eller flertal. Lagt ind i alle ark 2026-10-11 (bilka, rema, spar, wolt, aarstiderne, frida, drk, nemlig).


## Optimering af dm, EDEKA, REWE og Wolt efter Bilka-mønsteret (brugerens opgave 2026-10-10/11)
- **Trin 1 – faste regler** (`Excelark/optimer_ark.py dm edeka rewe wolt`, backup `Excelark/backup/*_foer_optimering.xlsx`, alle ændringer i `Excelark/backup/optimering_<tid>.csv`): mellemrum/EAN som tekst/Quantity-stil; `_is_`-værdier med småt (lande med stort); brand-stavemåde (kun store/små bogstaver og tegnsætning) og blankt brand udfyldt fra titlen via kendte mærker (almindelige ord som "Frisk"/"Original" er ikke mærker); skrald i brandfeltet ryddet; brand/subbrand ud af Product Type; mængde/antal/procent ud af Product Type og Variation (fedt-% → `_is_fat`, alkohol-% → `_is_alcohol`, "NN % Fett i. Tr." → "NN+", ingrediens-% fjernet); "/" i Variation → "a, b und c"; dobbeltord; keywords der egentlig er en anden kolonne (ohne Zuckerzusatz, entkoffeiniert, Dose/Glas → Packaging) flyttet; `_is_` udfyldt fra titlen kun ved eksplicitte ord (bio, glutenfrei, laktosefrei, vegan, zuckerfrei, alkoholfrei, entkoffeiniert, vollkorn, Haltungsform N, "aus Italien"); frost fra kategorien (Tiefkühl-*, Eis im Becher …); Clean Subtitle = "Brand | Quantity" følger brand/mængde.
- **Ikke udfyldt automatisk i de tyske ark**: `_is_cooked` og `_is_raw` (titelformlen sætter dem forrest uden tysk bøjning → "Geräuchert Lachs"), `_is_meat` (for mange falske hits som "Chili con Carne"). Flertal er tomt (ingen tysk bøjning).
- **Vin/spiritus/øl** (rækker med `_is_alcohol`) røres kun hygiejnisk — de ejes af vin-sessionen (se afsnittet ovenfor).
- **Trin 2 – AI-gennemgang** af Product Type/Variation/Keywords (workflow `produkttype-gennemgang`, 30 rækker pr. agent + uafhængig kontrol af usikre rækker og hver 8. række): forslagene anvendes af `Excelark/anvend_ai_forslag.py <butik> <resultatmappe>` — sikkerhed ≥ 4 erstatter, 3 kun hvor feltet er tomt/butikkens kategori, ≤ 2 skrives ikke (liste til gennemgang). Celler der er ændret siden forslaget blev lavet springes over. Ikke-mad og dyrefoder samles i egne lister (rækkerne slettes ikke).
- **Gengangere** (`Excelark/gengangere-fund.xlsx`, kun rapport): samme produkt kan have forskellig stregkode i to lande; derfor sammenlignes brand + mængde + navn, ikke kun EAN. Vin hvor kun årgangen adskiller er en egen fane.

