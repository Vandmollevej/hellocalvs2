# Dyrefoder-filteret — fuld rapport (2026-10-08)

Genereret af `Produklter/Blacklistede produkter/lav_rapport.py` direkte fra data og testkørsler. Filteret kan ses og redigeres i admin → Indstillinger → **Dyrefoder-filter** (`/admin/pet-food-filter`).

## 1. Formål og regel

Hello Cal er til mad og drikke til mennesker. Brugere må ikke kunne oprette (eller få godkendt) dyrefoder. Kun **mad** til dyr er omfattet — ikke tilbehør, legetøj, strø eller medicin. Kilden er ejerens beslutning 2026-10-06/07 (se `docs/DECISIONS.md`).

## 2. Sådan virker filteret

En vare afvises, når **ét** af følgende rammer (rækkefølgen er stregkode → stærkt ord → mærke → svage ord):

1. **Stregkode** på spærrelisten (28.767 standard-stregkoder). Sammenlignes uden foranstillede nuller, så EAN-13/UPC-A/GTIN-14 af samme vare matcher.
2. **Stærkt ord** (429 udtryk): ét træf som del-tekst blokerer (fx `hundefoder`, `analytiske bestanddele`, `kød og animalske biprodukter`, `für hunde`). Mindst 5 tegn.
3. **Dyrefodermærke** (280 mærker): matcher kun som hele ord (`brit` rammer ikke `britisk`, `pro plan` ikke `alpro plant`).
4. **Svage ord** (59 udtryk, fx `hund`, `adult`, `foder`): blokerer først, når mindst **3 forskellige** svage ord står i samme vare. Korte svage ord (≤ 5 tegn) matcher kun som hele ord.

Teksten, der tjekkes, er varens **navn, mærke, undermærke, variant, produkttype og ingredienser** (og OCR-teksten fra etiketten). Felterne sættes sammen med ` | `, så et udtryk aldrig kan ramme på tværs af to felter (se fund 4.3). Der tjekkes ikke på hele websider.

### Hvor filteret kører

| Sted | Hvad sker der |
| --- | --- |
| Stregkodeopslag (`GET /api/products/lookup/[barcode]`) | Spærret stregkode → 422 `PET_FOOD_BLOCKED`; Open Food Facts/USDA-fund, der rammer filteret, gemmes aldrig |
| Manuel oprettelse (`POST /api/products`) og hurtig-oprettelse (`POST /api/products/quick`) | Stregkode og tekst tjekkes før oprettelse; billederne gemmes på hændelsen |
| Efter AI-udfyldning (`quick-product-enrichment.ts`) | Rammer det AI'en læste (navn/mærke/ingredienser) filteret, afvises varen automatisk (`rejectProduct`) |
| Natrobot `pet-food-scan` (kl. 03:45) | Fase 1: alle eksisterende varer gennemgås med stregkode- og ordfilteret (kun markering, 3.000 pr. nat). Fase 2: AI ser forsidefotoet af brugeroprettede/ventende varer og afviser dyrefoder (≥ 75 % sikkerhed). Billedgenkendelse kører **kun** her, aldrig i scan-flowet |

### Advarsel og spærring af brugere

Første forsøg giver en advarsel på skærmen. Andet forsøg spærrer kontoen: logges ud på alle enheder, kan ikke logge ind (alle login-metoder), vises under admin → Brugere → **Spærrede** med knappen *Ophæv spærring*. Gentagelser af samme stregkode inden for 10 minutter tæller som ét forsøg. Administratorer og ikke-loggede-ind besøgende rammes ikke af tællingen. Billedsvar fra natrobotten tæller først fra 90 % sikkerhed.

### Gennemgang i admin

**Hver** afvisning (spærret ved scanning/oprettelse, automatisk afvist vare, fund i eksisterende vare) gemmes som en hændelse med de billeder, brugeren forsøgte at oprette, og vises som rød advarsel i admin-Oversigten. Knapperne: *Fejl – frikend* (hændelsen tæller ikke længere; en spærring, der kun skyldtes den, ophæves; en afvist vare sættes tilbage til afventende), *Var dyrefoder*, *Afvis vare*.

