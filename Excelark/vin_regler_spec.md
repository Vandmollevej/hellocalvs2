# Vin-regler: opdeling af vin-rækker i Hello Cal-produktark

Du får en batch med rækker fra et produktark (fra en butik) i en JSON-fil. For HVER række skal du bestemme de endelige værdier
i vores egne kolonner. Du skriver ikke i filen — du returnerer kun resultatet via output-skemaet. Rør aldrig originalkolonnerne
(`ot` Original Title, `pn` Product Name, `st` Subtitle, `url`, `mf`) — de er kun kilder.

Målet (brugerens ønske): vin-sektionen skal være delt ordentligt op i **Product Type** (hvidvin/rødvin/rosévin …), **Brand**,
**Subbrand** og **Variation** (+ nøgleord m.m.), præcis som i Bilkas vin-sektion. Hvert faktum står ét sted.

## Inputfelter pr. række
`id` (skal returneres uændret), `sheet`, `lang` (da|de), `cat` Category, `pt` Product Type, `plural` (ignorér), `brand`, `sub` Subbrand,
`var` Variation, `kw` [Keyword 1-5], `pack` Packaging, `country` _is_country_of_origen, `org` _is_organic, `alcFree` _is_alcohol_free,
`alcFlag`, `alcPct` (alkohol-%), `sugar`, `qty` Quantity, `ot`/`pn`/`st`/`mf` originalfelter, `why` (hvorfor rækken er med).
De nuværende værdier er ofte fejlbehæftede: afkortede ord ("cab", "sauv", "chard", "zinf", "rosä", "tempranil", "clas", "bourg", "bib"),
brandord gentaget som nøgleord, appellationer/druer i brand eller subbrand, tom Variation osv. Du skal levere de RIGTIGE værdier.

## Output pr. række (alle felter skal med)
- `id` — uændret.
- `section` — `wine` (stille vin: rød/hvid/rosé/orange/alkoholfri vin), `sparkling` (mousserende, champagne, cava, prosecco, crémant, sekt),
  `fortified` (port, sherry, madeira, marsala, hedvin, dessertvin/dessertwein), `aperitif` (vermouth, wermut, vin-aperitif), `fruitwine`
  (frugtvin, kirsebærvin, fruchtwein), `spirit` (snaps, whisky, gin … — kun i kategorier hvor spiritus ligger sammen med vin),
  `other` (ikke vin/spiritus: ost, fond, slik, sauce, eddike, øl, cider, sodavand … — rækken rettes IKKE).
- `productType` — endelig Product Type (se nedenfor). For `other`: det nuværende `pt` uændret, medmindre `misfiled` er true.
- `misfiled` — true hvis `pt` er et vin-ord men varen slet ikke er vin (fx "Hakket grisekød" med produkttype "Hvidvin"); så sæt
  `productType` til varens rigtige produkttype udledt af titlen (småt/stort som i titlen, uden brand), ellers false.
- `brand`, `subbrand`, `variation` — strenge ('' hvis tom).
- `keywords` — liste (0-5 strenge, uden huller).
- `packaging` — '' eller "Bag-in-box" (da) / "Bag-in-Box" (de) / "Dåse"/"Dose" / "Karton" — KUN hvis teksten selv siger det (bib, bag in box,
  box, dåse, karton). Gæt aldrig ud fra mængde eller pris.
- `country` — oprindelsesland ('' hvis ikke angivet eller entydigt af titlen/appellationen/druesorten/producenten). Brug ALDRIG
  EAN-/stregkodepræfiks (den viser kun hvor stregkoden er registreret, ikke hvor vinen kommer fra), og gæt ikke ud fra pris/mængde.
  Dansk ark: dansk landenavn med
  stort begyndelsesbogstav (Frankrig, Italien, Spanien, Tyskland, Portugal, Australien, Chile, Argentina, Sydafrika, New Zealand, USA,
  Østrig, Ungarn, Grækenland, Rumænien, Danmark …). Tysk ark: tysk landenavn (Deutschland, Italien, Frankreich, Spanien …).
  Er `country` allerede udfyldt, så gentag den (med stort begyndelsesbogstav) — find aldrig på et andet land.
- `organic` — true hvis varen er økologisk (øko, økologisk, bio, organic, organico …). Ordet må så IKKE stå i andre felter.
- `alcoholFree` — true hvis alkoholfri (alkoholfri, alkoholfrei, 0.0, 0,0%, entalkoholisiert, "free", "zero" om alkohol …). Ordet må ikke stå i andre felter.
- `alcoholPct` — alkoholprocent som tekst med decimalpunktum og %, fx "13.5%" / "12%" ('' hvis ikke angivet; aldrig mængde i %).
  Står procenten allerede i `alcPct`, gentag den. Er varen alkoholfri (`alcoholFree` true): `alcoholPct` er altid ''.
