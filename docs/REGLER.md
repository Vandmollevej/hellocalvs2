# REGLER — globale regler for hvordan systemet opfører sig

Ét opslagssted. Hver regel: kort tekst + hvor detaljerne står. Når en ny regel
besluttes: tilføj den HER først (og i DECISIONS.md hvis den er arkitektonisk).
Søg aldrig i STATUS.md/DECISIONS.md/gamle sessioner efter en regel — står den
ikke her, er den ikke registreret og skal tilføjes.

## Mapper og filorganisering

- **Opret kun de præcise mapper, Peter udtrykkeligt befaler.** Opret aldrig ekstra undermapper, brandmapper, arkivmapper eller sorteringsmapper på eget initiativ. En tilladelse til én mappe giver ikke tilladelse til undermapper. Kilde: direkte brugerinstruks 2026-10-11.
## Varer og navngivning

- **Key-format**: `Brand Produktnavn (Mængde)`. Mængden står præcis én gang;
  brand og mængde fjernes først fra den rå titel.
- **Generiske varer (uden brandnavn/EAN)**: 100 % uden brandnavn (grøntsager,
  frugt, kød m.m.) er råvarer / generiske ingredienser (`GenericIngredient`,
  altid `INGREDIENT`, enhed g) og scannes ikke. Kilde: session
  "HelloCal OpenAI produktgenkendelse", 2026-09-18; se også DECISIONS.md
  (Frida-match, mikrodata kopieres fra Frida).
- **Billedfilnavne** (udledt af `Productdatabase/Bilka/bilka.py`, `build_key`/
  `download_image`, og `Produkter klar til import/_rename_log.csv`; mønster
  afledt 2026-10-08, afventer brugerens bekræftelse):
  - Har varen EAN → `<EAN>.<ext>`. Dublet (samme EAN fra anden kilde) →
    `<EAN>_2`, `_3` … Første rang: BILKA (DK) / EDEKA (DE).
  - Har varen IKKE EAN → filnavn = Key: `Navn, mængde (Brand)`.
  - **Generisk vare uden brand og uden EAN (besluttet af brugeren 2026-10-08)**:
    filnavn = `<produkttype> <variant>` adskilt med mellemrum (ingen mængde,
    ingen parentes). Overlap (samme navn) → `_2`, `_3` osv.
    **Undtagelse:** er der angivet energifordeling/næringsindhold på varen, er
    den et unikt produkt og får butiksnavnet hægtet på efter varianten:
    `<produkttype> <variant> <butik>` (ikke `_2`). Eksport-udseende afgøres
    senere. Gælder også allerede eksisterende billeder/rækker (omdøb overalt).
  - (Gammelt udkast, afløst af reglen ovenfor: `Navn, mængde`.)
  - Ikke afklaret: 601 filer i `Færdige produktbilleder` hedder kun et kort
    tal (`100.png`, `1068.png`) — kilde ukendt.
  - Skal gælde alle steder: originale, til gennemgang, færdige. Filer i
    Færdig-mapper må også ligge i Original, men aldrig i Fejlet/Til gennemgang.
- **Boolske felter**: aldrig "Ja"; brug beskrivende ord (Sukkerfri, Laktosefri,
  Vegansk).
- **Dyrefoder**: spærres (blacklist) — se docs/DECISIONS.md "Pet-food blacklist".

- **Produkttype: ental og flertal (kun generiske varer, besluttet 2026-10-08)**:
  generiske varer får to kolonner/felter ved siden af produkttype: `Product type
  singular` og `Product type plural`, begge udfyldt. Søgning efter "et æble"
  må ikke give "æbler" (og omvendt). Hvor ental = flertal (fx æg) eller det ikke
  kan afgøres, står samme tekst i begge. Gælder ark og database
  (`GenericIngredient`); almindelige varer med brand/EAN berøres ikke.
  Status: ikke implementeret endnu.
- **Små ord i navne**: med, i, af, uden skrives altid med småt i
  produktnavne/produkttype/variant (aftalt 2026-10-08, ikke gennemført endnu).
- **Generisk vare** = ingen Brand og ingen Subbrand i arket (EAN ses bort fra).
  I databasen ligger de i `GenericIngredient`, ikke `Product`.

## Logoer og billeder