## 3. Datagrundlag

Scrapet med rigtig browsernavigation (Playwright) fra danske og tyske butikker. I alt **32.315 produkter**, heraf **30.865 klassificeret som foder** (resten er tilbehør eller uafklaret og kommer ikke på stregkodelisten). Nemlig viser ingen stregkoder på sine sider; de varer bruges kun til tekstmønstre.

| Kilde | Produkter | Foder | Unikke foder-stregkoder |
| --- | ---: | ---: | ---: |
| Bilka | 797 | 612 | 570 |
| EDEKA24 | 332 | 331 | 330 |
| Fressnapf | 7.758 | 7.612 | 7.448 |
| Futterhaus | 2.768 | 2.765 | 2.765 |
| Maxi Zoo | 3.881 | 3.628 | 3.755 |
| Nemlig | 69 | 66 | 0 |
| SPAR | 156 | 155 | 155 |
| Zooplus | 5.874 | 5.567 | 9.931 |
| Zooplus DE | 10.325 | 9.774 | 17.461 |
| dm | 355 | 355 | 347 |

Klassificering mad/ikke-mad (`food_filter.py`): først butikkens egen kategori, så foder-sprog på siden (fx *analytiske bestanddele*, *Rohprotein*), så ord i titlen. Kun FOOD-stregkoder spærres. Stregkoder, der også tilhører en menneskevare i butiksarkene (Bilka, Nemlig, SPAR, Wolt, REWE, dm, DRK, EDEKA, REMA 1000), fjernes automatisk fra listen.

## 4. Test og fund

### 4.1 Genkendelse og falske positive (kørt automatisk)

```
ALL sources
  Pet food caught (full text): 30749/30865 (99.6 %)
  Pet food caught (label text): 27095/30865 (87.8 %)
  Pet food caught (name only): 23712/30865 (76.8 %)
Danish sources
  Pet food caught (full text): 10019/10028 (99.9 %)
  Pet food caught (label text): 9571/10028 (95.4 %)
  Pet food caught (name only): 8762/10028 (87.4 %)
German sources
  Pet food caught (full text): 20730/20837 (99.5 %)
  Pet food caught (label text): 17524/20837 (84.1 %)
  Pet food caught (name only): 14950/20837 (71.7 %)
    EDEKA24: label text 324/331 (97.9 %)
    Fressnapf: label text 5382/7612 (70.7 %)
    Futterhaus: label text 1914/2765 (69.2 %)
    Zooplus DE: label text 9550/9774 (97.7 %)
    dm: label text 354/355 (99.7 %)
Human food wrongly caught: 154/71349  (the Nemlig sheets contain ~150 pet rows; check the csv)
  bilka.xlsx: 0/10766
  bilka_product_information.xlsx: 0/10090
  nemlig.xlsx: 77/6679
  nemlig_product_information.xlsx: 76/6679
  spar.xlsx: 0/5193
  spar_product_information.xlsx: 0/7306
  F-navne: 1/23705
  OFF-DE: 0/931
Wrote moenstre_misses.csv and moenstre_falske_positive.csv
```

*Hele siden* = titel + mærke + al sidetekst; *label text* = titel + mærke + ingrediens-/analyse-afsnittet (det appen ser ved oprettelse); *name only* = kun titel + mærke. De 153–154 "falske positive" i Nemlig-arkene er **rigtigt dyrefoder**, der ligger i de eksisterende Nemlig-ark (Best Friend, Chrisco, Pedigree, Whiskas m.fl.) — ikke fejl. Referencekorpus for menneskemad: ca. 71.000 tekster (danske butiksark, REWE, dm, DRK, EDEKA, REMA 1000, 23.700 tyske/danske produktnavne fra billedfilerne på F:, Open Food Facts DE).

