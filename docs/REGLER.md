# REGLER — globale regler for hvordan systemet opfører sig

Ét opslagssted. Hver regel: kort tekst + hvor detaljerne står. Når en ny regel
besluttes: tilføj den HER først (og i DECISIONS.md hvis den er arkitektonisk).
Søg aldrig i STATUS.md/DECISIONS.md/gamle sessioner efter en regel — står den
ikke her, er den ikke registreret og skal tilføjes.

## Screeninger

- Profil → Screeninger er stedet for egne målinger (migræne, mavesmerter, humør, selvoprettede). Søvn er en fast række (også øverst i Screeningrapporter, peger på /statistics/sleep). "Opret ny screening" er et flow, ikke en enkelt formular. Se DECISIONS.md 2026-10-09.
- Valget "Screening" ligger nederst i Tilføj-menuen og kan vælges som bundmenu-ikon.

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
- **Frida / generiske varer — navngivningsregler (aftalt 2026-10-09)**:
  - **Raw / Cooked / Processed**: egne kolonner. `Raw` = rå (kød og fisk hedder *fersk* i titlen), `Cooked` = tilberedt (kogt, stegt, syltet, tørret, i sukkerlage, blandede salater), `Processed food` = alt der ikke er rå. Wokblandinger er rå. Ordene klippes ud af variation/nøgleord og vises i titlen.
  - **Tørret/syltet står foran** produktet ("Tørret æggehvide"), flertal "Tørrede linser", "Syltede brombær". Farver står altid foran ("Hvid peber", "Grønne asparges").
  - **Variation**: aldrig "/". To led: "a og b". Flere: "a, b og c". "m", "m." og "m/" betyder *med* og flyttes til variation ("Kartofler, med krydderurter").
  - Samme produkttype må aldrig stå to gange i et navn (kun "Fuldkornsrugmel", ikke "Rugmel, fuldkornsrugmel"). Ost: produkttype "Ost", sorten (Havarti) er variant, "45+" er variant og står i titlen.
  - Engelske, franske og andre udenlandske ord trækkes ikke sammen (creme fraiche, pommes frites, quinoa). Kun danske ord sættes sammen.
  - `Decaf` skrives *Koffeinfri*. `Læskedrik` bruges ikke (Sodavand / Saftevand). `Konventionel` skrives *ikke-økologisk*. `Uspecificeret`, takeaway og fastfood bruges ikke. Alkohol-% står i `_is_alcohol` (ikke i titel), fedt-% i `_is_fat`.
  - Dybfrost = `_is_frozen`. Landeord (atlantisk, dansk …) står i `_is_country_of_origen`. Light kan sorteres på særskilt flag, uafhængigt af sukker.
- **Generisk vare** = ingen Brand og ingen Subbrand i arket (EAN ses bort fra).
  I databasen ligger de i `GenericIngredient`, ikke `Product`.

## Logoer og billeder

- Kun mad-/drikkevaremærker får logo (ikke husholdning/rengøring/køkkenudstyr);
  foretræk rent wordmark uden tagline. Se docs/LOGO-AGENT.md.
- Brugerens uploadede PNG-kunst bruges som den er (skaleret/CSS-mask), aldrig
  gen-tegnet som SVG.
- **Brand og subbrand ved produktcirklen (bruger 2026-10-10)**: brandet står til
  højre for cirklen, subbrandet oven over det. Begge vises som logo, når det
  findes, ellers som navn i fed grøn tekst. Subbrand-logofiler hedder
  `<brand> <subbrand>.png` eller `<subbrand>.png` og lægges ind som brand-logoer
  (admin-upload eller `_import`). Se DECISIONS.md 2026-10-10.

## Søgning

- **Brand og subbrand er søgbare (bruger 2026-10-10)**, også når varesiden kun
  viser dem som logo: søgningen kigger i titel (ental og flertal), brand,
  subbrand, varetype, variant, smag, søgeord, synonymer og sukkerpåstande, uden
  hensyn til accenter (se også "Søgning læser alle varens tekstfelter").