- **Logooprydning 2026-10-17 (Peter):** Alle færdige filer i hovedmappen `Logoer` bevares. Gengangere af disse fjernes fra `Originale` (også ZIP-indhold), `Mangler udklipning` og `Afvigere` efter sammenligning. Reglen om at bevare produktfotos gælder fortsat; samme mærke på et produktfoto gør ikke fotoet til en logodublet.

- **OFF-produktfotos: kantbeskæring (Peter, 2026-10-12)**: I `Produkter/Lidl og Aldi`, `Produkter/Kvickly billeder`, `Produkter/Änglamark` og `Produkter/Nøglehul og Økologi` beskæres billeder rektangulært omkring produktet. Ingen baggrundsfjernelse eller ændring af produktets udseende. Erstat originalerne med kontrollerede beskæringer under samme filnavne; behold ikke originalkopier. Billeder i ZIP-filer skal også beskæres og gemmes tilbage i de samme ZIP-filer (udtrykkeligt bekræftet af Peter). Regneark ændres ikke.

- **Logoarbejde 2026-10-12**: Slå først logoet op på nettet. Eneste alternativ til det indbyggede AI-billedværktøj er opslag efter originale online logoassets; almindelig alpha-reparation og SVG-til-PNG-rendering er ikke godkendt. Den tidligere tilladelse til tabsfri alpha=0-kanttrim gælder stadig. Fortsæt arbejdet uden stop for nye spørgsmål; en særskilt agent håndterer afklaringer (Peters direkte instruktion).

- **Oprydning af logodubletter gælder kun logofiler, ikke produktfotos**, også når et produktfoto viser et mærke, som allerede har et færdigt logo (Peter, 2026-10-12).

- Færdige logofiler hedder kun **Brand** eller **Brand - Subbrand**. Ingen ord som færdig, restaureret, transparent eller farve/form som opdigtet subbrand. Dubletter sammenholdes visuelt, og den bedste beholdes (Peter, 2026-10-11).
- Denne logorestaurering bruger det indbyggede AI-billedværktøj; eksisterende originale logoassets må findes online. Ingen almindelig rasterbehandling uden udtrykkelig undtagelse fra Peter. Logoets officielle artwork skal bevares, emballageperspektiv rettes, baggrund fritlægges og gennemsigtige margener trimmes.
- Peter har godkendt tabsfri beskæring med almindelige værktøjer KUN af helt gennemsigtige kantpixels (alpha = 0). Alle pixels med alpha > 0 bevares uændret; ingen anden almindelig rasterbehandling er tilladt (2026-10-11).
- Kilder klippes til den udtrykkeligt bestilte mappe **Under udarbejdelse**. Slet først kilden, når det færdige resultat er gemt og visuelt kontrolleret; behold kilden ved fejl. Originaldubletter slettes efter sammenligning med hovedmappens logo. Ingen ekstra arkiv-/sorteringsmapper.
- Kun mad-/drikkevaremærker får logo (ikke husholdning/rengøring/køkkenudstyr);
  foretræk rent wordmark uden tagline. Se docs/LOGO-AGENT.md.
- Brugerens uploadede PNG-kunst bruges som den er (skaleret/CSS-mask), aldrig
  gen-tegnet som SVG.

## UI

- "Overlay"/"popup" = den træk-bare BottomSheet (`.hf-bottom-sheet`), se KRAV.md.
- Visuelle ændringer: læs design.md; størrelse/vægt ændres i moderate trin.

## Sikkerhed

- Streng sikkerhed (vault) kun for admin; almindelige brugere får normalt login
  (email/adgangskode, Face ID, Google/Apple/Facebook).

## Proces

- Ved midlertidig fejl i drev-/filadgang: gentag kontrollen løbende og fortsæt automatisk, når adgang kommer tilbage; én fejlet kontrol er ikke bevis for, at brugerens drev er frakoblet (Peter, 2026-10-11).

- Flere parallelle sessioner: stage snævert, deploy-linjen er origin/master.
- Efter rebase der rører `prisma/schema.prisma`: kør `prisma validate` + typecheck.

## Crawlere og billeder

- Kun forsiden + login/juridiske sider er åbne for anonyme; alt andet kræver
  login (`src/lib/access-wall.ts`). Nye offentlige ruter skal tilføjes dér.
- Nye billedmapper med produkt-/opskrifts-/mærkebilleder skal i
  `PROTECTED_IMAGE_PREFIXES`.