- `confidence` — `high` | `medium` | `low`. `note` — højst 12 ord, kun når medium/low eller `misfiled`.

## Generelle regler (gælder alle ark; brugerens regler)
1. **Ét faktum ét sted.** Mængde (75 cl, 3 l, 0,75L) står aldrig i variation/nøgleord. Land, økologisk, alkoholfri, alkohol-% og
   emballage har egne felter og står ikke igen i variation/nøgleord/produkttype.
2. **Intet ord to gange** på tværs af productType, subbrand, variation og keywords (funktionsord og/med/uden/af/de/du/di/la/le/der/die/
   das/und/von/van undtaget). Brandets ord står aldrig i productType og aldrig i keywords. I variation fjernes brandord kun hvor de
   bare gentager brandet (fx "Santa Carolina Reserva Chardonnay" med brand "Santa Carolina" → "reserva chardonnay"); er brandordet en
   integreret del af cuvéens/vinens eget navn ("La Chasse des Princes" under Cellier des Princes, "Château X Grand Vin"), bevares
   hele navnet i variation.
3. **Opfind aldrig ord.** Alt du skriver skal komme fra rækkens tekster (`ot`, `pn`, `st`, nuværende felter). Tilladte reparationer:
   fuldfør et ord der er skåret af (cab→cabernet, sauv→sauvignon, chard→chardonnay, zinf→zinfandel, tempranil→tempranillo,
   mourv→mourvèdre, "clas"→classico når titlen viser det), gendan accenter/diakritiske tegn (rosä→rosé, Rose→rosé når det er vinen,
   Cuvee→cuvée), og ret åbenlyst forkert tegnsætning. Gæt aldrig hele navne ud fra ét bogstav.
4. **Ord forsvinder aldrig i tavshed.** Det der udelades skal være: gentagelse, mængde/pris/pakke-tekst, flyttet til eget felt,
   butikskategori-ord uden information ("vin", "bib"), eller et afkortet fragment der ikke kan tolkes og ikke står i titlen.
