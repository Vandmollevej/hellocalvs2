# REGLER — globale regler for hvordan systemet opfører sig

Ét opslagssted. Hver regel: kort tekst + hvor detaljerne står. Når en ny regel
besluttes: tilføj den HER først (og i DECISIONS.md hvis den er arkitektonisk).
Søg aldrig i STATUS.md/DECISIONS.md/gamle sessioner efter en regel — står den
ikke her, er den ikke registreret og skal tilføjes.

## Screeninger

- Profil → Screeninger er stedet for egne målinger (migræne, mavesmerter, humør, selvoprettede). Søvn er en fast række. "Opret ny screening" er et flow, ikke en enkelt formular. Se DECISIONS.md 2026-10-09.
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

## UI

- **ALDRIG grå tekst på grøn baggrund (user rule 2026-10-09)**: tekst på grøn flade (`bg-hf-brand`, grønne knapper/kort) er altid hvid (`text-hf-white`). Kombinér aldrig `text-text-secondary` eller andre grå farver med hvid på grøn — den grå vinder og gør teksten ulæselig. Gælder web og native.

- Sideoverskrifter er altid `hf-type-page-title` (22 px); `hf-type-hero` (32 px) er kun til tal/produktnavn i hero-kort, aldrig til en sides overskrift (bruger 2026-10-09).
- "Overlay"/"popup" = den træk-bare BottomSheet (`.hf-bottom-sheet`), se KRAV.md.
- Aktiviteten `open_water` hedder "Svømning i åbent vand" — aldrig "Havsvømning" (bruger 2026-10-09). "havsvømning" er kun et søgeord.
- Visuelle ændringer: læs design.md; størrelse/vægt ændres i moderate trin.
- Faste bundknapper (Tilføj/Gem i `HfScreen`-footeren) skal ligge over bundcirklen (FooterArc, 40 px over menuen), aldrig bag den (bruger 2026-10-09).

- Ingen ikke-bestilte tekster: ingen disclaimers, forklaringer eller
  "erstatter ikke læge"-noter på sider, medmindre brugeren har bedt om dem
  (brugerens regel 2026-10-09; Hello Doc-disclaimeren er fjernet).
- Hello Doc har burger-menu øverst til højre, hvor modtageren sammensætter
  dashboardet (vis/skjul + rækkefølge pr. panel, gemt på enheden).

## Sikkerhed

- Streng sikkerhed (vault) kun for admin; almindelige brugere får normalt login
  (email/adgangskode, Face ID, Google/Apple/Facebook).

## Proces

- Spørgsmål til brugeren stilles ALTID i spørgsmålsboksen (AskUserQuestion),
  aldrig som almindelig tekst i et svar og aldrig midt i en opgave: tekst giver
  ingen gul prik, så brugeren ser den ikke (brugerens regel 2026-10-09, global).
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

- Opret ret → Indsæt tekst: kun tekstfeltet og "Indsæt" — ingen ekstra felter (fx kilde-link). Antal personer bruger den eksisterende PersonsSlider, ikke et nyt talfelt (brugerens krav 2026-10-09).
- **Startmængde** (`src/lib/default-amount.ts`, brugerens regel 2026-10-09): forslaget må aldrig overstige pakkens indhold (g/ml fra pakningsstørrelsen). Al instantkaffe (instant, Nescafé, pulverkaffe …) starter på 2 g (pr. kop).

- Admin-lister: til/fra-knappen (Toggle) står ALTID yderst til højre, aldrig tick-bokse, og "Rediger" står til venstre for knapperne. Event-koder (fx SUPPORT_RECEIVED) vises aldrig for admin — kun danske navne, grupperet med overskrifter og filtre (Besked automatisering, 2026-10-09).
- **Søgeregel (global, 2026-10-09)**: søger brugeren i flertal, vises Product title plural (`namePlural`); i ental vises Product title singular (`name`). Se docs/FRIDA.md.
- Bilka/REMA ental/flertal + DB-kolonnenavne: se Excelark/NAVNEREGLER.md (status 2026-10-09: _ny-ark lavet, ikke gennemgået).
- **Børn i familien (bruger 2026-10-09):** et barn kan hverken lukke kontoen, slette sine data eller melde sig ud — kun forælderen (betaleren). Barnet kan ikke fravælge at vise detaljer; det kan kun se, hvad forælderen viser. Gælder web og native. Se DECISIONS.md samme dato.

## Valgte knapper (user rule 2026-10-09)

Valgte knapper/faner/chips/planvalg har ALTID den lysegrønne farve (`--hf-color-accent`, #BBF06A) med sort kant og tekst — brug `.hf-selected` / `.hf-choice` / `.hf-chip`, aldrig sort, mørkegrøn eller beige som valgt-flade. Eneste undtagelse: kalenderens dags dato (`.hf-cal-current`). Native bruger `HcColors.SelectedBg`.
