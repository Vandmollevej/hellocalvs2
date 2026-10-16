# Opgave: ryd produktdata i et butiksark (Product Type, Brand, Subbrand, Co-brand, Variation, flag)

Du får en JSON-fil med rækker fra et dansk eller tysk dagligvareark. For hver række skal du levere de **endelige** værdier for
vores egne kolonner efter reglerne nedenfor. Originalkolonnerne (`orig_title`, `subtitle`) må aldrig ændres — de er kun kilde.
Arkene er allerede gennemgået delvist af tidligere trin, så **mange rækker er rigtige i forvejen**: rør kun det, der bryder en regel.
Læs hver række selv (titel + nuværende felter) — rækken er udvalgt fordi den ER mistænkt, men fejlen kan også ligge et andet sted end `_issues` peger.

Rækkens felter i input: `row`, `orig_title`, `subtitle`, `brand`, `subbrand`, `cobrand`, `category` (butikkens kategori), `product_type` (nu),
`variation` (nu), `keywords` (nu), `flags` (nu: de udfyldte `_is_`-felter), `quantity`, `pack_count`, `lang` (`da`/`de`), `_issues` (hvad kontrollen mistænker).

## Output pr. række (alle felter skal med)
```
{"row": <int>, "remove": <bool>, "brand": <str|null>, "subbrand": <str|null>, "cobrand": <str|null>, "product_type": <str|null>,
 "product_type_plural": <str|null>, "variation": <str|null>, "keywords": [<str>, ...],
 "flags": {"organic": <str?>, "alcohol_free": <str?>, "sugar_free": <str?>, "glutenfree": <str?>, "lactose_free": <str?>, "vegan": <str?>},
 "country": <str|null>, "alcohol_percent": <str|null>, "confidence": "high|medium|low", "note": <str|null>}
```
- Behold den nuværende værdi, hvis den allerede følger reglerne (rør ikke ved noget, der er korrekt). Ret kun det, der bryder en regel.
- `note`: skriv kort, hvis du er i tvivl eller et ord ikke kunne placeres. Aldrig gæt brand eller produkttype uden grund — sæt hellere `confidence: "low"` + `note`.
- Skriv præcis én output-post pr. input-række (samme `row`).

## Reglerne (brugerens regler 2026-10-11, suppleret 2026-10-15)
1. **Product Type = selve varen** i ental, som en person ville navngive den: "Cider", "Pils", "Rotwein", "Puddingcreme", "Brausebonbon", "Haselnüsse",
   "Schokolade", "Rooibos-Tee", "Müsli", "Skyr", "Rullepølse". **Aldrig** butikkens kategori ("Aromen", "Getränk", "Alkoholisches Getränk", "Bonbons & Kaugummi",
   "Backen & Desserts", "Backzutaten & Dekor", "Aromatisiertes Getränkepulver", "Konserven", "Süßwaren", "Tee in Beutel & lose" …), **aldrig et tal**, aldrig en
   lang beskrivelse/sætning ("Arzneitee bei Symptomen der Bronchitis" → "Husten- und Bronchialtee"/"Arzneitee"), aldrig et brand, aldrig **hele titlen**
   (varen skal skilles fra mærke, smag og kendetegn). Brug 1-3 ord. Står varen ikke i titlen men er oplagt (fx Pilsner/Helles → "Bier"/"Pils", Châteauneuf-du-Pape → "Rotwein"),
   så er det fint at bruge den almindelige varebetegnelse.
2. **Brand** er mærket (producenten). Er `brand` udfyldt i input, er det normalt rigtigt — behold det og dets stavemåde (Excel ruler: ret ikke stavemåde/store bogstaver på noget der
   bare er stavet anderledes). Ret kun et brand der tydeligt er forkert eller afkortet (fx "Schloss" når titlen siger "Schloss Wachenheim", "Ardbeg Whisky" → "Ardbeg", "Deutsches"
   når titlen siger "Deutsches Essig-Brauhaus") eller tomt, hvor titlen tydeligt starter med mærket. Brand må **aldrig** stå i Product Type, Variation eller Keywords, hverken helt eller delvist.
3. **Subbrand** = brandets egne produktlinjer/fantasinavne (EDEKA **Herzstücke**, Dr. Oetker **Aranca/Zitronello/Backfeste**, Nissin **Kanzen Meal**, Haribo **Goldbären**, Tuborg **Grøn**).
   **Almindelige ord er IKKE subbrands**: navneord, smagsretninger, produkttyper, flag og generiske ord ("Bio", "Vegan", "Zero", "Original", "Classic", "Extra", "Creamy", "Crunch", "Protein" …) —
   især under private labels (EDEKA, REWE, dm, Gestus, First Price, REMA 1000, Salling). Står et sådant ord som subbrand nu (fx EDEKA + subbrand "Bio"), så fjern det
   fra subbrand (flag hvis det er et flag, ellers variation). Et eksisterende ægte subbrand (fx "Herzstücke", "Beste Wahl", "Balea") skal **bevares**. Sæt kun nyt subbrand, når
   titlen klart har en produktlinje efter brandet; er du i tvivl, så lad ordet blive i Variation.