- Aldrig vandmærke eller skjult bruger-ID i billeder (brugerens regel 2026-10-08).

## Midlertidige filer

- Midlertidige filer (Excel-udtræk, CSV, scripts, mellemresultater) må aldrig
  ligge i projektets rodmappe. Brug scratchpad/temp-mappen, og slet dem selv
  når de er brugt. Skal en fil blive liggende, så spørg brugeren først
  (brugerens regel 2026-10-09).

## Produktnavne i ark (globale regler, gælder ALLE ark — brugerens regel 2026-10-09)

- **Originalkolonnerne rettes ALDRIG** (alle ark, brugerens regel 2026-10-10):
  `Original Title`, `Product Name`, `Subtitle`, `Source URL`, `Image File`,
  `Parse Status` og butikkens øvrige skrabede kolonner (`Manufacturer`,
  `Servings`, `Price`, `Venue`, SPAR `Subcategory`/`Vare`/`Variant`/`quantity`)
  står bagerst og er præcis som skrabet — ingen stavning, forkortelser,
  decimaltegn eller m./u. i dem, hverken i hånden eller med scripts. De må kun
  læses; alle rettelser skrives i vores egne kolonner. Er de ændret, hentes de
  tilbage fra den rå skrabning. Se Excelark/NAVNEREGLER.md.
- **Alle ark er 100 % identiske med Bilka** (2026-10-10): de samme 45 kolonner
  (navne, rækkefølge, titelformler), ingen ekstra kolonner. Arbejdsarkene og
  scriptet (`Excelark/omlaeg_til_bilka_kolonner.py --ens`) står i
  Excelark/NAVNEREGLER.md.
- **Quantity i samme stil** (alle ark, brugerens regel 2026-10-10): tal,
  mellemrum, enhed med småt som Bilka — `200 g`, `75 cl`, `1.5 l`, `6 stk`,
  `6 x 0.33 l`, `ca. 600 g`, `1 bakke`; aldrig `200g`, `1Ltr` eller `200 g.`.
- **Titelrækkefølge**: `_is_cooked` > Product Type (småt begyndelsesbogstav
  hvis det ikke er første ord) > Variation > `_is_light`, `_is_alcohol`,
  `_is_glutenfree`, `_is_vegan`, `_is_lactose_free` > `(Packaging, Keyword 1-3,
  _is_raw)`. `_is_raw` står i parentesen FØR nøgleordene (rettet 2026-10-09).
- **`_is_cooked`** (stegt/tørret/kogt/syltet/ristet/røget …) står altid først
  i titlen og skrives i ental/flertal efter varen: "Tørrede figner",
  "Friturestegte pommes frites", "Tørrede og kogte hvide bønner" — aldrig
  "Tørret, Kogt". Ordet fjernes fra Product Type/Variation.
- **Forkortelser i de originale felter** (Product Name / Original Title /
  Subtitle): `m.` `m/` → "med", `u.` `u/` → "uden", `i`, `af`. Det der står
  efter dem og ligger i Variation skrives med småt begyndelsesbogstav og
  får ordet foran: "Ymerdrys m. kanel" → Variation "med farin og kanel".
  Rettelsen skrives kun i Variation — selve originalfeltet røres ikke.
- med/uden/i/af/på/fra/tilsat står altid med småt i Variation og titel.
- Keywords må aldrig deles op midt i en frase: "Uden tilsat sukker" er ét
  keyword (ikke "Uden" + "Tilsat sukker").
- Instantkaffe hedder altid "Instantkaffe" (Product Type), ikke "Kaffe, instant".
- Vitaminer hører ikke hjemme i keywords, men i specifikationsarket
  (`*_vitamins.xlsx`/`*_product_information.xlsx`) — status: ikke gennemført.
- Status 2026-10-09: HelloCal_Title genopbygget i Frida-ark/frida.xlsx (se Excelark/NAVNEREGLER.md, nøgleord-regler); også
  Excelark/bilka_matchet.xlsx; resten af arkene mangler.
- Lister i Variation/Keywords: `/` og komma → "a, b og c" (to led: "a og b");
  fedt% → `_is_fat`; gram kun i Quantity (brugerens regel 2026-10-09). Se Excelark/NAVNEREGLER.md.