### 4.2 Hvad testen på eksisterende indhold fandt

Testen mod eksisterende (tysk og dansk) menneskemad fandt rigtige fejl, som er rettet og pushet:

| Udtryk | Ramte | Rettelse |
| --- | --- | --- |
| mærket `butcher's` | ca. 45 tyske BBQ-kødvarer (Butcher's Barbecue …) | fjernet |
| mærket `kräcker` | Alnatura Dinkel Kräcker (tysk for knækbrød) | fjernet |
| mærket `sammy's` | Sammy's sandwich | fjernet |
| stærkt ord `snack cream` | Pringles Cream Cheese (se 4.3) | fjernet |
| ca. 35 tvetydige mærker (Ultima, Heim, Moments, Burns, Larsson, Brit, Lupo …) | almindelige ord/menneskemærker | bevidst udeladt |

### 4.3 Hvorfor kunne "snack cream" ramme noget?

`snack cream` er et rigtigt dyrefoderudtryk (flydende kattesnacks, fx Zooplus/Smilla *Snack Cream*). Det ramte Pringles Cream Cheese og en SPAR-flødeostsnack, fordi mit **testscript** klistrede felterne sammen uden skilletegn (…`snack` fra kategorien + `Cream` fra et søgeord). Appen sætter felter sammen med ` | `, så den fejl kunne ikke opstå i appen. Udtrykket er alligevel for tvetydigt (en menneskevare kan hedde fx *Protein Snack Cream Cheese*), så det er fjernet, og scriptene bruger nu også skilletegn. Samme fund førte til, at ingen stærke udtryk under 5 tegn er tilladt, og at korte svage ord kun matcher som hele ord.

### 4.4 Oprydning i eksisterende filer

Samme mønstre er brugt til at finde dyrefoderbilleder i originalmapper: 139 filer på USB-drevet F: og 177 filer på X:-drevet (Hello Cal på NAS'en) — alle gennemgået manuelt som rigtigt dyrefoder (inkl. EDEKA Herzstücke-hundefoder) og **flyttet, ikke slettet**, til `Dyrefoder-fjernet`-mapper (log: `ryd_log.csv`).

## 5. Kendte svagheder

- Genkendelse på kun navn+mærke er lavere end på ingrediensteksten (se 4.1): et dyrefoderprodukt uden dyreord, mærke eller kendt stregkode (fx ukendt mærke, "Godbidder m. kylling") slipper igennem live. Det fanges af natrobotten (billedet) og af gennemgangen i admin.
- Fressnapf og Futterhaus har lavere genkendelse end Zooplus/EDEKA24, fordi mange produkttitler kun består af mærke + serie (`Wildkind Adult Beaver Creek`); de dækkes af mærkelisten og stregkoderne.
- Stregkoder dækker kun varer, der er scrapet (ca. 28.800). Nye varer og mindre mærker kendes ikke.
- Mærker, der også er menneskemærker eller almindelige ord, er udeladt (Felix, Gourmet, Heim, Ultima …), så de dyrefodervarer fanges kun via øvrige udtryk.
- Billedmønstre (dyr på pakken, *Adult/Puppy/Kitten*, dyrlæge-diæter) er beskrevet i `fable-moenstre.md` og bruges af natrobotten, ikke af det live filter.
- Ikke live-testet i drift (ingen lokal database). Test ved at scanne en kendt dyrefoder-stregkode.

## 6. Vedligehold

- **Hurtig rettelse** (fx et udtryk rammer menneskemad): admin → Dyrefoder-filter → slå udtrykket fra, eller tilføj et nyt. Virker inden for et minut; standardlisten ændres ikke.
- **Ny scraping:** `powershell -File start_alle.ps1` (danske) / `vagt_tyske.ps1` (tyske) → `py build_app_blacklist.py` → `py test_moenstre.py` → kopiér `app-data/*.json` til `src/data/` i en ren worktree fra origin/master og push.
- **Nye mærker:** `py foreslaa_maerker.py` foreslår kun mærker uden træf i menneskemad; gennemgå dem, før de tilføjes.
- **Rapporten:** `py lav_rapport.py`.

## Bilag A — stærke ord

`3a672`, `3a700`, `3b103`, `3b202`, `3b405`, `3b502`, `3b606`, `3b801`, `adult 1+`, `adult 7+`, `adult 8+`, `adult and`, `adult beef`, `adult cat`, `adult chicken`, `adult dog`, `adult fisk`, `adult fjerkræ`, `adult giant`, `adult indoor`, `adult kalkun`, `adult kanin`, `adult kornfri`, `adult kylling`, `adult laks`, `adult lam`, `adult lamb`, `adult large`, `adult light`, `adult maxi`, `adult medium`, `adult mini`, `adult okse`, `adult salmon`, `adult sensitive`, `adult small`, `adult sterilised`, `adult sterilized`, `adult turkey`, `adult tørfoder`, `adult vådfoder`, `advance appetite`, `advance articular`, `advance dental`, `advance sensitive`, `akvariefisk`, `alle racer`, `alleinfuttermittel`, `alpehø`, `analytical constituents`, `analytische bestandteile`, `analytiske bestanddele`, `anbefalet fodring`, `animalske biprodukter`, `animalske derivater`, `animalske proteiner`, `best nature cat`, `best nature dog`, `biprodukter af vegetabilsk oprindelse`, `canine`, `cat adult`, `cat food`, `cat senior`, `cat snack`, `cat treats`, `catnip`, `chinchilla`, `chondroprotector`, `complementary feed`, `complete feed`, `crude ash`, `crude fat`, `crude fiber`, `crude fibre`, `crude protein`, `daglig fodring`, `dagsration`, `dehydreret kylling`, `dental snack`, `dental sticks`, `dentastix`, `derivater af vegetabilsk oprindelse`, `din hund`, `din kats`, `diverse sukker`, `diætfoder`, `dog adult`, `dog chew`, `dog food`, `dog puppy`, `dog senior`, `dog snack`, `dog treats`, `dry food`, `dyrefoder`, `dyremad`, `e671`, `e672`, `enghø`, `ergänzungsfuttermittel`, `ernæringsmæssige egenskaber`, `ernæringsmæssige tilsætningsstoffer`, `farvefoder`, `feline`, `feriefoder`, `firbenede`, `fisk og fiskebiprodukter`, `fisk og fiskederivater`, `fisk og fiskeprodukter`, `fiskefoder`, `fiskemel`, `fjerkrælever`, `fjerkræmel`, `fjerkræprotein`, `flagefoder`, `foder til`, `foder til eksotiske`, `foder til heste`, `foder til høns`, `foderanbefaling`, `foderet`, `fodermængde`, `foderpiller`, `fodertabletter`, `fodertilskud`, `fodervejledning`, `fodringsanbefaling`, `fodringsanvisning`, `fodringsvejledning`, `for cats`, `for dogs`, `for hunder`, `for katter`, `for kittens`, `for puppies`, `forskellige sukkerarter`, `fuglefoder`, `fuglenødder`, `fuldfoder`, `fullfôr`, `futtermittel`, `för hundar`, `för katter`, `für hunde`, `für katzen`, `giant breed`, `gnaveben`, `gnaverfoder`, `gnavergræs`, `gnaverhø`, `gnaversnack`, `godbidder t. gnaver`, `godbidder t. hund`, `godbidder t. kat`, `godbidder til gnaver`, `godbidder til hund`, `godbidder til kat`, `gourmet a la carte`, `gourmet diamant`, `gourmet gold`, `gourmet mon petit`, `gourmet nature's creations`, `gourmet perle`, `gourmet revelations`, `gourmet soup`, `granulatfoder`, `hairball`, `hamsterfoder`, `havedamsfoder`, `helfoder`, `hestefoder`, `hestemüsli`, `hills prescription diet`, `hills science plan`, `hirsekolber`, `hjorteben`, `hjortegevir`, `hjorteknogle`, `hovedfoder`, `hund & kat`, `hund og kat`, `hunde & katte`, `hunde og katte`, `hundefoder`, `hundefutter`, `hundefôr`, `hundegodbid`, `hundekiks`, `hundemad`, `hundens`, `hundesnack`, `hundestørrelse`, `hundfoder`, `hundmat`, `hvalpe`, `hvalpefoder`, `hvalpemælk`, `hydrolyseret animalsk protein`, `hydrolyseret kyllingelever`, `hydrolyseret kyllingeprotein`, `høcobs`, `hønsefoder`, `ie/kg`, `integra protect`, `iu/kg`, `junior cat`, `junior dog`, `junior kylling`, `junior laks`, `junior lam`, `junior maxi`, `junior medium`, `junior mini`, `junior okse`, `junior sensitive`, `junior soft`, `juniorfoder`, `kanariefoder`, `kanariefugl`, `kaninfoder`, `kaninører`, `kastrerede`, `kattefoder`, `kattefôr`, `kattegodbid`, `kattegræs`, `kattemad`, `kattemælk`, `kattens`, `kattesnack`, `katteurt`, `kattfoder`, `kattmat`, `katzenfutter`, `kauknochen`, `kausnack`, `kcal/kg`, `kibble`, `killingefoder`, `killinger`, `kitten`, `kittens`, `koi sticks`, `komplet foder`, `kompletfoder`, `kompletteringsfoder`, `kornfri opskrift`, `kornfri snack`, `kornfri tørfoder`, `kornfri vådfoder`, `kornfrie godbidder`, `kornfrit foder`, `krybdyr`, `kyllingehalse`, `kyllingemel`, `kæledyr`, `kød og animalske biprodukter`, `kød og animalske derivater`, `kød og kødbiprodukter`, `kødmel`, `lammelunge`, `large breed`, `leckerli`, `libra cat`, `libra dog`, `life cat natural`, `lignocellulose`, `lupo sensitiv`, `majsgluten`, `mannan-oligosaccharider`, `marsvin`, `marsvinefoder`, `maxi adult`, `maxi junior`, `maxi senior`, `medium adult`, `medium breed`, `medium junior`, `medium senior`, `mejsebolde`, `mejsekugler`, `mellemstore racer`, `menuboks`, `mini adult`, `mini junior`, `mini senior`, `monoprotein`, `mælk og mejeriprodukter`, `n&d cat`, `n&d dog`, `nassfutter`, `neutered`, `oksehud`, `okselunge`, `okseører`, `omsættelig energi`, `papagei`, `papegøje`, `papegøjefoder`, `parakit`, `perfect fit adult`, `perfect fit cat`, `perfect fit indoor`, `perfect fit junior`, `perfect fit kat`, `perfect fit senior`, `perfect fit sterile`, `pet food`, `petfood`, `pillefoder`, `plantefoder`, `pond sticks`, `prescription diet`, `proteinekstrakt`, `prydfisk`, `puppies`, `puppy`, `puppy & junior`, `rawhide`, `reptil`, `roepulp`, `roesnitter`, `rohasche`, `rohfaser`, `rohfett`, `rohprotein`, `rå cellulose`, `råaske`, `rådyrsener`, `råfedt`, `råfiber`, `råhud`, `råprotein`, `science plan`, `senior 7+`, `senior 8+`, `senior cat`, `senior dog`, `senior kylling`, `senior laks`, `senior lam`, `senior maxi`, `senior medium`, `senior mini`, `senior okse`, `senior sensitive`, `seniorfoder`, `seniorhunde`, `seniorkatter`, `sensoriske tilsætningsstoffer`, `silkeorm`, `single protein`, `small breed`, `specialfoder`, `specific cat`, `specific dog`, `sterilised 7+`, `sterilised adult`, `sterilised cat`, `sterilised cats`, `sterilised fisk`, `sterilised fjerkræ`, `sterilised indoor`, `sterilised kat`, `sterilised kitten`, `sterilised kylling`, `sterilised laks`, `sterilised senior`, `steriliserede katte`, `supplerende foder`, `suppleringsfoder`, `tandrensende godbid`, `teknologiske tilsætningsstoffer`, `til din kat`, `til fugle`, `til hunde og katte`, `til hunder`, `til katte`, `til katter`, `til små hunde`, `til steriliserede`, `til store hunde`, `til voksne hunde`, `til voksne katte`, `tilskudsfoder`, `tilsætningsstoffer per kg`, `tilsætningsstoffer pr kg`, `tilsætningsstoffer pr. kg`, `tilsætningsstoffer/kg`, `timothy hø`, `torrfoder`, `trockenfutter`, `træningsgodbid`, `træningssnack`, `træstof`, `tyggeben`, `tyggepind`, `tyggerulle`, `tyggesnack`, `tyggestang`, `tyggestrips`, `tyggestæng`, `tyrepenis`, `tørfoder`, `tørret fjerkræ`, `tørret kyllingeprotein`, `undulat`, `undulatfoder`, `vagtelfoder`, `vegetabilske biprodukter`, `vegetabilske derivater`, `veterinary diet`, `vilde fugle`, `vildfugle`, `vildtfugle`, `vildtfuglefoder`, `voksne hunde`, `voksne katte`, `växttråd`, `vådfoder`, `våtfoder`, `welpen`, `wet food`, `wow cat`, `wow dog`, `wow junior`, `zootekniske tilsætningsstoffer`, `zusatzstoffe`, `æggefoder`

## Bilag B — dyrefodermærker

`4vets`, `8 in 1`, `8in1`, `acana`, `advance veterinary diets`, `adventuros`, `affinity advance`, `affinity libra`, `affinity ultima`, `agrobs`, `almo nature`, `alpha spirit`, `aniforte`, `animonda`, `anione`, `annimally`, `applaws`, `aptus`, `arion`, `beaphar`, `beeztees`, `belcando`, `beneful`, `best friend`, `best nature`, `bewi cat`, `bewi dog`, `bilanx`, `birds best`, `blue tree`, `bonies`, `bosch`, `boxby`, `bozita`, `bozita robur`, `braaaf`, `brekkies`, `briantos`, `brit care`, `brit fresh`, `brit premium`, `bugbell`, `bunny nature`, `burgess`, `calibra`, `caniland`, `canosan`, `carnilove`, `cat chow`, `cat's love`, `cat-stick`, `catessy`, `catit`, `catz finefood`, `cat´s love`, `cdvet`, `cesar`, `chappi`, `chewies`, `chrisco`, `churpi`, `coachi`, `concept for life`, `cookies delikatess`, `cosma`, `deli nature`, `delibest`, `dentalife`, `dentastick`, `dentastix`, `diafarm`, `dibo`, `disugual`, `dog's love`, `doggy dog`, `dogman`, `dogs creek`, `dog´s love`, `dokas`, `dolina noteci`, `donath`, `dreamies`, `easybarf`, `edgard & cooper`, `edgard cooper`, `equipur`, `essential foods`, `eukanuba`, `exclusion diet`, `farmina`, `faunakram`, `felini`, `feringa`, `fit+fun`, `fitmin`, `fleischeslust`, `forza 10`, `forza10`, `frendi`, `frigera`, `friskies`, `frolic`, `furree`, `getzoo`, `gimbi`, `gimcat`, `golden eagle`, `granatapet`, `green petfood`, `greenwoods`, `hansepet`, `happy cat`, `happy dog`, `happy dog supreme`, `hardys`, `herrmann's`, `herrmanns`, `hill's`, `hill's prescription diet`, `hill's science plan`, `hokamix`, `hühner land`, `iams`, `idaplus`, `integra veterinary diet`, `josera`, `josicat`, `josidog`, `jr farm`, `julius k-9`, `julius-k9`, `karlie`, `kattovit`, `kenkou`, `ki ja ko`, `kingsmoor`, `kitekat`, `kitty cat`, `kitty's cuisine`, `kitty´s cuisine`, `klasebo`, `kronch`, `kukuje`, `latz`, `lickimat`, `life cat`, `lifecat`, `lillebro`, `little big paw`, `loro parque`, `lucky jim`, `lucky lou`, `lukullus`, `luposan`, `lyra pet`, `mac's cat`, `mac's dog`, `maced`, `magnussons`, `markus mühle`, `markus-mühle`, `marstall`, `masterhorse`, `maxi zoo`, `meat & treat`, `meowee`, `miamor`, `mjamjam`, `monge`, `mr. johnson's`, `multifit`, `my little farm`, `mühldorfer`, `natural greatness`, `natural trainer`, `nature's protection`, `nature's variety`, `naturvet`, `navalis`, `neuendorff`, `no-hide`, `nordic paws`, `nutribird`, `nutrivet`, `nutrolin`, `oasy`, `optimanova`, `orijen`, `oxbow`, `pan mięsko`, `paws & patch`, `pedigree`, `pedigree vital`, `pet balance`, `poesie`, `porta 21`, `poäsie`, `premiere cat`, `premiere dog`, `premiere natural`, `primacat`, `primadog`, `pro plan`, `proden`, `pronovo`, `proplan`, `prozym`, `pup ice`, `purina`, `purina one`, `purina pro plan`, `purizon`, `quiko`, `raakraft`, `rafi`, `real nature`, `reavet`, `rinti`, `rocco`, `rosie's farm`, `royal canin`, `royal canin veterinary diet`, `sanabelle`, `schesir`, `schmusy`, `science selective`, `select gold`, `sheba`, `simpsons premium`, `smart pets`, `smartbones`, `smilla`, `smoofl`, `smølke`, `snackomio`, `specific veterinary diet`, `st hippolyt`, `supravit`, `taste of the wild`, `terra canis`, `terra felis`, `tetramin`, `tetrapro`, `thempa`, `thrive complete`, `tiaki`, `tierliebhaber`, `tikki`, `treateaters`, `trikem`, `trixie`, `trovet`, `tubidog`, `venandi`, `versele laga`, `versele-laga`, `vet-concept`, `veterinary hpm`, `vets best`, `virbac`, `virbac veterinary hpm`, `vitakraft`, `vitakraft kräcker`, `vital animin`, `viyo`, `wellness core`, `whimzees`, `whiskas`, `wiejska zagroda`, `wild freedom`, `wildkind`, `wildtier liebe`, `wolf of wilderness`, `wolfsbacher`, `yarrah`, `yummeez`, `yumove`, `zesty paws`, `ziwi`, `ziwi peak`

## Bilag C — svage ord (kræver 3 forskellige)

`adult`, `animalsk fedt`, `barf`, `bryggerigær`, `chondroitin`, `din kat`, `dyr`, `dyrlæge`, `foder`, `fodre`, `fodrer`, `fodres`, `fodring`, `fugl`, `glucosamin`, `gnaver`, `grain free`, `grain-free`, `grønlæbet musling`, `hamster`, `hest`, `hund`, `hunde`, `hvalp`, `in gravy`, `in jelly`, `indoor`, `junior`, `kanin`, `kat`, `katte`, `killing`, `kornfri`, `kornfrit`, `kropsvægt`, `kyllingehjerter`, `lakseolie`, `mineralstoffer`, `mixpakke`, `olie og fedtstoffer`, `pellets`, `pouch`, `prøvepakke`, `senior`, `spormineraler`, `sterilised`, `sterilized`, `t. hund`, `t. kat`, `taurin`, `til hunde`, `til hvalpe`, `til katte`, `til killinger`, `treats`, `tørret kylling`, `urinary`, `økonomipakke`, `ølgær`