- **Brand først (bruger 2026-10-10)**: står et brand eller subbrand som helt ord
  i søgningen, står dets varer altid øverst — også når produkttypen passer
  bedre på en anden vare. Indbyrdes sorteres de efter resten af søgningen
  ("arla skyr" → Arla skyr før Arla mælk). Parametrene "Brand nævnt i
  søgningen"/"Subbrand nævnt i søgningen" ligger i admin → Søgealgoritmer
  (standard 100; fra 20 altid øverst; 0 slår fra). Se DECISIONS.md 2026-10-10.

## UI

- **ALDRIG grå tekst på grøn baggrund (user rule 2026-10-09)**: tekst på grøn flade (`bg-hf-brand`, grønne knapper/kort) er altid hvid (`text-hf-white`). Kombinér aldrig `text-text-secondary` eller andre grå farver med hvid på grøn — den grå vinder og gør teksten ulæselig. Gælder web og native.

- Sideoverskrifter er altid `hf-type-page-title` (22 px); `hf-type-hero` (32 px) er kun til tal/produktnavn i hero-kort, aldrig til en sides overskrift (bruger 2026-10-09).
- "Overlay"/"popup" = den træk-bare BottomSheet (`.hf-bottom-sheet`), se KRAV.md.
- Aktiviteten `open_water` hedder "Svømning i åbent vand" — aldrig "Havsvømning" (bruger 2026-10-09). "havsvømning" er kun et søgeord.
- Visuelle ændringer: læs design.md; størrelse/vægt ændres i moderate trin.
- **Decimaltegn (user rule 2026-10-10)**: arkene (og databasen) skriver decimaler med punktum ("1.5 l", "3.5% fedt"); appen viser brugerens eget decimaltegn efter landet i profilen — komma i Danmark og de andre komma-lande ("1,5 l"), punktum i fx GB/IE/US/CA/AU/NZ/CH. Vis varetekster via `DecimalText`/`localizeDecimals` (`src/lib/decimal-separator.ts`); søgning finder begge skrivemåder. Se DECISIONS.md.
- **Originalkolonnerne i produktarkene rettes ALDRIG (user rule 2026-10-10)**: `Original Title`, `Product Name`, `Subtitle`, `Source URL`, `Image File`, `Parse Status` og butikkens øvrige skrabede kolonner (`Manufacturer`, `Servings`, `Price`, `Venue`, SPAR `Subcategory`/`Vare`/`Variant`/`quantity`) er præcis som skrabet — ingen stavning, forkortelser, decimaltegn eller m./u., hverken i hånden eller med scripts. Alle rettelser skrives i vores egne kolonner; er de ændret, hentes de tilbage fra den rå skrabning. Se Excelark/NAVNEREGLER.md.
- **Alle produktark har Bilkas kolonner (2026-10-10)**: kolonne 1-43 præcis som `Excelark/bilka.xlsx` (samme navne, rækkefølge og titelformler); SPAR, Nemlig, Wolt, DRK, Årstiderne, dm, EDEKA og REWE er omlagt med `Excelark/omlaeg_til_bilka_kolonner.py` (deploy-grenen). Se Excelark/NAVNEREGLER.md.
- **Knapper står ALTID øverst (user rule 2026-10-10)**: handlingsknapper (Send, Gem, Tilføj, Indsend osv.) placeres øverst i formularen/siden, aldrig nederst under indholdet, så de aldrig skjules af menuen/bundcirklen eller kræver scroll. Gælder web og native.
- Ikonerne i bundcirklen (FooterArc/tilføj-hjulet) er altid ensartede sorte stregikoner — aldrig farvede 3D-billeder (bruger 2026-10-10; Aktivitet bruger `IconActivity`). Gælder web og native.
- Faste bundknapper (Tilføj/Gem i `HfScreen`-footeren) skal ligge over bundcirklen (FooterArc, 40 px over menuen), aldrig bag den (bruger 2026-10-09).