4. **Co-brand** (`cobrand`) = et *andet* brand som varen låner/er lavet med (Biscoff eller TUC i en Milka-chokolade, Milka i Jacobs-kaffe, Coca-Cola i Jack Daniel's, Nogger/Solero under Cremissimo).
   Er Co-brand allerede udfyldt og rigtigt, så behold det. Sæt det kun ved et tydeligt lånt brand; ordet må så ikke også stå i Variation/Keywords. Ellers `null`.
5. **Variation** = smagsvarianter og særlige kendetegn, der er centrale for navn og beskrivelse ("Vanille", "Salted Caramel Nut", "mit Kamille", "med chokolade",
   "Aprikose-Maracuja", "Cabernet Sauvignon", "trocken", "ganze"). Ikke hele titlen. Dansk: **lille begyndelsesbogstav**, "med/uden/i/af" med småt. Tysk: som i titlen.
6. **Ingen ord to gange** på tværs af Brand, Subbrand, Co-brand, Product Type, Variation, Keywords og flag. ("Rotwein" + variation "rot" er forbudt; "Haselnüsse" + "ganzen Haselnüssen" er forbudt.)
   Fjern gentagelsen fra Variation/Keywords.
7. **Sammensatte ord må ikke deles** ("Artischockenherzen", "Edamamebohnen", "Hustentee") og der må ikke efterlades bindestregs-rester ("Husten-", "mit -Crackern"). Skriv ordet samlet.
8. **Hvert ord i `orig_title` skal være fordelt** til en kolonne (brand, subbrand, cobrand, product_type, variation, keywords, flags, country, alcohol_percent) — undtagen tal,
   mængder (g, ml, l, stk, 6x…), datoer/MHD, funktionsord (mit/und/in/für, med/og/i/af), salgstekst (Abverkauf, Angebot, Neu …) og ord, der er flag/certifikater. Findes der rest-ord, så placér dem
   (oftest Variation, eller Brand/Subbrand hvis det er et mærke). Små stavevarianter (Hafer-Drink = Haferdrink, Cuvée = Cuvee) tæller som fordelt.
9. **Flag** flyttes til `flags` og fjernes fra type/variation/keywords: alkoholfri/alkoholfrei → `alcohol_free`; sukkerfri/zuckerfrei/ohne Zuckerzusatz → `sugar_free`;
   glutenfri/glutenfrei → `glutenfree`; laktosefri/laktosefrei → `lactose_free`; vegansk/vegan → `vegan`; økologisk/bio → `organic`. Værdien er ordet på arkets sprog
   (de: "alkoholfrei", "zuckerfrei", "glutenfrei", "laktosefrei", "vegan", "bio"; da: "alkoholfri", "sukkerfri", "glutenfri", "laktosefri", "vegansk", "økologisk").
   Er et flag allerede udfyldt i input, så behold det.
10. **Alkoholprocent** ("Alkoholgehalt: 14% vol", "5,0 Pils", "4,6%") → `alcohol_percent` (fx "14%"), aldrig i tekst eller som produkttype. Tal er aldrig produkttype. Opfind aldrig et tal der ikke står i titlen.
11. **MHD og datoer** ("MHD 29.09.2026", "- MHD 30.09.2026") fjernes helt — de må ikke stå nogen steder i dine felter.
12. **Certifikater** (MSC, ASC, Fairtrade, Rainforest, Demeter, Bioland …) renses ud: de står hverken i type, variation eller keywords.
13. **Oprindelses-adjektiver** (fransk/französisch, italiensk/italienisch, chilensk …) → `country` som landenavn på arkets sprog (de: "Frankreich", da: "Frankrig"),
    **undtagen vin**, hvor de må blive i Variation. Rene landeangivelser i titlen ("aus Deutschland") → `country`. Opfind aldrig et land der ikke belægges i titlen.
14. **Farvestof ("Farbstoff") er Keyword**, farven ("Rosa", "Rot") er Variation. Keywords er korte beskrivende attributter (maks. 5), fx "ohne Konservierungsstoffe", "Dose", "pålæg".
    Kopier ikke titelord ind i Keywords uden grund; behold gode eksisterende keywords.
15. **Dyremad og andet der ikke er menneskeføde** (kattemad, hundefoder, fuglefoder, tyggeben, dental sticks til hunde, kattegræs, kæledyrstilbehør, "Alleinfuttermittel",
    "Hundefutter", "Katzenfutter", "für Hunde/Katzen") → `remove: true`. Alle andre felter kan så være null.
16. **Flertal** (`product_type_plural`): **kun danske ark (`lang` = `da`)**: flertalsformen af produkttypen; er ordet et masse-/ubøjeligt ord eller allerede i flertal, så gentag samme ord. Aldrig tom (undtagen remove).
    **Tyske ark (`lang` = `de`): sæt `product_type_plural` til `null`** (tomt flertal er bevidst i de tyske ark).
17. **Salgs-/kampagnetekst** ("Abverkauf", "Angebot", "Aktion", "Neu", "Tilbud", "Etikett beschädigt") er ikke en produktegenskab: ignorér den (ingen kolonne).
18. **Forkortelser i butikstitler** (Wolt/SPAR/DRK/REMA): GLF/GF = glutenfri (flag glutenfree), LF = laktosefri (lactose_free), ØKO/ØK = økologisk (organic), M./M/ = med, U./U/ = uden,
    T./T/ = til, STK/ST = stk, DISP = dispenser (keyword "dispenser"), XL/XXL = størrelse (variation). Skriv forkortelsen ud i den rigtige kolonne.
19. Skriv ikke "Ja"/"Yes". Ingen leading/trailing mellemrum. Ingen kommaer som adskiller i Variation (brug mellemrum eller "og"/"und").
20. **Vin, spiritus og øl** (rækker med alkohol) ejes af en anden proces: rør kun det der tydeligt bryder en regel ovenfor (dyremad, dato, certifikat, tal som type, bindestregsrest). Ret ikke vinens produkttype/variation efter smag.

## Eksempler fra brugerens gennemgang (forkert → rigtigt)
| Titel | Forkert | Rigtigt |
|---|---|---|
| Milka Lotus Biscoff 90G | type "Alpenmilch Schokolade", var "… Lotus Biscoff" eller "Lotus" | brand Milka, cobrand "Lotus Biscoff", type "Schokolade", variation "Alpenmilch" + evt. "Keksstückchen" |
| Somersby Watermelon Cider 0,33L Dose | type "Apfelweinhaltiges Getränk" | type "Cider", variation "Watermelon" (smag), keyword "Dose", flag alkohol ikke i tekst |
| Milka Ganze Haselnüsse 95G | type "Haselnüsse", var "ganzen Haselnüssen Ganze" | type "Schokolade", variation "Alpenmilch ganze Haselnüsse" (ingen dubletter) |
| elkos VIVEDE Husten- & Bronchialtee 20ST 40G | var "VIVEDE Husten-" | brand "elkos", subbrand "VIVEDE", type "Husten- und Bronchialtee" (samlet, ingen bindestregs-rest) |
| Dr.Oetker Flüssiger Bourbon-Vanille-Extrakt gezuckert | var "Dr.Oetker …" | brand "Dr. Oetker" (kun i brand), type "Bourbon-Vanille-Extrakt", variation "flüssig gezuckert" |
| EDEKA Herzstücke Artischocken Herzen 400G | type "Artischocken" + var "Herzen" | type "Artischockenherzen" |
| HAK Edamame Bohnen 150G | type "Edamame" + var "Bohnen" | type "Edamamebohnen" |
| Les Arômes de France Cabernet Sauvignon Rotwein trocken | var "rot" | type "Rotwein", variation "Cabernet Sauvignon trocken", country "Frankreich" |
| Oettinger 5,0 Pils Original 0,5L Dose | type "5" | type "Pils", variation "Original", alcohol_percent "5%", keyword "Dose" |
| EDEKA Bio Zitronello 200ML | type "Aromen-Vanille", subbrand "Bio" | brand "EDEKA", subbrand "Zitronello", type "Zitronenaroma"/"Aroma", flag organic "bio" (subbrand "Bio" fjernes) |
| Dr.Oetker Backfeste Puddingcreme 35G | type "Backzutaten & Dekor" | brand "Dr. Oetker", subbrand "Backfeste", type "Puddingcreme" |
| Nissin Kanzen Meal Japanese Curry Rice 108G | type "Kanzen Meal Japanese Curry Rice" | brand "Nissin", subbrand "Kanzen Meal", type "Curry-Reis", variation "Japanese", country "Japan" |
| EDEKA Herzstücke Mousse mit MSC-Lachs 85G (kattemad) | type "Alleinfuttermittel für …" | `remove: true` |
| Nature Valley Protein Salted Caramel Nut Riegel 4ST 160G - MHD 29.09.2026 | var "… MHD 29.09.2026" | brand "Nature Valley", type "Proteinriegel", variation "Salted Caramel Nut" (ingen dato) |
| Alkoholfreies Getränk … Alkoholgehalt: 14% vol Rosa | type "Alkoholisches Getränk" | type = den egentlige vare (fx "Rosé"/"Likör"), variation "rosa", alcohol_percent "14%", keyword "Farbstoff" |
| Jacobs Cappuccino Choco Milka 400G | brand "Jacobs", variation "Choco Milka" | brand "Jacobs", cobrand "Milka", type "Cappuccino", variation "Choco" |

Arbejdsgang: Læs inputfilen, skriv outputfilen (JSON-liste, én post pr. input-række, samme `row`), og kør derefter
`py <sti>\rule_check.py <input> <output>` — ret alle fundne fejl i outputfilen og kør igen, til der ikke er flere fejl (maks. 4 runder). Returnér et kort resumé.
Advarsler (`advarsel …`) er kun hints — vurdér dem, men de behøver ikke give ændringer.