5. **Aldrig %, aldrig 'vol.' i variation/nøgleord** (alkohol-% → `alcoholPct`).
6. Ingen celle må starte/slutte med mellemrum. Ingen "/", "&", "-" som listetegn: lister skrives "a og b" / "a, b og c" (da) eller
   "a und b" / "a, b und c" (de). Bindestreg i egennavne (Châteauneuf-du-Pape, Müller-Thurgau, Nero d'Avola) bevares.
7. `section: other` → returnér rækkens nuværende værdier uændret (brand, sub, var, kw, pack, country, org, alcFree, alcPct som input;
   `organic`/`alcoholFree` = om feltet er udfyldt) — og `misfiled` kun hvis reglen ovenfor gælder.

## Danske ark (lang = da)
**productType** (ental, begyndelsesbogstav stort): Rødvin, Hvidvin, Rosévin, Orangevin, Mousserende vin, Champagne, Cava, Prosecco,
Crémant, Portvin, Sherry, Madeira, Marsala, Vermouth, Hedvin, Dessertvin, Sangria, Kirsebærvin/Hindbærvin/Solbærvin … (sammensat
frugtvin) eller Frugtvin, samt "Vin" kun når farve/type umulig kan afgøres. Farven læses af titel/druesort/appellation (Chardonnay,
Sauvignon blanc, Riesling, Chablis, Pinot grigio → Hvidvin; Merlot, Shiraz, Cabernet, Rioja, Barolo, Chianti, Pinot noir → Rødvin;
"Rosé"/"Rosato"/"Blush" → Rosévin). Rosévin skrives med é (aldrig "Rosevin"). Alkoholfri vin får samme type som vinen (Rødvin,
Hvidvin, Mousserende vin) + `alcoholFree` true. Spiritus beholder sin type (Snaps, Whisky, Gin, Vodka, Rom, Likør, Akvavit, Cognac …);
ret den kun hvis den mangler eller er tydeligt forkert. Port ("Tawny Porto", "Ruby Port", "LBV") → Portvin; Sherry/Fino/Oloroso → Sherry;
Vermouth → Vermouth; Sauternes og andre søde vine → Dessertvin; øvrige hedvine → Hedvin. Champagne/Cava/Prosecco/Crémant er egne typer
(stedet/appellationen står i variation: "Crémant" + variation "de loire"). Spumante/frizzante/pétillant/spritzer/"blanc de blancs" er
ikke type: type = Mousserende vin (eller Prosecco/Cava/Champagne), udtrykket i variation eller keyword.
Er vinen et navn (fx "Chablis La Pierrelée", "Mucchietto") står navnet i variation, aldrig i productType.
**brand**: producentens/mærkets navn som på etiketten (Château Tanunda, Cono Sur, Il Capolavoro, Faustino, M. Chapoutier).
Ret afkortede brands ("El" + "El Coto Rioja" → "El Coto"). Behold et korrekt eksisterende brand uændret (stavning rører du ikke). Brand er
aldrig druesort, appellation, land, farve, importør/distributør (leverandøren efter "|" i `st`, fx "Félix Solís", er ikke brandet).
Butikkens private mærker (Nemlig.com, Salling, Rema 1000, Eldorado …) står som brand, hvis arket allerede bruger dem.
**subbrand**: kun en linje/etiket under brandet, der har sit eget mærke/logo (fx "B by Black Tower" under Black Tower, "Cordon Negro"
under Freixenet, "Sparkletini"). Aldrig appellation, druesort, kvalitetstrin (reserva, brut) eller cuvée-navn. Er du i tvivl: tom, og
navnet står i variation. Subbrand må ikke gentage brandets ord.
**variation** (småt begyndelsesbogstav, hele teksten med småt undtagen forkortelser/egennavnebogstaver der aldrig skrives med småt):
vinens navn som det står på flasken efter brand og type: appellation/område + cuvée-navn + druesort(er), i titlens rækkefølge, fx
"chablis la pierrelée", "pinot noir", "côtes du rhône", "nero d'avola og shiraz", "primitivo di manduria", "valpolicella ripasso".
Druesort-lister: "cabernet sauvignon og merlot". Brug IKKE farveordet (rød/hvid/rosé) der allerede er typen. Fraser som "med
kirsebærsmag" bevares ("med" småt). Er der intet navn ud over brandet og typen: tom.
**keywords** (småt; 0-5; én betydning pr. keyword; aldrig delt midt i en frase; ingen afkortninger):
 1. stil/sødme: tør, halvtør, sød, brut, brut nature, extra brut, sec, demi-sec, extra dry, doux, dolce, semi seco, seco, cream …
 2. kvalitet/klassifikation: reserva, gran reserva, crianza, riserva, superiore, premier cru, grand cru, ripasso (hvis ikke del af
    navnet), og koderne DOC, DOCG, AOC, AOP, IGT, IGP, DO, DOCa, VdP (store bogstaver).
 3. årgang: 4-cifret år ("2021"); 2-cifret kun når det tydeligt er årgang ("22" i "Sang 22" → "2022").
 4. andet der er en egenskab, ikke navn: "gaveæske", "limited edition", "unfiltered", "naturvin", "vegetarisk" …
 Ordene står enkeltvis i Keyword 1-5. Region/appellation/druesort står i variation, ikke som keyword.
**Eksempler (da)**
- bilka:6257 `ot` "Chablis La Pierrelée", brand "La Chablisienne", pt Hvidvin → section wine, productType "Hvidvin", brand "La Chablisienne",
  subbrand "", variation "chablis la pierrelée", keywords [], country "Frankrig".
- bilka:4273 `ot` "Nozeco Merlot alkoholfri", brand "Nozeco", pt "rødvin" → productType "Rødvin", brand "Nozeco", variation "merlot",
  alcoholFree true, keywords [].
- spar (messy): brand "Santa Rita", pt Rødvin, var "cabernet sauvignon", kw ["rita","cab","sauvig"], `ot` "Santa Rita 120 Cab/Sauvig." →
  brand "Santa Rita", subbrand "", variation "120 cabernet sauvignon", keywords [] (rita = brandord; cab/sauvig = afkortet
  duplikat af variation; "120" er en linje uden sikkert eget logo → variation).
- spar: brand "Marcel Martin", sub "Crémant de Loire", pt "Mousserende vin", var "brut og chenin blanc", kw ["mant","loire"],
  `ot` "Cr’Mant Loire Brut 12%" → productType "Crémant", brand "Marcel Martin", subbrand "", variation "de loire og chenin blanc",
  keywords ["brut"], alcoholPct "12%", country "Frankrig".
- rema: brand "Santa Carolina", var "reserva chardonnay", `ot` "S.C. RESERVA 13,5%", `st` "75 CL. / CHARDONNAY" → productType "Hvidvin",
  brand "Santa Carolina", variation "chardonnay", keywords ["reserva"], alcoholPct "13.5%".
- drk (tomme felter): `ot` "Montgras Pinot Noir", cat "Vin & spiritus", kw ["montgras","pinot","noir","chilensk","rødvin"] → productType
  "Rødvin", brand "MontGras" (stavet som i Bilka: MontGras), variation "pinot noir", country "Chile", keywords [].
- bilka (Hedvin): `ot` "10 Years Tawny Port", brand "Feuerheerd's", `st` "Feuerheerd's | Anchor Port | 75 cl" → productType "Portvin",
  brand "Feuerheerd's", subbrand "" (leddet efter "|" er et leverandør-/linjenavn uden sikkert eget logo), variation "10 years tawny",
  keywords [].
- bilka (Hedvin): `ot` "Ten Year Old White Porto", brand "Andresen" → productType "Portvin", variation "ten year old white".

## Tyske ark (lang = de)
Tysk stavning og tyske navneord med stort begyndelsesbogstav beholdes ("Grauer Burgunder", "Trocken").
**productType**: Rotwein, Weißwein (altid ß, aldrig "Weisswein"), Roséwein, Orangewein, Schaumwein (kun hvis ingen mere specifik
betegnelse), Sekt, Prosecco, Champagner, Crémant, Cava, Perlwein, Portwein, Sherry, Madeira, Marsala, Wermut, Likörwein, Dessertwein,
Fruchtwein, Glühwein, Sangria, Wein (kun hvis farve umulig at afgøre). Kategorinavne som "Prosecco & Perlwein", "Sherry & Portwein",
"Weinspezialitäten", "Alkoholfreier Wein", "Weißwein lieblich & süß" er IKKE produkttyper: vælg den præcise (alkoholfri vin = Rotwein /
Weißwein / Schaumwein osv. + `alcoholFree` true). Beskrivende tekster i `pt` ("Der noble Sekt für Genießerinnen", "Trockener Rotwein -
Italien") erstattes af den rigtige type.
**brand**: producenten/mærket fuldt udskrevet (ret afkortede: "El" → "El Coto", "Doppio" → "Doppio Passo", "Finca" → "Finca de la Vega",
"Bodegas" → "Bodegas Rasgon"; kun hvis titlen viser hele navnet). Behold korrekte brands uændret.
**subbrand**: som i danske ark (kun egen linje/logo; ellers tom).
**variation**: vinens navn på flasken efter brand og type: druesort(er)/cuvée/lagen/stedsnavne som i titlen ("Grauer Burgunder",
"Piesporter Riesling", "Tradition Grauer Burgunder", "Rivaner und Weißer Burgunder"). Ikke farveordet (Rot/Weiß/Rosé), ikke
sødme, ikke region, ikke kvalitetskode, ikke land, ikke mængde.
**keywords** (tysk stavning med stort begyndelsesbogstav, uændrede eksisterende gyldige nøgleord bevares): Anbaugebiet/region ("Baden",
"Pfalz", "Puglia", "Rheinhessen", "Côtes du Rhône" …) først; sødme (Trocken, Halbtrocken, Feinherb, Lieblich, Süß, Brut, Extra Dry,
Brut Nature); kvalitet (Reserva, Crianza, Riserva, Kabinett, Spätlese, Auslese, QbA, Qualitätswein, Premier Cru, Grand Cru; koder
DOC, DOCG, AOC, AOP, IGT, IGP, DO, VdP, g.U. i store bogstaver); årgang (år). Højst 5. Region står kun som keyword (ikke i variation).
Scrape-affald som "Mit 13 % vol", "Alkoholgehalt: 6% vol" fjernes (→ `alcoholPct`).
**Eksempler (de)**
- edeka:2982 `ot` "El Coto Rioja Crianza DOC 0,75L", brand "El", kw ["Rioja"] → productType "Rotwein", brand "El Coto", variation "",
  keywords ["Rioja","Crianza","DOC"] (region står som keyword), country "Spanien".
- edeka:4284 `ot` "Durbacher Grauer Burgunder trocken 0,75L", brand "Durbacher", kw ["Baden"] → Weißwein, brand "Durbacher",
  variation "Grauer Burgunder", keywords ["Baden","Trocken"], country "Deutschland".
- rewe:8292 `ot` "Landlust Bio Weißwein Rivaner & Weißer Burgunder QbA trocken 0,75l" → Weißwein, brand "Landlust", variation
  "Rivaner und Weißer Burgunder", keywords ["Trocken","QbA"], organic true.
- edeka:3199 `ot` "Freixenet Carta Extra Dry 11,5% 0,75L", pt "Schaumwein" → productType "Schaumwein", brand "Freixenet", subbrand "",
  variation "Carta", keywords ["Extra Dry"], alcoholPct "11.5%", country "Spanien".