- Ingen ikke-bestilte tekster: ingen disclaimers, forklaringer eller
  "erstatter ikke læge"-noter på sider, medmindre brugeren har bedt om dem
  (brugerens regel 2026-10-09; Hello Doc-disclaimeren er fjernet).
- Hello Doc har burger-menu øverst til højre, hvor modtageren sammensætter
  dashboardet (vis/skjul + rækkefølge pr. panel, gemt på enheden).

## Sikkerhed

- Streng sikkerhed (vault) kun for admin; almindelige brugere får normalt login
  (email/adgangskode, Face ID, Google/Apple/Facebook).

## Eksterne nøgler og integrationer (user rule 2026-10-10)

- Hvert eksternt input i admin (API-nøgler, integrationer, SMTP, SMS, betaling,
  push, systemværdier) viser "Styres her" med det præcise link til siden, hvor
  værdien findes og styres hos udbyderen — aldrig kun forsiden. Linket står i
  `src/lib/api-keys/catalog.ts` som `manage` (påkrævet felt, så en ny nøgle
  ikke kan tilføjes uden). Egne API'er kræver et https-link ved oprettelse.
- Interne henvisninger til en nøgle går til tjenestens anker
  (`/admin/api-keys#<id>`), ikke kun til API-nøgle-siden.
- Webhooks, som en udbyders server kalder, skal stå i `TOKEN_API_PREFIXES`
  i `src/lib/access-wall.ts`; ellers afviser adgangsmuren dem som bots (403).

## Proces

- Spørgsmål til brugeren stilles ALTID i spørgsmålsboksen (AskUserQuestion),
  aldrig som almindelig tekst i et svar og aldrig midt i en opgave: tekst giver
  ingen gul prik, så brugeren ser den ikke (brugerens regel 2026-10-09, global).
- **Aldrig hænge (bruger 2026-10-10, global, ufravigelig):** en opgave må aldrig stå stille. Slut aldrig en tur, mens CI, deploy, review eller en PR venter, uden at et tidsbestemt tjek er sat (`send_later`, højst 5 minutter frem; gentag, til det er gjort). Hvert tjek handler: grøn CI → flet nu; rød CI → ret og push nu; konflikt → løs nu; stående deploy-trin → læs jobloggen og meld den præcise årsag. Opgaven er først færdig, når den er flettet OG deployet. Må deployet ikke kunne gå igennem, skrives årsagen og næste skridt straks i `docs/handoffs/OPEN-TASKS.md`. (Ingen mellemstatus til brugeren, se næste punkt.) At vente passivt på en hændelse er forbudt.
- **Udestående rettes altid (bruger 2026-10-10, generelt):** finder du noget udestående i det område, du arbejder i (manglende oversættelser, forældede noter i OPEN-TASKS, halvfærdige dele af samme funktion), så ret det i samme opgave i stedet for blot at notere det. Gælder ikke andre gruppers filer eller ting, der kræver brugerens beslutning.
- **Brugeren er ligeglad med mellemstatus (bruger 2026-10-10, global):** meld ikke automatiske hændelser (PR-abonnement, ventende CI, planlagte tjek, "tests kører stadig") til brugeren. Gør arbejdet færdigt i stilhed, og skriv kun, når der er et resultat, en blokering eller et spørgsmål (i spørgsmålsboksen). Afløser kravet om at melde status hvert 10. minut under "Aldrig hænge". Brugeren gider ikke høre om, hvordan det gøres — det skal bare komme til at virke: løs problemet helt (også følgefejl og deploy), og meld kort, at det virker.
- **Tidspunkter altid i dansk tid** (Europe/Copenhagen, sommer-/vintertid) over for brugeren, aldrig UTC (bruger 2026-10-10).
- Flere parallelle sessioner: stage snævert, deploy-linjen er origin/master.
- Alle opgaver auto-arkiveres umiddelbart, så snart de melder klar til arkivering – i samme tur, uden at vente (bruger 2026-10-09, gentaget).
- Færdig opgave: slut med "arkiver mig", og arkivér derefter selv sessionen (`archive_session`), når PR er flettet. Manglende test er aldrig en gyldig grund til ikke at arkivere (global regel, bruger 2026-10-09). Stop-hook `scripts/archive-reminder.mjs` minder om det (bruger 2026-10-09; AGENTS.md).
- Commit, push, flet PR og alt andet der skal til for at færdiggøre en opgave sker uden at spørge først (bruger 2026-10-09; AGENTS.md).
- Kan en ændring pushes sammen med en anden opgaves push/PR, så undlad egen push/PR og arkivér blot (bruger 2026-10-09; AGENTS.md).
- Efter rebase der rører `prisma/schema.prisma`: kør `prisma validate` + typecheck.