- Nøgleord-regler fra Frida (vild, på dåse, tør/sød m.fl.): se Excelark/NAVNEREGLER.md.
- **`_is_decaf`** (global, alle ark): kun værdien "Koffeinfri"; "koffeinfri" flyttes fra Variation/titel hertil. Gælder alle ark (Bilka, REMA, Nemlig, DRK, Wolt m.fl.) — indføres i hvert ark når det tages igen. Se Excelark/NAVNEREGLER.md.
- Frida-ark: navngivningsreglerne i Excelark/NAVNEREGLER.md (afsnittene "Nøgleord-regler", "Flere Frida-regler", "Nye globale felter") er globale og gælder alle ark.
- Bilka/REMA ental/flertal + DB-kolonnenavne: se Excelark/NAVNEREGLER.md (status 2026-10-09: _ny-ark lavet, ikke gennemgået).
- **Ingen dobbeltord** i samme række i de kolonner vi retter i (alle ark); `_is_meat` er undtaget. Frost står kun i `_is_frozen`, aldrig "Frozen" i packaging (brugerens regel 2026-10-10).
- **Procent og ost** (alle ark, brugerens regel 2026-10-10): aldrig % i produkttype/variant/keywords — fedt-% → `_is_fat`, alkohol-% → `_is_alcohol`, ingrediens-% fjernes. "45+" o.l. = ost og står FØRST i variant ("45+, med kommen"). Produkttype der starter med % er fejlet og findes i Original Title. Se Excelark/NAVNEREGLER.md.
- **"ben" hører til produkttypen** (alle ark, brugerens regel 2026-10-10): står "ben" alene i Variation, er det del af produkttypeordet og skrives sammen med det: "Skiver af okse" + "ben" → "Skiver af okseben". Står der "med ben", følger "med ben" med ind i produkttypen ("Ibérico kotelet med ben", som "Koteletter af gris uden ben"). Variation ryddes; `Product type plural` rettes tilsvarende. Se Excelark/NAVNEREGLER.md.
- **Ost: "revet" og "i blok"** (alle ark, brugerens regel 2026-10-10): al revet ost får keyword `revet` (ordet fjernes fra typen: "Revet mozzarella" → "Mozzarella (Revet)"). Al fast ost og "i stykke" (også "i blok") får keyword `i blok` ("Modnet fast ost 45+ (I blok)"); ikke ost i skiver/tern/revet og ikke "halvfast". Se Excelark/NAVNEREGLER.md.
- **Titel (global, 2026-10-10)**: kun én parentes: `(rå, nøgleord, nøgleord)`; sukkerfri/glutenfri/alkoholfri/koffeinfri står også i teksten; brand/subbrand kun som ikoner. Se Excelark/NAVNEREGLER.md.
- **Dobbeltord, brand, sukker/fedt/alkohol, flertal** (alle ark, brugerens regler 2026-10-10): intet ord to gange i samme celle; brandnavn fjernes fra productType (brandet røres ikke); sukker-/fedt-/alkohol-angivelser kun i deres egne kolonner; `Product type plural` står aldrig tom (samme ord, hvis der ikke findes et flertal). Se Excelark/NAVNEREGLER.md.
- **ALDRIG nye arkfiler** (alle ark, brugerens regel 2026-10-10, SKAL overholdes): ret altid direkte i brugerens eget ark med det originale filnavn (fx `rema1000.xlsx`, `spar.xlsx`). Lav ALDRIG kopier med nyt navn (`_ens`, `_ny`, `_v2`, `_fixed` o.l.) og omdøb aldrig ark. Backup = kopi i den ene `Backup`-mappe, intet andet. Er arket åbent i Excel: læs og gem brugerens ændringer først, overskriv dem aldrig.
- **anb, zinf, bdt, øko, lande, keywords** (alle ark, brugerens regler 2026-10-10): "anb"/"anbrud" slettes; "zinf" = zinfandel; "14bdt" = "14 per bundt"; alt med Øko → `_is_organic` = "økologisk" og øko-ordet slettes fra egne kolonner; lande i `_is_country_of_origen` med STORT begyndelsesbogstav ("Frankrig"); keywords der er dobbeltord/afkortninger af ord i samme række slettes, delte fraser samles. Se Excelark/NAVNEREGLER.md ("SPAR: anb, zinf, bdt, øko, lande").
- **Decimaltegn, REMA-flavor, engelsk sugarfree** (alle ark, brugerens regler 2026-10-10): decimaler skrives med punktum i arkene ("1.5 l"), intet tusindtalspunktum ("1080 g"); appen viser komma for Danmark og andre komma-lande. REMA's `flavor` er lagt ind i `variant`, og kolonnen er slettet. Engelsk sugarfree rettes kun i sukkerfeltet ("sukkerfri"), aldrig i navnet. Se Excelark/NAVNEREGLER.md.
- **Gengangere** (alle ark, brugerens regel 2026-10-11): samme produkt kan have forskellig stregkode i to lande/butikker, og alle detaljer kan være ens bortset fra fx årstallet på en vin. Gengangere findes derfor på brand + mængde + navn, ikke kun på EAN, og gennemgås først som rapport (`Excelark/gengangere-fund.xlsx`) — rækker slettes aldrig uden at brugeren har set listen; ved sammenlægning gemmes den tabende kæde/EAN på vinderen (se "Dedupe keeps chain").
- **dm, EDEKA, REWE, Wolt optimeret efter Bilka-mønsteret** (2026-10-11): faste regler `Excelark/optimer_ark.py` + AI-gennemgang af produkttype/variation/keywords `Excelark/anvend_ai_forslag.py`; vin/spiritus røres ikke (vin-sessionen). Detaljer i Excelark/NAVNEREGLER.md ("Optimering af dm, EDEKA, REWE og Wolt").
- **Vin** (alle ark, brugerens ønske 2026-10-10): vin-rækker er delt i Product Type (Rødvin/Hvidvin/Rosévin/Mousserende vin …), Brand (producent), Subbrand (kun egen linje med logo), Variation (vinens navn: appellation/cuvée/druesorter) og nøgleord (sødme, kvalitet, årgang); land, økologisk, alkoholfri og alkohol-% står i egne felter. Gennemført i Bilka, REMA, SPAR, Nemlig, Wolt, DRK, EDEKA og REWE. Se Excelark/NAVNEREGLER.md ("Vin: produkttype …") og Excelark/vin_regler_spec.md.
- **Open Food Facts-import: Lidl, Aldi, Kvickly/Coop** (brugerens ønske 2026-10-11, afsluttet 2026-10-16): egne mærker hentes fra OFF (kun varer solgt i Danmark) og ligger i `Produkter/lidl.xlsx`, `aldi.xlsx`, `kvickly.xlsx` i Bilkas kolonner; originalkolonnerne er rå OFF og rettes aldrig. Felter krydstjekkes mod label/navn/ingredienser/allergener/næringsindhold (økologisk, glutenfri, vegansk, sukkerfri, fedt-%, alkohol, frost), produkttype matches mod de eksisterende arks vokabular, og alt gættet/mistænkeligt står i `Produkter/Backup/Excelark/off_kvalitetskontrol.xlsx` og `Produkter/Backup/off_afslutning_*.xlsx`. Lidl/Aldi: Brand = kæden, Subbrand = det egne mærke (som `OFF Dansk.xlsx`); Quantity aldrig "stk". Håndrettelser: `Produkter/Backup/Excelark/off_rettelser.txt`, lagt ind i de gældende ark med `anvend_off_rettelser_ark.py` (overskriver aldrig det andre sessioner har rettet). Menu/Meny har ingen egne mærker ud over Dagrofas (står i `spar.xlsx`). Se Produkter/NAVNEREGLER.md ("Open Food Facts-import").


