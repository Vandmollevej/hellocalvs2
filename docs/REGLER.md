# REGLER — globale regler for hvordan systemet opfører sig

Ét opslagssted. Hver regel: kort tekst + hvor detaljerne står. Når en ny regel
besluttes: tilføj den HER først (og i DECISIONS.md hvis den er arkitektonisk).
Søg aldrig i STATUS.md/DECISIONS.md/gamle sessioner efter en regel — står den
ikke her, er den ikke registreret og skal tilføjes.

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