## Crawlere og billeder

- Kun forsiden + login/juridiske sider er åbne for anonyme; alt andet kræver
  login (`src/lib/access-wall.ts`). Nye offentlige ruter skal tilføjes dér.
- Nye billedmapper med produkt-/opskrifts-/mærkebilleder skal i
  `PROTECTED_IMAGE_PREFIXES`.
- Aldrig vandmærke eller skjult bruger-ID i billeder (brugerens regel 2026-10-08).

- **Menstruation (bruger 2026-10-09):** alt om menstruation/cyklus vises slet ikke for mænd — heller ikke som deaktiveret række eller med "(kun for kvinder)". Vises kun når `sex = FEMALE`. Gælder web og native (fx Hello Doc "Rediger adgang").
- **Frida** (DTU-fødevaredatabasen): opbygning, nøgler og rå/kogt-fund står i `docs/FRIDA.md`.
- **Frida-skøn ∼ (bruger 2026-10-10)**: varer uden energimærkning får Fridas tal i de felter, butikken ikke selv har udfyldt, når produkttypen passer mindst 90 % (ental/flertal og stavemåder udlignes); tvivl afgøres af admin (Usikkerheder → Frida-match). Retter får kun et skøn, hvis ALLE ingredienslinjer kan regnes med. Varer vises og kan scannes uanset om de har næring. Kildeangivelsen "∼ Kilde: Fødevaredata (frida.fooddata.dk), DTU Fødevareinstituttet, Danmarks Tekniske Universitet" står KUN helt nederst i det udfoldede næringsfelt på varesiden, når en værdi kommer fra Frida — ingen andre steder. Se DECISIONS.md 2026-10-10.
- Næringsindhold (produktsiden): mangler en værdi, vises "–" (en streg) i stedet for rækken udeladt — blokken vises dog kun, når mindst én værdi findes (brugerens regel 2026-10-09).


- Opret ret → Indsæt tekst: kun tekstfeltet og "Indsæt" — ingen ekstra felter (fx kilde-link). Antal personer bruger den eksisterende PersonsSlider, ikke et nyt talfelt (brugerens krav 2026-10-09).
- **cl = færdig drikkevare (bruger 2026-10-10)**: står varens mængde i cl, vises og vælges den altid i cl — aldrig gram — uanset kategori (`src/lib/product-display-unit.ts`).
- **Omregning væsker → gram (bruger 2026-10-10)**: én tabel, `src/data/kitchen-conversions.json` (bygges af `scripts/kitchen-conversions-build.py`), bruges overalt: Viden om mad → Omregning, Mål/Gram-skift på retter og dl→gram i Opret ret. Nye væsker tilføjes dér. 1 spsk = 15 ml, 1 tsk = 5 ml. Gram-omregningen i mængdeboksen (småt i hjørnet + op/ned-ikon, tryk bytter) vises KUN for væsker og KUN når varen tilføjes fra Opret ret.
- **Startmængde** (`src/lib/default-amount.ts`, brugerens regel 2026-10-09): forslaget må aldrig overstige pakkens indhold (g/ml fra pakningsstørrelsen). Al instantkaffe (instant, Nescafé, pulverkaffe …) starter på 2 g (pr. kop).