- Logoarbejde (Peter, 2026-10-11): Ret perspektiv og krumning fra emballage til flade, lige logoer uden redesign. Kun AI til billedarbejdet. Navngiv efter teksten i logoet. Færdige PNG'er i Logoer-hovedmappen; fjern kun originaler og sikre dubletter efter et godkendt resultat. Afvigere skal have både original og resultat i eksisterende Afvigere, ingen ekstra undermapper. Vælg den bedste original ved dubletter.

- Logo-feedback (Peter, 2026-10-11): Magnum kun cirkelmedaljonen, ingen emballage udenom. Dan Cake kun røde logoformer med gennemsigtigt mellemrum. Premier Is i denne bunke skal have ensartet flad orange baggrund uden pletter. Første 100 færdiggøres og gennemgås af Peter før de yderligere 300.

- **Logoers filnavne i hovedmappen**: kun Brand eller Brand - Subbrand. Ingen Færdigt, restaureret, isoleret, baggrundsbeskrivelser eller andre arbejdsetiketter. Subbrand adskilles med mellemrum, bindestreg, mellemrum. Direkte brugerinstruks 2026-10-11.

- Logo-upload til biblioteket (Peter, 2026-10-12): tilføj kun manglende logoer; overskriv aldrig eksisterende bibliotekslogoer. Færdige filer fra Logoer-hovedmappen bevares byte-identisk. Upload til biblioteket ændrer ikke automatisk brandtilknytninger.