- Admin-lister: til/fra-knappen (Toggle) står ALTID yderst til højre, aldrig tick-bokse, og "Rediger" står til venstre for knapperne. Event-koder (fx SUPPORT_RECEIVED) vises aldrig for admin — kun danske navne, grupperet med overskrifter og filtre (Besked automatisering, 2026-10-09).
- **Søgning viser alt og retter sig selv (2026-10-10)**: ingen varer skjules for manglende kalorietal; accenter ignoreres; 0 hits → "Viser resultater for X · Søg i stedet efter Y", 1-2 hits → "Mente du X?". Se DECISIONS 2026-10-10.
- **Søgning læser alle varens tekstfelter (2026-10-10)**: navn, flertalsnavn, mærke, serie, varetype, variant, smag og søgeord; sammensatte ord matcher i ét eller flere ord ("instantkaffe" = "instant kaffe"). Se DECISIONS 2026-10-10.
- **Søgeregel (global, 2026-10-09)**: søger brugeren i flertal, vises Product title plural (`namePlural`); i ental vises Product title singular (`name`). Se docs/FRIDA.md.
- Bilka/REMA ental/flertal + DB-kolonnenavne: se Excelark/NAVNEREGLER.md (status 2026-10-09: _ny-ark lavet, ikke gennemgået).
- **"ben" hører til produkttypen** (alle ark, brugerens regel 2026-10-10): står "ben" alene i Variation, er det del af produkttypeordet og skrives sammen med det: "Skiver af okse" + "ben" → "Skiver af okseben". Står der "med ben", følger "med ben" med ind i produkttypen ("Ibérico kotelet med ben", som "Koteletter af gris uden ben"). Variation ryddes; `Product type plural` rettes tilsvarende. Se Excelark/NAVNEREGLER.md.
- **Ost: "revet" og "i blok"** (alle ark, brugerens regel 2026-10-10): al revet ost får keyword `revet` (ordet fjernes fra typen: "Revet mozzarella" → "Mozzarella (Revet)"). Al fast ost og "i stykke" (også "i blok") får keyword `i blok` ("Modnet fast ost 45+ (I blok)"); ikke ost i skiver/tern/revet og ikke "halvfast". Se Excelark/NAVNEREGLER.md.
- **Børn i familien (bruger 2026-10-09):** et barn kan hverken lukke kontoen, slette sine data eller melde sig ud — kun forælderen (betaleren). Barnet kan ikke fravælge at vise detaljer; det kan kun se, hvad forælderen viser. Gælder web og native. Se DECISIONS.md samme dato.

## Valgte knapper (user rule 2026-10-09)

Valgte knapper/faner/chips/planvalg har ALTID den lysegrønne farve (`--hf-color-accent`, #BBF06A) med sort kant og tekst — brug `.hf-selected` / `.hf-choice` / `.hf-chip`, aldrig sort, mørkegrøn eller beige som valgt-flade. Eneste undtagelse: kalenderens dags dato (`.hf-cal-current`). Native bruger `HcColors.SelectedBg`.
- **Flows er helsides popups (bruger 2026-10-09):** alle flows overalt (fx Opret ret: Indsæt tekst / Scan opskrift / Opret manuelt, hvor man tilføjer én ingrediens ad gangen) åbner som en helsides popup (`BottomSheet size="full"`), ikke som en almindelig side.

## Trinindikator (HfProgressStepper)

- Flows med mange trin (fx "Opret ny screening") viser kun teksten under det aktive trin (`activeLabelOnly`), og prikkerne i bjælken er tryk-bare (`onSelect`): tilbage altid, frem kun når de forudgående trin er udfyldt (`isStepEnabled`). Web og native (`ProfileProgressStepper`). 2026-10-10.

- Opskrifter → fanen "Delte retter": kildeknapperne under søgefeltet er "Vis alle", Valdemarsro og Hello Fresh. Ingen separat "Delte retter"-knap (den gentog fanen) (2026-10-10).
- Opskrifter → filter → Antal personer: standard 0 = ikke valgt, vist lysegråt/underordnet; ingen person er valgt som default. Receptsiden bruger mindst 1 (brugerens krav 2026-10-10).