- **Subbrand og Co-brand i arkene** (Peter, 2026-10-15): Subbrand = brandets egne linjenavne (Haribo Goldbären, Tuborg Grøn). Co-brand = et subbrand der låner et andet brand (Baileys i Frisko-is, Milka i Jacobs-kaffe, Oreo i Marabou) — eget logo vises sammen med brandet; ny kolonne `Co-brand` (kolonne 38 af 46, lige før originalkolonnerne) i alle butiksark. Almindelige ord, smagsretninger og produkttyper (crème fraîche, pommes, BBQ, creamy, extra …) er aldrig subbrands, og en logofil eller gentagelser alene er ikke bevis. Titlen må ikke blive tom. Logofiler sammenlignes med brandnavne uden specialtegn (apostrof m.fl.). Se Produkter/NAVNEREGLER.md ("2026-10-15: Subbrand og Co-brand").


## 2026-10-12: Aldi/Lidl-produktbilleder
- Peter: Produktbillederne til `Aldi_Danmark.xlsx` og `Lidl_Danmark.xlsx` skal ligge direkte i samme mappe som arkene (`Produkter/Lidl og Aldi`), navngivet efter EAN med originalt billedformat. Bevar indledende nuller. Hent eksisterende produktfotos uden billedbearbejdning; kontrollér filernes læsbarhed og tilknytning til EAN.

## 2026-10-12: Kontrol efter arbejde
- Peter: Kør altid kontrol efter arbejdet og før færdigmelding. For produktark: kontrollér resultatet mod kilde/backup, udvælgelsesregler, EAN, rækkeantal og bevaret indhold. Et vellykket gem alene er ikke nok.

## 2026-10-12: Én arbejdsmappe for produktark
- Peters eneste arbejdsmappe for produktark er `C:\Users\Peter\Desktop\Hello Cal\Produkter`, inklusive eksisterende butiksmapper. Ingen aktive arbejdsark i `Excelark` eller på F-drevet fremover.
- Ved sammenlægning har Peters seneste egne rettelser forrang. REMA-master er `Produkter\rema 1000\rema1000_version 2.xlsx`. Ingen overskrivning ud fra dato alene; sammenlign rækker og celler, og bevar bevidst slettede rækker.
- Bevar originale filnavne. Alle sikkerhedskopier samles i én `Produkter\Backup`-mappe. Ingen nye versionsark eller mellemresultater i arbejdsmapperne.
- Åbne/ugemte Excel-rettelser skal være afklaret inden ændring af eksisterende ark.

- **Aldi/Lidl Danmark-udtræk (Peter, 2026-10-12)**: I råarkene i `Produkter/Lidl og Aldi` fjernes varer over fem år og EAN, som allerede findes i Excel-ark direkte i `Produkter`. Dansk tekst/sprog, dokumenteret dansk scanning og Danmark som salgsland flyttes (klippes) til de udtrykkeligt bestilte `Aldi_Danmark.xlsx` og `Lidl_Danmark.xlsx`. Peter har særskilt bekræftet salgslandsreglen. Alle originalkolonner og metadata bevares.

- **Aktive produktark efter samling 2026-10-12**: Alle 13 butikker bevares. Aktuelle præcise arbejdsstier står i `Produkter/NAVNEREGLER.md` under "Gældende arbejdsfiler fra 2026-10-12". Alle tidligere `Excelark/`-referencer er historiske; mappen er flyttet til `Produkter/Backup/Excelark`. Kør ikke arkivscripts mod arkivkopier. Rå OFF-udtræk i Produkters eksisterende kildemapper er bevarede kilder; den bearbejdede 45-kolonneversion er butikkens arbejdsark.

## 2026-10-12: Änglamark_Danmark (Peters konkrete instruktion)
- Änglamark-kilden skal hedde Änglamark_Danmark og opdeles i hovedark + produktdetaljer efter Bilkas aktuelle kolonner. Denne navngivning er en udtrykkeligt bestilt undtagelse til reglen om at bevare filnavne.
- Kun produkter med dokumenteret dansk registrering/salgsland eller oprindelse medtages. Præcise EAN-dubletter må i denne opgave slettes efter Peters direkte instruktion. Alder vurderes på seneste produktredigering, med oprettelsesdato som reserve; automatiske OFF-opdateringer nulstiller ikke alderen. Metode, afgrænsning og resultat: docs/ANGLAMARK-DANMARK.md.


- **Änglamark-fødevarer (Peter, 2026-10-12)**: Aftersun, zinkcreme og øvrige plejeprodukter hører ikke til i fødevarearkene. De to konkrete produkter er fjernet fra både hovedark og alle produktdetaljefaner.

## 2026-10-12: Kvickly — grammatik og feltplacering
- Variationer bruger grammatisk med/uden/i/af/på/fra, hvor betydningen kræver det. Opremsninger: a og b; a, b og c. Eksisterende sidste og må ikke få det foregående komma ændret til et ekstra og. & som listeadskiller rettes til og; egennavne bevares.
- Surdejs- sættes før produkttypen, fx Surdejs-pizzabund. Hele/halve og bøjelige tillægsord står foran produkttypen. Tilberedning (fx stenovnsbagt, paneret, marineret) står i _is_cooked; tilberedning af en ingrediens inde i en variant må ikke flyttes som tilberedning af hele produktet.
- Alle almindelige ord i Variation og Keyword-felter har små begyndelsesbogstaver. Stave- og sammenskrivningsdubletter normaliseres, fx Chia frø → Chiafrø. Originalkolonnerne bevares.
- Fuld alene i Kvickly-pizzavarianten betyder fuldkorn og flyttes til _is_whole_grain (Peter). Størrelser S/M/L/XL står i Size, svarende til eksisterende ProductProperties.size; ikke i smagsvarianten. Kvickly har nu en ekstra Size-kolonne efter de oprindelige 45 kolonner. Der er ikke ændret appimport eller database.

## 2026-10-12: Kvickly-billeder fra Open Food Facts
- Peter har bestilt én billedmappe ved siden af Produkter/kvickly.xlsx: Produkter/Kvickly billeder. Ingen ekstra undermapper. Hent billeder for netop arbejdsarkets EAN: forside, alle uploadede originalfotos og tilgængelige øvrige etiketter i fuld opløsning. Filnavne EAN.ext, EAN_2.ext osv.; eksisterende forskellige filer bevares. Manglende OFF-billeder og downloadfejl dokumenteres hver for sig. Originalfelternes billed-URL'er i arket ændres ikke.

- **Nøglehul og Økologi: OFF-billeder** (Peter, 2026-10-12): alle produktfotos ligger direkte sammen med produktarkene i `Produkter/Nøglehul og Økologi`; hovedbillede = `EAN.jpg`, ekstra billeder = `EAN_2.jpg`, `EAN_3.jpg` osv. Foranstillede nuller bevares. Ingen ekstra billedmappe. Billedregister: docs/NOGLEHUL-OKOLOGI-BILLEDER-20261012.json.
- Kvickly-billedarkivering (Peter, 2026-10-12): EAN med præfiks 57 pakkes i ZIP-filer i samme billedmappe, højst 200 billeder pr. ZIP (inklusive eventuel restportion). Originalerne slettes først, når alle ZIP-filer og hvert billedindhold er kontrolleret mod SHA256 og CRC. Øvrige EAN-billeder bevares.

## 2026-10-12: OFF Energimærkning
- Peter har bestilt en undermappe med det præcise navn `OFF Energimærkning` i hver eksisterende hovedmappe `Produkter/Nøglehul og Økologi`, `Produkter/Kvickly billeder` og den fælles `Produkter/Lidl og Aldi`. OFF-billeder af tekst, beskrivelser, næringsindhold, ingredienser og øvrige deklarationer flyttes dertil; almindelige produktforsider bevares i hovedmappen.
- Instruktionen omfatter også ZIP-indhold: relevante billeder flyttes ud i den bestilte undermappe og fjernes fra ZIP-filen efter hash-/CRC-kontrol. Øvrige ZIP-poster og billedindhold bevares. Ingen billedbearbejdning eller omdøbning i denne sorteringsopgave.

## 2026-10-14: Sprogark og Bilka-behandling
- **Sprogark (Peter, 2026-10-14)**: `Produkter/Dansk.xlsx` og `Produkter/Tysk.xlsx` samler varerne på tværs af butiksarkene efter sprog. Sproget afgøres af varens titel/produkttype (Wurst = tysk, pølse = dansk, sausage = engelsk) — ikke af butikken. Rækkerne kopieres (butiksarkene røres ikke), Bilkas kolonner. Andre sprog (svensk, norsk, engelsk m.fl.) laves bagefter. Metode, tal og værktøj: Produkter/NAVNEREGLER.md ("2026-10-14: Sprogark …").
- **Bilka-behandling af Nemlig, DRK, Årstiderne, Wolt, Kvickly, Lidl, Aldi og Nøglehul (2026-10-14)**: økologi-flag fra originaltitlen, nøgleord uden dobbeltord, `Product type plural` udfyldt, subbrand fra kendte brand/subbrand-par, DRK-brand fra titlen. Derudover AI-gennemgang af Product Type/Variation/Keywords for Nemlig, DRK og Årstiderne (Peter sagde ja til kørslen) og AI-udfyldning af tomme produkttyper i SPAR/Nøglehul/Wolt (kun høj sikkerhed; resten står tomt hellere end gæt). Alkohol (vin/øl/spiritus) røres ikke af disse trin — det ejes af vin-reglerne.
- **Tyske ark (dm, EDEKA, REWE) behandlet efter samme princip som Bilka (Peter, 2026-10-14)**: AI-gennemgang af rækker hvor Product Type/Variation/Keywords var forskudt i forhold til titlen eller svage (EDEKA ca. 430 rækker, REWE 77, dm 8), faste regler (Pack Count, afkoffeineret/sukkerfri-flag, nøgleord der dublerer brand/produkttype/variant) og EDEKA-arkets ødelagte matrixformler genskabt (arket kunne ikke åbnes i Excel). Dyrefoder/ikke-mad rettes ikke her, kun listet til den separate spærring. Se Produkter/NAVNEREGLER.md.
- **OFF-sprogsortering (Peter, 2026-10-15)**: "ark kun på dansk / kun på tysk" gjaldt Open Food Facts-filerne (Lidl.xlsx, Aldi.xlsx, Lidl/Aldi Danmark, Nøglehul/Økologi, Änglamark, Kvickly-JSON), ikke butiksarkene. Sproget afgøres af titlen; resultat i `Produkter/OFF Dansk.xlsx`, `OFF Tysk.xlsx` og `OFF Sprogindeks.xlsx` (alle 147.278 rækker) med energifordeling (protein 4/kulhydrat 4/fedt 9 kcal/g). Andre sprog og Bilka-opsætning af OFF-varerne følger bagefter. Se Produkter/NAVNEREGLER.md ("2026-10-15: OFF-sprogsortering").
- **Regel ved ark med matrixformler (B-kolonnen)**: tjek altid først for matrixceller på forkert række eller med `ref` ≠ egen celle (`xml_scan.py` og `arr_scan.py` i Produkter/Backup/Excelark) — openpyxl-roundtrip ødelægger dem ellers, og Excel kan slet ikke åbne filen. Genskab formlerne fra rækkens egen skabelon (`reparer_titelformler.py`) og kontrollér i Excel (`excel_final.ps1`).

- **Subbrand-logo på produktet (Peter, 2026-10-17):** Produktet viser altid brand-logoet. Matcher produktets Subbrand en logofil «Brand - Subbrand» (Brand.name i logobiblioteket), vises subbrand-logoet oven over brand-logoet (`subbrandLogoUrl` fra /api/products/[id], vist i AddProductView). Nye logoer lægges i NAS `Projektfiler (ikke app)\Logoer`; ved navneskift til «Brand - Subbrand» fjernes gamle navnevarianter (Backup\Dubletter 2026-10-17) så der ikke ligger dubletter.

## UI: Sortering og Visning = dropdown (2026-10-17)

- Sortering og Visning (liste/galleri, evigheds-scroll/sideinddelt m.fl.) er ALTID en dropdown (`<select>`/FilterDropdown), aldrig knapper/chips/segmenter. Gælder overalt: admin, web og app.
