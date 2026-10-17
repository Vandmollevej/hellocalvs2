# REGLER — globale regler for hvordan systemet opfører sig

Ét opslagssted. Hver regel: kort tekst + hvor detaljerne står. Når en ny regel
besluttes: tilføj den HER først (og i DECISIONS.md hvis den er arkitektonisk).
Søg aldrig i STATUS.md/DECISIONS.md/gamle sessioner efter en regel — står den
ikke her, er den ikke registreret og skal tilføjes.

## Screeninger

- Profil → Screeninger er stedet for egne målinger (migræne, mavesmerter, humør, selvoprettede). Søvn er en fast række (også øverst i Screeningrapporter, peger på /statistics/sleep). "Opret ny screening" er et flow, ikke en enkelt formular. Se DECISIONS.md 2026-10-09.
- Valget "Screening" ligger nederst i Tilføj-menuen og kan vælges som bundmenu-ikon.
- Listen er `AccordionCard` med `ScreeningRow` (`src/components/screenings/ScreeningRow.tsx`; native `ScreeningListRow`): præcis som madvarelistens rækker — px-4-ramme med tan-dark streg, den globale `FoodRow` (64 px, 44 px ikonfelt med måne/clipboard-heart, navn, status-prik + "Aktiv/Inaktiv" som caption) og pil til højre (user rule 2026-10-17: "1:1 med madvare-blokkene", særligt højden). Afløser 48 px-`ChevronRow` herfra.

## Varens sprog og oversættelse (user rule 2026-10-15)

- **Kolonnerne er originalen.** En vares tekst står på dens originalsprog (`products.language`, ISO 639-1) og overskrives **aldrig** af en oversættelse. Dansk er ikke facit — det er ét af sprogene.
- **Sproget bestemmes af kilden, aldrig af ordene:** danske ark/butikker/Frida/HelloFresh.dk = `da` (franske ostenavne og "cheese" røres ikke), Open Food Facts = OFF's `lang`, scannede varer = scanningslandet, ellers stregkodens land. **Undtagelse:** ikke-latinske tegn (kinesisk, kyrillisk …) giver skriftens sprog — også på en DK-vare. Ukendt sprog = `""` og oversættes ikke. Regler: `src/lib/product-language.ts`.
- **Oversættelser** ligger i `product_translations` (én række pr. vare og app-sprog), laves første gang en bruger med sproget ser varen og laves forfra, når varens tekst ændres (`sourceHash`). Brand/subbrand oversættes aldrig, kun translittereres ved ikke-latinske tegn; brandet omdøbes aldrig. `src/lib/product-translations.ts`.
- **Visning → Oversættelse** (`User.translateForeignText`, slået til som standard): over en oversat vares navn står med lille grå tekst "Oversat til dansk fra kinesisk." + understreget "Vis original"/"Vis oversættelse"; linjen flytter hverken overskrift eller billede. Fra = originalsproget uden linjen. Er det kun ingredienslisten, oversættelsen ændrer (titel, variant, mængde m.m. er ens), står linjen i stedet over ingredienslisten; ændrer oversættelsen intet, vises ingen linje (bruger 2026-10-15). `translationPlacement` i `src/lib/product-text-swap.ts`.
- **Importerede kilder oversættes ikke endnu** (bruger 2026-10-15: "Vent med oversættelse af produktark, frida mv."): ark, Frida, butiksimporter, HelloFresh og opskriftssider — og varer uden kilde og uden opretter (ark/admin-import). Kun brugerscannede varer og Open Food Facts/USDA oversættes. Slås til med `TRANSLATE_IMPORTED_SOURCES` i `src/lib/product-language.ts`. Generiske varer (Frida) venter også.
- **Open Food Facts** gemmes på originalsproget (`language` = OFF's `lang`, `da` når OFF har en dansk titel); der skrives aldrig længere en dansk oversættelse i kolonnerne (bruger 2026-10-15, valg A). Ældre OFF-varer med `nameOriginal` røres ikke.
- **Lister** (dagbog, favoritter, mest brugte): `localizedProductNames` — kun gemte oversættelser, manglende laves i baggrunden; dagbogens titel skiftes kun i svaret, når `titleSnapshot` stadig er varens originalnavn (snapshottet i databasen røres aldrig).
- **Gælder også alt, der bygges fremover:** en ny skærm, liste eller API, der viser varetekst, skal bruge `translationFor` (enkelt vare) eller `localizedProductNames` (lister). Står også i AGENTS.md.
- **Søgning** (bruger 2026-10-15): forslagene viser kun varer på brugerens sprog, engelske varer, varer med ukendt sprog og varer med stregkode fra brugerens land. Varer på andre sprog vises kun, når intet af det giver et resultat (så søger brugeren bevidst på et andet sprog). Søgningen oversætter aldrig. `inViewerLanguage` i `src/lib/product-language.ts`, brugt i `GET /api/products`.
- **Natlig oversættelse** (jobbet `product-translations`, kl. 03:15): oversætter op til 200 varer pr. nat til de app-sprog, brugerne har valgt, så ingen venter. Samme kilderegel som ovenfor.
- **Sprogrobot** (`language-local` i quality-control-agent, kl. 02:50, lingua, lokalt): tjekker hver scannet vare og Open Food Facts/USDA-vare én gang (`languageCheckedAt`) og retter sproget, når den er sikker (tekst ≥ 25 tegn, sikkerhed ≥ 0,85). Ark/Frida/butikker, ikke-latinske tegn og dansk/norsk/svensk indbyrdes røres aldrig.

## HelloFresh fra alle lande (user rule 2026-10-15)

- Importen (`scripts/hellofresh-import`, `markets.py`) henter fra alle 17 HelloFresh-lande. Hver ret har sit land (`products.market`) og sprog (`products.language`). Danmark beholder de gamle id'er (`hf_<id>`); andre lande `hf_<land>_<id>`, externalId `<LAND>:<id>`, ingredienser én række pr. land.
- Brugeren ser kun sit eget lands retter (opskriftslisten, billedgenkendelse); andre landes kun, når en søgning ellers intet finder. HelloFresh-retter oversættes ikke endnu (importerede kilder venter).
- Næringen læses med hvert lands egne navne; kan en ret ikke læses sikkert, springes den over. Et land, hvis sitemap ikke kan hentes, springes over uden at ændre noget.

## Varer og navngivning

- **Alkohol** (user rule 2026-10-15): alkoholprocenten (% vol) læses altid og gemmes på varen. En alkoholisk drik uden næringstabel står aldrig med 0 kcal: alkoholens energi regnes præcist (7 kcal/g), resten skønnes ud fra varetypen (`src/lib/alcohol-nutrition.ts`).
- **Aldrig "Vare <stregkode>"** (user rule 2026-10-15): "Vare" + nummer vises aldrig, heller ikke under oprettelsen. Står varetypen ikke på forsiden, navngives den ud fra brand og synlig tekst (Verpoorten Original → Eierlikör); giver det intet, spørges OpenAI "Hvilken produkttype er <brand subbrand variant>?" (`askProductType`, også for scannede varer, der allerede hedder brand + subbrand — én gang pr. vare, `productTypeAskedAt`); kan den stadig ikke afgøres, hedder varen brand + subbrand (`brandProductName`). Varianten (fx Jalapeño, Original) er aldrig navnet. Værn: varesidens API viser brand + subbrand, hvis reservenavnet stadig står i databasen (`displayProductName`), og `repairPlaceholderNames` kører hvert kvarter — også på varer, hvis navn har hængt som ventende i over 30 min.
- **En ny scannet vare står aldrig tom (user rule 2026-10-16)**: et fejlet OpenAI-kald må aldrig efterlade en ny vare uden navn eller brand. (1) Hvert AI-kald har tidsgrænse (90 s), prøves igen ved midlertidige fejl (429/5xx/netværk) — men ikke ved manglende kredit (`insufficient_quota`) — og skifter til reservemodellen `gpt-4o`, hvis modellen afvises (`src/lib/product-ai.ts`). (2) Fejler forsiden, navngives varen ud fra telefonens tekstlæsning af forsiden (`frontOcrText`): kendt brand i teksten + et varenavn, der findes på mindst to varer i databasen (LETMÆLK → Letmælk), ellers "Hvilken produkttype er <brand>?" (`src/lib/front-text-name.ts`). (3) Fejlede dele prøves igen af `quick-enrichment-recovery` efter 10 min (højst 3 forsøg); giver forsiden aldrig svar, fritlægges hele forsidefotoet. (4) **Energien skønnes ALDRIG for scannede varer** (bruger 2026-10-16: "Skønner energien? Dette er ikke ok") — hverken Frida eller varetype; energi-trinnet sikrer aflæsningen (se Scan-reglerne). Mangler den alligevel, står "Næringsindhold ukendt", aldrig "∼ 0 kalorier".
- **Key-format**: `Brand Produktnavn (Mængde)`. Mængden står præcis én gang;
  brand og mængde fjernes først fra den rå titel.
- **Generiske varer (uden brandnavn/EAN)**: 100 % uden brandnavn (grøntsager,
  frugt, kød m.m.) er råvarer / generiske ingredienser (`GenericIngredient`,
  altid `INGREDIENT`, enhed g) og scannes ikke. Kilde: session
  "HelloCal OpenAI produktgenkendelse", 2026-09-18; se også DECISIONS.md
  (Frida-match, mikrodata kopieres fra Frida).
- **Generiske produkter i admin** (2026-10-15): oprettes/importeres under Admin → Varer → Generiske produkter med arkets kolonner. Kilde er påkrævet (Frida FoodID eller anden kilde med URL); næring kun fra Frida, ellers tomt. Titel (ental) skal være unik. Bruges et produkt i registreringer, skjules det i stedet for at blive slettet.
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
- **Open Food Facts** (2026-10-11): OFF-varer gemmes lokalt i `off_products` med rå svar + navnet opdelt efter reglerne her (`src/lib/off-name-split.ts`), med en sikkerhed i %. Samme navneregler som arkene; ordforrådet bygges af arkene (`scripts/off-import/build_vocab.py`). Rettes en navneregel, skal opdeleren følge med (og kalibreringen køres igen). Se DECISIONS 2026-10-11.
- **Generiske produkter = hverdagsnavne, Frida kun som reference** (brugerens
  regel 2026-10-15): arket `Produkter/Generiske produkter.xlsx` bruger de navne,
  danske butikker bruger (Brie, ikke Brie-ost; Sukker, ikke Stødt melis; Chili,
  ikke Peber chili), og kategorier med hverdagsnavne (Skæreost og hård ost, ikke
  Fast løbeost). Fridas navn og FoodID står kun som reference-kolonner. Kolonnen
  `Kilde` siger, hvor næringsdata kommer fra; varer uden Frida-data (fx fra
  HelloFresh) markeres "Ingen Frida-data" — næringstal gættes aldrig. Forskelle
  der forsvinder ved omdøbning (gul/brun sennep, burhøns/frilandsæg) flyttes til
  Variation. Gennemgangen ligger i `Produkter/Generiske produkter - gennemgang.xlsx`.
- **Næringsdata kun fra sporbar kilde** (brugerens regel 2026-10-15): Frida eller
  egne produktdata, med kilde pr. tal. Ingen egne skøn; intet match = tomt.
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
- **Certifikatlogoer er hele mærker (bruger 2026-10-15)**: filerne i
  `public/certifications` viser hele mærket uden beskæring og uden luft om
  (beskåret til mærkets egen kant), så de står på linje med cirklens bund og
  holder badge-højden (30 px). Ø-mærket er Open Food Facts' komplette SVG
  (`danish-state-controlled-organic`), renderet transparent.
- **API-logoer (bruger 2026-10-11)**: hver tjeneste under admin → API-nøgler har
  et transparent, kvadratisk (1:1, 512×512) bomærke i `public/api-logos/<tjeneste-id>.png`
  — aldrig et bogstav i en cirkel. Ny tjeneste i `src/lib/api-keys/catalog.ts`
  = nyt logo med samme id. Det samme gælder integrationskortene i
  `src/lib/integrations.ts` (`public/integrations/<slug>.png`, `icon: null` bruges
  ikke længere). Kilder: simple-icons (CC0), Wikimedia Commons,
  udbyderens egen favicon/app-ikon (App Store 1024 px), mærket frigjort fra
  flisen. Se DECISIONS.md 2026-10-11.
- **Brand og subbrand ved produktcirklen (bruger 2026-10-10, ændret 2026-10-17)**:
  brandet står til højre for cirklen, subbrandet oven over det — **kun som logo**.
  Har brandet/subbrandet intet logo, vises intet (bruger 2026-10-17: Coca-Cola stod
  som "Coca-Cola Europacific Partners Services Bulgaria EOOD", fordi Open Food
  Facts' brand-felt indeholdt producentens firmanavn, og navnet blev vist som tekst).
  Brands uden logo findes i admin → Produkt-database → Brands → "Uden logo", hvor
  hvert brand linker til alle dets varer, så logoet kan lægges ind. Ingen
  hardcodede navnelister til at rette brandnavne. Subbrand-logofiler hedder
  `<brand> <subbrand>.png` eller `<subbrand>.png` og lægges ind som brand-logoer
  (admin-upload eller `_import`). Se DECISIONS.md 2026-10-17.
- **Uden produktbillede: stort logo i cirklen (bruger 2026-10-14)**: har varen
  hverken billede eller et billede på vej, står subbrandets logo stort midt i
  cirklen (brandet står, hvor det plejer), ellers brandets logo. Logoet rager
  kun ud over cirklen i højden eller bredden (højst 120 %) og beskæres aldrig.
  Se DECISIONS.md 2026-10-14.
- **Dublet-billeder: kun "Behold" og "Erstat med dette" (bruger 2026-10-11)**:
  billedet der vises i dag står ved siden af ét alternativ; begge knapper
  sletter de øvrige varianter. Øvrige alternativer vises som miniaturer under
  (klik = byt ind). Ingen stregkode over billederne. Klik på et billede åbner
  samme visning i en lightbox (bladr i hele sidekolonnen, tal i bunden).
- **"Anbefalet" billede (bruger 2026-10-11)**: er et alternativ tydeligt bedre
  end billedet i dag (mindst 25 % flere pixels, eller samme opløsning og PNG
  frem for JPG, eller mærkbart højere mætning), får det en tynd lysegrøn ramme
  og "Anbefalet" i mørkegrøn øverst til højre — og det er altid det alternativ,
  der vises ved siden af originalen, også selvom det er _3 eller _4.
  Regel i `src/lib/image-quality.ts`.
- **Vis aldrig originalen i en liste eller cirkel (2026-10-15)**: egne billeder
  (`/product-images/…`, `/brand-logos/…`, `/hellofresh-images/…`) vises via
  `imageThumb(url, bredde)` (`src/lib/image-thumb.ts`) — en nedskaleret WebP fra
  `/_next/image`. Bredde ≈ 3 × visningsstørrelsen (44 px række → 128, cirklen →
  640). Native: `FoodImage(..., thumbWidth = …)` / `Api.thumbUrl`. Originalen kun,
  hvor admin skal bedømme selve billedet (sammenligning, fritlægning, dubletter).

## Søgning

- **Flyt aldrig en funktion med ændret opførsel (bruger 2026-10-16)**: når en side
  flettes ind i en anden, skal funktionen virke præcis som før. Er noget uklart,
  så spørg i spørgsmålsboksen — gæt aldrig. Tale på Madvarer = Tale-sidens
  AI-tolkning af hele sætninger, uændret (DECISIONS 2026-10-16).
- **Talte sætninger søges som varen (2026-10-16)**: "Jeg har spist en bakke
  pomfritter" søges som "pomfritter" — indledning, mængde/enhed og tidsangivelse
  skrælles af i `/api/products` (`src/lib/spoken-food-query.ts`) på alle
  mikrofonens sprog. Nye talte vendinger tilføjes dér, med test.
- **Danske kædemærker kendes altid (bruger 2026-10-15)**: ØGO, Salling, Coop 365,
  Änglamark, REMA 1000, First Price, Lidl-mærker m.fl. står i `PINNED_BRANDS`
  (`src/lib/known-brands.ts`) og er altid med i AI'ens brandliste ved scanning.
  Mangler et kædemærke, så tilføj det dér.
- **AI'en må ikke opfinde brands (bruger 2026-10-15)**: et brandnavn, som
  Brand-tabellen ikke kender, oprettes kun ud fra et sikkert (logoConfidence
  ≥ 0,85) og helt synligt logo — ikke afskåret ved billedkanten
  (`newBrandAllowed` i `src/lib/brand-match.ts`). Ellers får varen intet brand,
  og loggen viser `brand_unknown_skipped`. Gælder al ny brandoprettelse fra AI.
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
- **Brand og subbrand først i søgeresultatets tekst (bruger 2026-10-10)**: hvert
  søgeresultat (Madvarer, Søg, Opret ret; web og native) viser
  `Brand Subbrand Varenavn` — brand og subbrand er det vigtigste og står altid
  forrest. Står de allerede i varenavnet, flyttes de frem uden gentagelse, og
  brandet står ikke igen i undertitlen. Feltet `searchTitle` fra
  `GET /api/products` (`src/lib/search-result-title.ts`). Søgningen matcher
  stadig i alle tekstfelter, ikke kun titlen.
- **Madvarer (bruger 2026-10-16)**: favoritter står øverst i listen før de mest
  brugte; lydbølgen under mikrofonen må ikke fjernes; søgefeltet vokser i højden
  med teksten; kameraet i søgefeltets venstre side åbner billedfunktionen (ingen
  "Scan nyt produkt"-knap nederst). Web og native.

## UI

- **Én swipe-række overalt (user rule 2026-10-17)**: alle rækker, der kan swipes, bruger `SwipeableRow` (`src/components/SwipeableRow.tsx`; native `FoodSwipeableRow`/`CaptureSwipeableRow`) og ligger i samme tan-kort som "Dagens tilføjelser" på forsiden: `overflow-hidden rounded-card bg-hf-tan`, tan-dark streg mellem rækkerne, rækken selv har `px-4`, så knapperne går helt ud til kortets kant. Alle knapper er ens: ikon over tekst, hvid på farve, 80 px (Favorit grøn, Kopier watch, Fejl/Aktivér grå, Fjern rød med skraldespand). Egne knapper gives som `rightActions`/`leftActions` — byg aldrig en ny swipe-komponent. Knapperne bag en lukket række er skjulte, så de ikke skinner igennem kortets runde hjørner. Lister med registreringer (vand, kalenderens indtastninger, tale, chat) kan swipes væk.
- **Swipe-knapperne og forsidens række gælder alle lister (user rule 2026-10-17)**: alle steder, hvor varer listes eller tilføjelser vises (forsiden, Søg, Madvarer, Favoritter, Dine indscanninger, tale, chat, kalenderen), ser rækken ud som "Dagens tilføjelser": billede, evt. "Kl. 18.45" over navnet, navn, "kcal / 100 g" og pil til højre (web `ProductResultRow`/`FoodRow`; native `FoodProductResultRow`). Favorit fås **kun** ved swipe til højre — ingen hjerte-/bogmærkeknapper i lister. Swipe til venstre giver Fejl (vare: `/product/[id]/report-error`, registrering: `/registration/[id]/report-error`) og Slet, hvor listen kan slette (Favoritter: fjerner favoritten; Indscanninger: skjuler varen, til den scannes igen). Er det ikke en vare (vand, vejning, måling, AI-skøn uden vare), er der hverken Favorit eller Fejl — kun Slet.
- **Lister med pil bruger den globale række (user rule 2026-10-16: "tilpas det globale design i stedet for at hardcode")**: en liste af rækker med pil til højre er altid `AccordionCard` + `ChevronRow` (`src/components/hf/AccordionCard.tsx`; native `HcAccordionCard` + `HcChevronRow`) — 48 px, 16 px gutter, tan-dark linje, ingen gap mellem rækker. Status til højre før pilen = `value`. Byg aldrig rækken selv med `flex px-4 py-3 border-b …`. Swipe-flader bag rækken har kortets farve (`bg-hf-tan`).
- **`ActionButton`/`ActionLink` er altid mindst 48 px høje** (`.hf-btn--large` indbygget) — aldrig sammenklemte knapper.
- **"Har du fundet en fejl?" på alle varer (user rule 2026-10-15)**: knappen nederst på varesiden vises altid — også på generiske varer, varer uden stregkode og varer, brugeren selv har oprettet. Skjul den aldrig ud fra stregkode eller ejer. Rapporten knyttes til `productId` eller `genericIngredientId` (`src/app/api/bug-reports/route.ts`). Web (`AddProductView.tsx`) og native (`AddProductScreen.kt`).
- **Identiske elementstyles bruger samme klasse (Peter, 2026-10-12):** genbrug eksisterende klasser før nye oprettes. Mobil og desktop-online er bevidst forskelligt bygget op; deres menuer, geometri og sideopbygning bevares. Marketing bruger egne mk-type-* roller. Ingen faste font/radius/skygge i inline-style uden dokumenteret preview-undtagelse. Se design.md §13 og DECISIONS 2026-10-12.

- **Opdater-banneret øverst på varesiden (user rule 2026-10-15, gentaget flere gange)**: den lukkede stribe (`UpdatePointsBanner`) indeholder KUN teksten — aldrig en fotoknap. På Open Food Facts-varer står der "Optjen X points ved at opdatere med et flot nyt billede" (`productUpdate.bannerPhoto`); på alle andre varer "Optjen X points ved at opdatere varen". Først når striben er trukket ned, kommer fotoboksene — kun for det, der mangler (forside/billede, energi, indhold). "Tag billede af indholdet igen" er indholds-boksen i den nedtrukne del, ikke en knap. Web + native.
- **Kameraet i opdater-banneret (user rule 2026-10-15)**: trækkes banneret ned (eller trykkes på teksten), står hele kamerasøgeren direkte i dropdownen — som Tilføj-kameraet (kvadrat, automatisk udløsning, udløser i billedet). Aldrig en ny side, aldrig den gamle `/camera?retake=…`- eller `/add/[id]/update`-side med "Tag billede"-knap. Er der flere ting, vælges de med knapper under søgeren. Native åbner telefonens eget kamera direkte fra boksen og læser fotoet på stedet. Varesidens favoritikon står aldrig oven på banneret (banneret har z-40). Hjemmesiden (desktop-skallen, ≥ 1024 px) tager ikke billeder, så dér vises opdater-banneret slet ikke — kun i webappen på telefonen og i native. Web `UpdateCameraPanel.tsx` + native `AddProductParts.kt`.
- **Admin-lister over varer og retter (user rule 2026-10-11)**: (1) en række uden billede/næring har tynd rød kant + rød tekst, og listen har en rød linje øverst med tal og filter — en mangelfuld ret må aldrig stå som en almindelig "Godkendt" række; (2) status til højre er teksten (Godkendt …) + en on/off-knap, aldrig en farvet kasse; (3) rækker kan markeres med klik/Ctrl/Shift og behandles under "Handlinger" (Disable, Godkend, Send til gennemsyn, Slet; altid synlig); (4) Slet er blød, de slettede findes under "Slettede" øverst på listen. Gælder også en NY produktliste i admin: brug `BulkSelection`/`BulkRow`/`BulkActionsBar` (og `StatusToggle` + `admin-list-problems.ts` hvor rækken er selve varen/retten); er rækken en sag, send `targets` (række-id → vare-id). Nye kø-lister skal udelade `deletedAt`-rækker. Se DECISIONS.md 2026-10-11.
- **Admin bruger kun fælles klasser (user rule 2026-10-11)**: knapper = `.hf-btn-primary/-brand/-secondary/-danger/-text/-icon` eller `.hf-choice` (+ `.hf-btn--compact .hf-btn--inline`); felter = `.hf-input` (+ `--compact`); hvide kort = `.hf-surface`/`.hf-panel`; mærker = `.hf-badge`; søgefelt = `.hf-search` (ingen understreget "Søg"-knap, Enter søger); Forrige/Næste = `AdminPagination`; side-rod = `.hf-admin-page`. Hjemmelavede kant-/baggrund-/radius-/skrift-klasser på `<button>/<input>/<select>/<textarea>` i admin fejler `npm run lint` (`design-tokens/admin-controls`). Siden må aldrig skifte bredde mellem sider (`scrollbar-gutter: stable` på `.hf-shell`).
- **Kalenderens dagsvisning følger klokken (user rule 2026-10-10)**: når man åbner en dag, scrolles tidslinjen efter tidspunktet på dagen — om morgenen ses natten + morgenen (øverst), midt på dagen morgen + aften (midten), om aftenen aften + nat (bunden af kalenderen). Nattens søvn skal stadig ses om morgenen. Web (`src/app/calendar/page.tsx`) og native (`CalendarDayDetails.kt`).

- **Gravide og ammende (user rule 2026-10-14)**: kaloriebehovet får det officielle EFSA-tillæg (gravid 70/260/500 kcal pr. trimester; ammende 500 kcal de første 26 uger, derefter 300), og der sættes ALDRIG et kalorieunderskud. KUN for kvinder (`sex = FEMALE`, aldrig ukendt køn). Spørges i oprettelsesguiden og rettes under Indstillinger → Visning → Graviditet og amning; ugen/ugerne regnes selv frem fra den gemte dato. Logik kun i `src/lib/pregnancy.ts` (+ `PregnancyRules` i native). Se DECISIONS 2026-10-14.

- **ALDRIG grå tekst på grøn baggrund (user rule 2026-10-09)**: tekst på grøn flade (`bg-hf-brand`, grønne knapper/kort) er altid hvid (`text-hf-white`). Kombinér aldrig `text-text-secondary` eller andre grå farver med hvid på grøn — den grå vinder og gør teksten ulæselig. Gælder web og native.

- Sideoverskrifter er altid `hf-type-page-title` (22 px); `hf-type-hero` (32 px) er kun til tal/produktnavn i hero-kort, aldrig til en sides overskrift (bruger 2026-10-09).
- "Overlay"/"popup" = `BottomSheet` (`.hf-bottom-sheet`), se KRAV.md. På mobil (< 1024 px) er den et træk-bart bundark; **på web (≥ 1024 px) er den en lightbox** — centreret, rummelig, X øverst til højre, ingen trækstreg (bruger 2026-10-11, KRAV.md "Popups på web"). Gælder også popups der ellers kommer ind fra oven eller bunden. Kun web; native uændret.
- Aktiviteten `open_water` hedder "Svømning i åbent vand" — aldrig "Havsvømning" (bruger 2026-10-09). "havsvømning" er kun et søgeord.
- Visuelle ændringer: læs design.md; størrelse/vægt ændres i moderate trin.
- **Overskrifterne "Ingredienser" og "Næringsindhold" på varesiden er fede** (bruger 2026-10-15, efterlyst flere gange). `.hf-heading` står i `globals.css` EFTER typografi-rollerne, så `hf-type-body hf-heading` altid bliver fed — flyt den aldrig op foran rollerne igen (så nulstiller rollens `font-weight: 400` den). Native: `bold = true`.
- **Kolonne-/sektionsoverskrifter i admin** (brugerens regel 2026-10-11): den
  globale overskrift er `.hf-type-section-title` ("──── Tekst ────", design.md
  §4.3) — brug den som `<h2>` over hver kolonne/sektion, aldrig en lille fed
  `hf-type-body hf-type-strong`. Underoverskrifter (Uploads, Findes allerede)
  er `<h3 className="hf-type-card-title">`. Står to kolonner side om side
  (fx Admin → Billeder), skal deres felter starte i samme højde: vælgere/faner
  hører til INDE i feltet, ikke over det.
- **Decimaltegn (user rule 2026-10-10)**: arkene (og databasen) skriver decimaler med punktum ("1.5 l", "3.5% fedt"); appen viser brugerens eget decimaltegn efter landet i profilen — komma i Danmark og de andre komma-lande ("1,5 l"), punktum i fx GB/IE/US/CA/AU/NZ/CH. Vis varetekster via `DecimalText`/`localizeDecimals` (`src/lib/decimal-separator.ts`); søgning finder begge skrivemåder. Se DECISIONS.md.
- **Originalkolonnerne i produktarkene rettes ALDRIG (user rule 2026-10-10)**: `Original Title`, `Product Name`, `Subtitle`, `Source URL`, `Image File`, `Parse Status` og butikkens øvrige skrabede kolonner (`Manufacturer`, `Servings`, `Price`, `Venue`, SPAR `Subcategory`/`Vare`/`Variant`/`quantity`) er præcis som skrabet — ingen stavning, forkortelser, decimaltegn eller m./u., hverken i hånden eller med scripts. Alle rettelser skrives i vores egne kolonner; er de ændret, hentes de tilbage fra den rå skrabning. Se Excelark/NAVNEREGLER.md.
- **Alle ark er 100 % identiske med Bilka** (2026-10-10): de samme 45 kolonner
  (navne, rækkefølge, titelformler), ingen ekstra kolonner. Arbejdsarkene og
  scriptet (`Excelark/omlaeg_til_bilka_kolonner.py --ens`) står i
  Excelark/NAVNEREGLER.md.
- **Quantity i samme stil** (alle ark, brugerens regel 2026-10-10): tal,
  mellemrum, enhed med småt som Bilka — `200 g`, `75 cl`, `1.5 l`, `6 stk`,
  `6 x 0.33 l`, `ca. 600 g`, `1 bakke`; aldrig `200g`, `1Ltr` eller `200 g.`.
- **Tyske ark: `_is_` og brand (2026-10-10)**: `Excelark/tyske_is_og_brand.py` (deploy-grenen) udfylder tomme `_is_`-kolonner med tyske ord og kopierer brand/subbrand 1:1 fra de danske ark, når mærket står forrest i den tyske titel. Se Excelark/NAVNEREGLER.md.
- **Knapper står ALTID nederst (bruger 2026-10-11, afløser en fejlagtig regel fra 2026-10-10)**: handlingsknapper (Gem, Tilføj, Færdig, Deaktiver osv.) står nederst og fast over bundcirklen (`HfScreen`-footeren, 40 px over menuen) — aldrig øverst. Der er ingen knapper øverst nogen steder i appen; kun hvor brugeren udtrykkeligt placerer én dér (fx den hvide "Rediger visning" øverst på synkroniseringssiden). Gælder web og native.
- Vægt-ikonet er ALTID badevægten (`IconBathScale` / `CalendarBathScaleIcon`) — aldrig Tablers vægtskål (`IconScale`/`Scale`), heller ikke i kalenderen (bruger 2026-10-10, gentaget). Målinger uden vægt (fx iltmætning, puls) får `Heartbeat`, aldrig vægtikonet. Web og native.
- Enkeltmålinger uden vægt i kalenderen (iltmætning, puls …) kan swipes til venstre og slettes (`DELETE /api/health-metrics`, web + native); vejninger kan også swipes væk (`DELETE /api/weight-entries/[id]`, bruger 2026-10-17). En ny synkronisering kan hente en slettet måling igen (bruger 2026-10-10).
- Google Health leverer iltmætning/åndedræt/HRV/temperatur hvert minut; de gemmes som ét gennemsnit pr. time (`averagePerHour` i `google-health-items.ts`), så kalenderen ikke oversvømmes. Dagsværdier (kl. 00:00 UTC) blandes aldrig ind i timegennemsnittene. Migration `20261011080000_google_health_hourly_collapse` samlede de minutmålinger, der allerede lå i databasen.
- **Synkroniseringssiden (forbundet integration, bruger 2026-10-11)**: `src/app/settings/integrations/[app]/ConnectedView.tsx` (web + native). Rækkefølge: hvid knap **Rediger visning** allerøverst (bundark med til/fra pr. datatype, gemmes straks, loggen følger valgene) → "Sidst synkroniseret" + **Aktiveret** med grøn cirkel til højre → **I dag**-log → **Historik**-dropdown (I går / Sidste uge / Sidste måned / Sidste år / Altid, historikken slutter ved midnat i dag) → sort **Deaktiver** fast nederst. Loggen: `GET /api/integrations/<app>/log?range=…`. Kun OAuth-integrationer, der er forbundet og ikke mangler adgang; de øvrige har stadig godkendelsesarket.
- Ikonerne i bundcirklen (FooterArc/tilføj-hjulet) er altid ensartede sorte stregikoner — aldrig farvede 3D-billeder (bruger 2026-10-10; Aktivitet bruger `IconActivity`). Gælder web og native.
- Faste bundknapper (Tilføj/Gem i `HfScreen`-footeren) skal ligge over bundcirklen (FooterArc, 40 px over menuen), aldrig bag den (bruger 2026-10-09).
- **ALLE knapper ligger over halvcirklen, aldrig under/bag den (bruger 2026-10-17, gentaget med eftertryk)**: en sides send-/gem-knap lægges i `HfScreen`s `footer` (native: `HcScreen(bottom = …)`), ikke nederst i indholdet. Rammen sørger selv for afstanden: web-footeren har 40 px ekstra bund, indhold uden footer får 40 px luft (`.hf-screen-scroll--arc`), og native får `LocalBottomArcInset` (40 dp) fra `AppFrame` — læg aldrig egen 40 px-afstand oveni. Userbacks "Feedback"-knap står på Userbacks egen plads og må aldrig flyttes op, så den dækker Tilføj/Gem eller andre knapper (bruger 2026-10-17: "det har jeg aldrig spurgt om") — flyt den kun, hvis brugeren beder om det.

- Ingen ikke-bestilte tekster: ingen disclaimers, forklaringer eller
  "erstatter ikke læge"-noter på sider, medmindre brugeren har bedt om dem
  (brugerens regel 2026-10-09; Hello Doc-disclaimeren er fjernet).
- Hello Doc har burger-menu øverst til højre, hvor modtageren sammensætter
  dashboardet (vis/skjul + rækkefølge pr. panel, gemt på enheden).
- Skelet-loading skal tydeligt ses at loade (user rule 2026-10-15): et smalt,
  lyst glimt (`--hf-color-skeleton-highlight` `#FBF9F5`, ±0,35 boksbredde)
  løber fra venstre mod højre over alle skelet-flader (web `.hf-skeleton`,
  native `HcSkeleton`). Et bredt, svagt bånd blev set som en statisk boks.
- Alle felter, der loades ind, står som glimtende skelet-bokse på deres egen
  plads, til de er læst (user rule 2026-10-15) — på varesiden også brandet
  (og subbrandet) ved cirklen og den grønne linje med størrelse/variant,
  ikke kun navnet, næringen og ingredienserne. Web + native.

## Scan-appen: manuel udløser, aldrig automatisk (user rule 2026-10-14)

- Scan-appen (Oprettelses-appen, `src/app/scan/**`) tager ALDRIG billeder eller scanner automatisk: medarbejderen trykker selv på udløseren — hyldebilledet og alle fire bokse i "Opret vare" (`CreateProductMediaGrid`).
- Fotos tages med telefonens eget kamera via `<input type="file" accept="image/*" capture="environment">`. Det gør, at en Bluetooth-udløser i den anden hånd virker (den trykker på kameraets egen udløserknap), og det skal blive ved med at virke.
- Hello Cals automatiske Tilføj-kamera (`src/components/camera/**`, ingen "Tag billede"-knap, `useAutoCapture`) og levende kamera (`getUserMedia`, `<video>`, ZXing fra video) må aldrig bruges i scan-appen. Stregkoden læses af det tagne foto.
- Vagt: `src/lib/scan-app-manual-capture.test.mjs` (`npm test`) fejler, hvis et filfelt mister `capture` eller scan-appen får et levende kamera. Se DECISIONS.md 2026-10-14.

## Tilføj-kameraet (user rule 2026-10-14)

- Trinnene er nummererede og store øverst i billedet: "1. Scan stregkode", "2. Tag billede af forsiden", "3. Tag billede af energi", "4. Tag billede af indholdsfortegnelsen" (`ScanHeading`). Overskriften står alene — det klarede trin vises kun kort i `StepDoneOverlay`, aldrig som en blivende overstreget linje (user rule 2026-10-15).
- Flueben på trin-knapperne og opret-sidens fotobokse (`CaptureCheckOverlay`) og i `StepDoneOverlay` er mørk signaturgrøn (`--hf-color-brand`), aldrig den lysegrønne `--hf-color-accent`, som ikke kan ses på lyse flader (user rule 2026-10-15).
- Hvert klaret trin vises, før flowet går videre (`StepDoneOverlay`): hvidt blink over hele billedet, trinnet stort i midten, overstreges, stort flueben, og linjen flyver op og bliver lille. Også stregkoden, når varen er ukendt — flowet må aldrig bare springe videre.
- Stregkoden læses levende af videoen (uændret). **Forside, energi og indhold tages med udløseren nederst i kamerabilledet** (`.hf-shutter`, native `ShutterRow`) — "gammeldags billede", ingen automatisk scanning, intet tryk på selve billedet (user rule 2026-10-14: "Jeg har ikke tillid til den anden metode. Ingen scanning mere.").
- **Fotoet tages i trykøjeblikket**, og trinnet er klaret med det samme — aldrig et nyt billede efter en analyse (user rule 2026-10-15: "Billedet skal selvfølgelig tages med det samme når man trykker").
- **Energi-trinnet klares først, når energien er læst (user rule 2026-10-16: "Det skal ikke fejle. For man kan ikke fortsætte flowet hvis det fejler")**: kan telefonen ikke selv læse næringstabellen, læser AI'en fotoet, mens brugeren venter ("Læser energien …", `POST /api/products/read-energy`). Kun en komplet aflæsning pr. 100 g/ml — eller en alkoholisk drik over 1,2 % vol — klarer trinnet; ellers står "Energien kunne ikke læses. Tag billedet igen …" og billedet tages om. Aflæsningen sendes med oprettelsen (`nutritionAnalysisId`) og læses ikke igen. Web + native. Alarm: tom OpenAI-kredit, afvist nøgle eller lav saldo giver en fejlet Uptime-kørsel (mail), via `ai` i `/api/health?deep=1`. Vagt: `scan-energy-guard.test.mjs`.
- **Forlæsning, mens brugeren sigter** (user rule 2026-10-15): telefonen læser løbende videoens tekst lokalt — forsidens tekst (dublet + kendt mærke via `/api/products/recognize-text` med `preRead`), næringstabel og ingrediensliste — og viser fundene i en pille over udløseren ("Læser teksten …", "Næringstabel fundet", "Mærke: X", "Findes allerede: X"). Forlæsningen klarer aldrig et trin af sig selv; udløseren bruger den, ellers læses udløserens eget billede (højst 2,5 s), og senere svar gemmes blot til oprettelsen. Kun web: native har ingen levende video (`CaptureHooks.takePhoto`).
- **Lokal genlæsning uden OpenAI (user rule 2026-10-16: "hvorfor kan du ikke behandle billederne igen?")**: `quick-enrichment-recovery` (hvert 2. min.) retter nye varer uden navn eller med 0 kcal ud fra serverens egen tekstlæsning (tesseract, `back_local.py`) af de gemte billeder — energi kun ved en komplet tabel pr. 100 g/ml, navn via kendt brand + varenavn i databasen. Kører også, mens OpenAI-kreditten er tom. Varer fra før originalarkivet får deres gemte fotos lagt i kø til den lokale læser.
- **Originalbilleder af ALT (user rule 2026-10-16: "Jeg skal have original af det hele")**: hver optagelse på hvert trin — stregkode, forside, energi og indhold, også omtagninger — gemmes som hele, ubeskårne kamerabillede (op til 4096 px, kun metadata fjernes) i `product_back_photos` og kobles til varen, så de planlagte jobs kan bruge dem. Kun energi/indhold analyseres af `back-photo-scan`; ved 2-års tjekket gemmes de som arkiv uden analyse. Web + native (native-stregkodelæseren giver intet billede).
- **Bagsiden gemmes ubeskåret** (user rule 2026-10-15): energi/indhold uploader hele kamerabilledet (op til 4096 px) til `POST /api/products/back-photos`; serveren beskærer eller skalerer det aldrig. Nattens robot `back-photo-scan` analyserer hvert billede præcis ÉN gang (mærkninger der ikke står på forsiden, finlæsning, udvidet stavekontrol som forslag) — det indgår aldrig i senere kørsler (`ProductBackPhoto.analyzedAt`). Web + native.
- **Behandling skal kunne ses** (user rule 2026-10-15: "der står ikke nogen steder at billedet behandles"): et billede, der stadig behandles, giver en load-cirkel på trinnets knap og linjen "Behandler billeder: …" under kameraet; `PhotoWorkingOverlay` skriver altid sin tekst synligt.
- "Spring over" til højre for udløseren på indholds-trinnet (varer uden indholdsfortegnelse): trinnet klares uden foto, varen oprettes uden ingrediensliste (`skipIngredients`, log `ingredients_skipped`). Vises ikke, når listen allerede stod på energibilledet (trinnet springes da over af sig selv). Web + native.
- Søgefeltet er lille med resten af billedet mørkt (stregkode 56 % × 2,2:1; energi/indhold 68 % kvadrat; 55 % mørkt). Kun forsiden har hele rammen. Fotoet tages af hele søgerens kvadrat, men det VISES ikke for brugeren.
- **Forsidefotoet beskæres ALDRIG efter AI'ens objektboks** (user rule 2026-10-15: "halveret … Det må ikke ske"). Objektgenkendelsen bruges kun til at afvise billeder uden vare og til loggen; varens billede er altid hele rammen, brugeren sigtede med. Vagt: `src/lib/front-photo-never-cropped.test.mjs`. Serveren melder desuden et forsidefoto, der er smallere end 0,45 (kort/lang side) eller under 240 px, som `front_image_suspect` (fejl) i admin → Log (`src/lib/front-photo-guard.ts`). Den natlige robot `front-image-check` finder beskårne forsidebilleder (form + loggen) og sender dem til scan-appens "Skal scannes"; scan-appens nye forsidefoto erstatter dem.
- **Varer over to år fremstår som nye (user rule 2026-10-15)**: har en vare ligget i databasen i over to år (eller er det over to år siden, den sidst blev tjekket), tager kameraet forside, energi og indhold som ved en ny vare, når en indlogget kunde scanner den — men kunden får varens tidligere info med det samme. Fotoene vurderes KUN om natten: intern AI (`recheck-local`, DINOv2) sammenligner nyt foto med originalen, OpenAI kun ved tvivl, og `product-recheck` læser energi/indhold (telefonens OCR først). Ændringer går til admin → Nye varer → 2-års tjek med det nye foto ved siden af originalen; det nyeste er valgt som standard. Admin tager stilling, FØR billedet fritlægges (ingen spildte tokens); det valgte fritlægges om natten. Nye tal gælder kun registreringer fra og med scanningen (kunden selv og dem imellem) — historikken før scanningen ændres aldrig. Web + native. Se DECISIONS.md 2026-10-15.
- Kun brugerens egne fotos klarer et trin. Stregkodefotoet klarer aldrig energi/indhold. "Indhold på energibilledet" giver stadig begge flueben.
- Tag om: tryk på et trin med flueben. Stregkode-knappen starter forfra (alt nulstilles).
- `ImageCapture.takePhoto` bruges ALDRIG på WebKit/iPhone (`isWebKit`, `src/lib/camera-webkit.ts`): den hænger og gør videoen sort. Fotoet er dér det skarpeste af tre 4K-videobilleder. Se DECISIONS.md 2026-10-14.
- Sort/stoppet kamera logges i admin → Log og genstartes af sig selv (`useCameraWatchdog`). Nye kamerahændelser får et dansk navn i `src/lib/debug-log-view.ts`.
- Produktsiden viser varens felter løbende, som AI læser dem (`AddProductView` poller `pendingFields`).
- Når varen oprettes, slukkes kameraet og al billedanalyse; forsidefotoet står bag "Opretter varen …" — aldrig et sort, låst kamera. Oprettelsen har en tidsgrænse (60 s); fejler eller udløber den, slås stregkoden op, og findes varen alligevel, går flowet til den (`product_create_recovered`).
- Web og native (`native/.../capture/ProductCaptureFlow.kt`) ændres sammen. Se DECISIONS.md 2026-10-14.

## Ingredienslister (user rule 2026-10-14)

- Alle aflæste ingredienslister går gennem `reviewIngredientsText` (`src/lib/ingredient-text-quality.ts`), før de gemmes — også nye veje. Dansk staves "soja", aldrig "soya". E-numre er E + tal (aldrig £/€). Næringstabellen hører aldrig med i listen. Typiske OCR-fejl rettes mod ordlisten `src/lib/ingredient-words.ts` (native-kopi i `FoodLogic.kt` — ret begge). Ord med STORE bogstaver er allergener og rettes til det nærmeste allergen. Ingredienslisten slutter, hvor næringstabellen begynder (også "Energi"/kJ/kcal uden overskrift).
- Stavelogik findes ét sted: `src/lib/spelling-engine.ts` (robot, kontrol ved gem og visning). Ny ordbog/regel = grundlisten `src/lib/ingredient-words.ts`, katalogets ordforråd eller admins afgørelser på Stavekontrol — aldrig en særregel for ét ord i koden. Nattens robot (`spelling-check`) retter kun sikre fund og lægger resten på admin → Stavekontrol; hvad admin har afvist/fortrudt, rettes aldrig igen.
- E-numre i ingredienslisten vises fede og klikbare, men aldrig understregede — web og native (bruger 2026-10-17).
- Allergener i ingredienslisten står altid med STORT og fed og linker til allergenets side under Viden om mad → Allergener (`allergenHref`) — web og native (bruger 2026-10-17). Nye allergen-ord findes af nattens allergen-robot (Open Food Facts-opslag + ord skrevet med STORT) og afgøres på admin → Allergen-ord; læg aldrig enkeltord ind i koden.
- Tvivl om en aflæsning skal altid nå admin: telefonens liste afvises (AI læser), og AI'ens sættes ned til højst 60 % sikkerhed → Usikkerheder → Indhold. Rettelser og tvivl logges (`ingredients_text_review`).

## Kropsmål: stemmeguiden (user rule 2026-10-14)

- Stemmeguiden på Kropsmål må KUN udfylde kropsmål-felterne. Den er regelstyret (ingen AI-model): tal + "spring over", "tilbage", "gentag", "stop". Nye kommandoer eller felter tilføjes i både `src/lib/body-measurement-voice.ts` og `native/.../profile/BodyMeasurementVoice.kt` (samme regler, samme tests).
- Et nyt kropsmål kræver også teksterne `bodyMeasurements.voice.target.<felt>` og `bodyMeasurements.voice.how.<felt>` (hvor man måler) på alle sprog.
- Tallet gemmes præcis som en indtastning; urimelige tal (uden for 5–250 cm / 2–100 tommer) gemmes aldrig.

## Versionsvagt efter deploy (2026-10-14)

- Hvert web-deploy bygges med `NEXT_DEPLOYMENT_ID` = commit-sha (`build.yml` → `Dockerfile`). En åben fane med kode fra et ældre deploy genindlæses af Next.js ved næste sideskift. Fjern det aldrig: uden det kørte brugerens fane timer efter et deploy stadig den gamle kamerakode.

## Sikkerhed

- Nøgler må aldrig stå i logs. Google-nøgler sendes i adressen (`?key=`), og `requests` skriver adressen i fejl — image-agent og logo-agent skjuler derfor alt `key=...` i loggen (2026-10-17).

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

## Stregkode-reserve (user rule 2026-10-17)

Giver billederne hverken energi eller navn, bruges stregkodeopslaget (Open Food Facts) som reserve — kun når energien passer med etikettens tal og navnet står på forsiden. Aldrig skøn. Se DECISIONS 2026-10-17.

## AI: intern AI først (user rule 2026-10-15)

Natlige robotter bruger intern AI (lokalt på serveren: OpenCV, tesseract, DINOv2 …) først og spørger kun OpenAI, når den lokale søgning intet finder. Mærkat-jobbet: `label-local` → `label-scan` (se DECISIONS 2026-10-15) 2-års tjekket: `recheck-local` → `product-recheck`.

## Billeder og logoer: originalen online først (user rule 2026-10-15)

Før noget AI-billedarbejde søges originalen online (Google Vision). Logoer: kun hvis intet fritlagt logo findes, rentegner AI originaludklippet med prompten "Logoet skal være en rentegning og ikke en genskabelse af noget lignende. Det skal være 100% tro mod originalen, blot i højere opløsning og fritlagt. Der må med andre ord ikke fortolkes og skabes noget med AI." Admin viser altid originaludklippet ved siden af det hentede/rentegnede logo (`/admin/logos`).

## Open Food Facts-varer og forsidefotos i fuld opløsning (user rule 2026-10-15)

- **Opdater-banneret foldes sammen ved scroll (user rule 2026-10-15)**: scrolles varesiden nedad, foldes "Optjen X points …" (også den nedtrukne del) sammen til trækstregen; når siden rammer toppen igen, folder det sig ud til det, det var. Har brugeren selv foldet det sammen, bliver det sådan. Teksten og fotoboksene glider op og ned (300 ms), aldrig et smæk. Web (`UpdatePointsBanner.tsx`) + native (`AddProductParts.kt`).
- Banneret med kortet "Forside" vises på alle Open Food Facts-varer (ikke USDA), til nogen har fotograferet varen (`rescannedAt`), og på varer uden billede. På en OFF-vare tilbydes kun forsiden (energi/indhold kun, når de mangler), og den giver 10 points ("Optjen 10 points …"); ellers 20. OFF's billeder er dårlige og lavopløste; brugerens foto afløser dem efter fritlægning og admin-godkendelse. Logik: `hasOffFrontImage` i `src/lib/product-rescan-offer.ts` og `updatePointsFor` i `src/lib/product-update.ts` (brugerens valg 2026-10-15).
- Forsidefotoet gemmes altid i fuld opløsning (op til 4096 px): kameraets opret-flow (`frontPhotoFull`) og opdater-varen (`fullPhoto`), web og app. AI'en får kun en nedskaleret kopi.

## Proces

- `instrumentation.ts` hører til i `src/` (appen bruger `src/app`); i roden ignorerer Next instrumentation, og de planlagte job starter aldrig (fundet 2026-10-17, vagt i `src/lib/instrumentation-location.test.mjs`).

- **Udrulning: kun den nyeste (user rule 2026-10-15)**: deploy-jobbet i `.github/workflows/build.yml` har `concurrency: production-deploy` og trinnet "Skip stale release". Fjern dem aldrig; en ældre commit må aldrig udrulles oven på en nyere. Se DEPLOYMENT.md.

- Spørgsmål til brugeren stilles ALTID i spørgsmålsboksen (AskUserQuestion),
  aldrig som almindelig tekst i et svar og aldrig midt i en opgave: tekst giver
  ingen gul prik, så brugeren ser den ikke (brugerens regel 2026-10-09, global).
- **Aldrig hænge (bruger 2026-10-10, global, ufravigelig):** en opgave må aldrig stå stille. Slut aldrig en tur, mens CI, deploy, review eller en PR venter, uden at et tidsbestemt tjek er sat (`send_later`, højst 5 minutter frem; gentag, til det er gjort). Hvert tjek handler: grøn CI → flet nu; rød CI → ret og push nu; konflikt → løs nu; stående deploy-trin → læs jobloggen og meld den præcise årsag. Opgaven er først færdig, når den er flettet OG deployet. Må deployet ikke kunne gå igennem, skrives årsagen og næste skridt straks i `docs/handoffs/OPEN-TASKS.md`. (Ingen mellemstatus til brugeren, se næste punkt.) At vente passivt på en hændelse er forbudt.
- **Konflikter, merge og lignende rutine løses selv (bruger 2026-10-16, global):** flettekonflikter, `git fetch`/`git merge origin/master`, genbygning af genererede filer, genkørsel af CI og alt tilsvarende rutinearbejde på dine egne grene/PR'er gøres uden at spørge. Ved binære konflikter: vælg den version, der er bedst/nyeste (typisk masters) og verificér. Skal brugeren alligevel spørges, sker det KUN i spørgsmålsboksen (AskUserQuestion), aldrig som tekst.
- **Aldrig give opgaven tilbage til brugeren (bruger 2026-10-16, global):** en opgave er ikke færdig, fordi koden er flettet. Brugeren skal aldrig selv køre, starte, installere eller aktivere noget, for at resultatet bliver til noget. "Kør dette på din pc" er ikke en aflevering. Har du ikke direkte adgang, så byg løsningen, så den kører af sig selv, hvor adgangen findes (fx som job i en eksisterende agent på NAS'en, der deployes automatisk), eller find en anden vej, før du melder blokering.
- **Bedt om kørsel på brugerens pc: vent og spørg om adgang (bruger 2026-10-16, gælder over reglen om at aflevere færdigt):** kan du ikke nå pc'en, så byg ikke et alternativ på NAS'en eller andet sted. Skriv kort, at du venter på adgang til pc'en, og spørg i spørgsmålsboksen, når brugeren er ved den. Det er ikke at aflevere opgaven tilbage.
- **Udestående rettes altid (bruger 2026-10-10, generelt):** finder du noget udestående i det område, du arbejder i (manglende oversættelser, forældede noter i OPEN-TASKS, halvfærdige dele af samme funktion), så ret det i samme opgave i stedet for blot at notere det. Gælder ikke andre gruppers filer eller ting, der kræver brugerens beslutning.
- **Brugeren er ligeglad med mellemstatus (bruger 2026-10-10, global):** meld ikke automatiske hændelser (PR-abonnement, ventende CI, planlagte tjek, "tests kører stadig") til brugeren. Gør arbejdet færdigt i stilhed, og skriv kun, når der er et resultat, en blokering eller et spørgsmål (i spørgsmålsboksen). Afløser kravet om at melde status hvert 10. minut under "Aldrig hænge". Brugeren gider ikke høre om, hvordan det gøres — det skal bare komme til at virke: løs problemet helt (også følgefejl og deploy), og meld kort, at det virker.
- **Tidspunkter altid i dansk tid** (Europe/Copenhagen, sommer-/vintertid) over for brugeren, aldrig UTC (bruger 2026-10-10).
- Flere parallelle sessioner: stage snævert, deploy-linjen er origin/master.
- **Færdig = svaret er kun "Arkiver mig" (bruger 2026-10-16, afløser 2026-10-15):** når en opgave er helt færdig (flettet og deployet), består dit sidste svar udelukkende af ordene "Arkiver mig" — intet andet, ingen opsummering. Kald stadig aldrig `archive_session` selv; brugeren arkiverer.
- Commit, push, flet PR og alt andet der skal til for at færdiggøre en opgave sker uden at spørge først (bruger 2026-10-09; AGENTS.md).
- Kan en ændring pushes sammen med en anden opgaves push/PR, så undlad egen push/PR (bruger 2026-10-09; AGENTS.md).
- Efter rebase der rører `prisma/schema.prisma`: kør `prisma validate` + typecheck.

## Robot-QoS (user rule 2026-10-17)

- Robotter starter kun, når serverens CPU/RAM er under grænsen på admin → Robotter → Belastningsstyring, og aldrig i en spærretid. Nye robotter får det automatisk: app-jobs med `robot: true` går gennem `src/lib/jobs/runner.ts`, Python-agenter gennem `job_control.py` — byg aldrig en robot udenom dem. Ændres reglerne, ændres `src/lib/robot-qos.ts` og alle `scripts/*/job_control.py` sammen. "KØR" går udenom.

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
- **Søgemotor (2026-10-10)**: søgningen kører på Meilisearch; databasen er kilden, og robotten "search-index" synker hvert 5. min. Nye søgbare felter skal med i `src/lib/search-engine/product-index.ts`. Postgres er reserve. Søgestatistik ligger i admin → Analyse → Søgning. Se DECISIONS 2026-10-10.
- **Søgning læser alle varens tekstfelter (2026-10-10)**: navn, flertalsnavn, mærke, serie, varetype, variant, smag og søgeord; sammensatte ord matcher i ét eller flere ord ("instantkaffe" = "instant kaffe"). Se DECISIONS 2026-10-10.
- **Søgeregel (global, 2026-10-09)**: søger brugeren i flertal, vises Product title plural (`namePlural`); i ental vises Product title singular (`name`). Se docs/FRIDA.md.
- Bilka/REMA ental/flertal + DB-kolonnenavne: se Excelark/NAVNEREGLER.md (status 2026-10-09: _ny-ark lavet, ikke gennemgået).
- **"ben" hører til produkttypen** (alle ark, brugerens regel 2026-10-10): står "ben" alene i Variation, er det del af produkttypeordet og skrives sammen med det: "Skiver af okse" + "ben" → "Skiver af okseben". Står der "med ben", følger "med ben" med ind i produkttypen ("Ibérico kotelet med ben", som "Koteletter af gris uden ben"). Variation ryddes; `Product type plural` rettes tilsvarende. Se Excelark/NAVNEREGLER.md.
- **Ost: "revet" og "i blok"** (alle ark, brugerens regel 2026-10-10): al revet ost får keyword `revet` (ordet fjernes fra typen: "Revet mozzarella" → "Mozzarella (Revet)"). Al fast ost og "i stykke" (også "i blok") får keyword `i blok` ("Modnet fast ost 45+ (I blok)"); ikke ost i skiver/tern/revet og ikke "halvfast". Se Excelark/NAVNEREGLER.md.
- **Børn i familien (bruger 2026-10-09):** et barn kan hverken lukke kontoen, slette sine data eller melde sig ud — kun forælderen (betaleren). Barnet kan ikke fravælge at vise detaljer; det kan kun se, hvad forælderen viser. Gælder web og native. Se DECISIONS.md samme dato.

## Valgte knapper (user rule 2026-10-09)

Valgte knapper/faner/chips/planvalg har ALTID den lysegrønne farve (`--hf-color-accent`, #BBF06A) med sort kant og tekst — brug `.hf-selected` / `.hf-choice` / `.hf-chip`, aldrig sort, mørkegrøn eller beige som valgt-flade. Eneste undtagelse: kalenderens dags dato (`.hf-cal-current`). Native bruger `HcColors.SelectedBg`.

## Mærker på produktcirklen (user rule 2026-10-10)

Certifikater står nederst til venstre ud for cirklens bund (økologi altid nederst), advarsels-/kostikoner øverst ud for cirklens top; øverste har førsteret og æder certifikaterne, økologi sidst. Rækkefølge og allergen-tilstand sættes under Indstillinger → Visning → Prioritering af visning. Se `src/lib/circle-badges.ts`.
- **Undtagelse (bruger 2026-10-16): Opret ret er en rigtig side, ikke en popup**; de tre startvalg er kvadratiske felter midt på siden med teksten under. **Flows er helsides popups (bruger 2026-10-09):** alle flows overalt (fx Opret ret: Indsæt tekst / Scan opskrift / Opret manuelt, hvor man tilføjer én ingrediens ad gangen) åbner som en helsides popup (`BottomSheet size="full"`), ikke som en almindelig side.

Økologimærker (Ø-mærket, EU-bladet, Bio-Siegel …) står ALDRIG i certifikater, kun i økologi-feltet `ProductFilters.organic` — kommasepareret (fx "Økologisk, EU-økologi"), med mærkets oprindelige navn, og kun mærker, der fremgår af varen: Ø-mærket og EU-bladet er to forskellige klassificeringer, og det ene giver aldrig automatisk det andet. Hvert vises med sit eget logo (user rule 2026-10-15). Se `src/lib/label-certifications.ts`.

Økologisk i varenavnet: på dansk er alt med "økologisk" og "øko" økologisk, på tysk "bio", på engelsk "organic", og tilsvarende ord på andre sprog (ekologisk, biologisch, biologique, biologico, ecológico, ekologiczny, luomu). Dansk "biologisk" er ikke økologi (user rule 2026-10-15).

## Trinindikator (HfProgressStepper)

- Flows med mange trin (fx "Opret ny screening") viser kun teksten under det aktive trin (`activeLabelOnly`), og prikkerne i bjælken er tryk-bare (`onSelect`): tilbage altid, frem kun når de forudgående trin er udfyldt (`isStepEnabled`). Web og native (`ProfileProgressStepper`). 2026-10-10.

- Opskrifter → fanen "Delte retter": kildeknapperne under søgefeltet er "Vis alle", én knap pr. måltidskasse, brugeren har slået til under Integrationer (Hello Fresh, RetNemt, BetterFeast), og Valdemarsro. Ingen separat "Delte retter"-knap (den gentog fanen) (2026-10-10).
- **Måltidskasser (2026-10-10)**: HelloFresh, RetNemt og BetterFeast står ét sted, `src/lib/meal-kit-providers.ts` (id-præfiks, kilde, navn). En ny måltidskasse tilføjes dér + egen agent i `scripts/<navn>-agent`; dens retter er Product-rækker i kategori "Retter" og vises på HelloFresh-opskriftssiden. Se DECISIONS 2026-10-10.
- Opskrifter → filter → Antal personer: standard 0 = ikke valgt, vist lysegråt/underordnet; ingen person er valgt som default. Receptsiden bruger mindst 1 (brugerens krav 2026-10-10).

## Webversionen har ingen forside (user rule 2026-10-11)

- Forsiden med drejehjul, tilføj-cirkel og dagens liste findes kun i appen (telefon/tablet). I webversionen (desktop-skallen, ≥ 1024 px) må den aldrig renderes eller loade — hverken hjul, spinnere eller data. Roden `/` åbner kalenderens dagsvisning (`WEB_HOME`).
- Ny forsidekomponent (prompt, popup, banner) lægges inde i `AppHomeGate` i `src/app/page.tsx`, så den følger porten. Breakpointet ligger kun i `src/lib/desktop-query.ts`.

## Venstre menu: alt foldet ud som standard (user rule 2026-10-11)

- Fanerne/accordions i webversionens venstre menu (`WebShell`) er foldet ud som standard, hver gang man logger ind eller åbner siden på ny efter at den har været lukket. Sidebjælken er også udvidet (ikke ikon-skinne) ved nyt besøg.
- **Admin (afløser ovenstående for `AdminShell`, user rule 2026-10-16)**: hver gang man logger ind i admin, er ALLE accordions i venstre menu lukket — også den gruppe, den aktuelle side ligger i. Admin folder aldrig selv en gruppe ud ved sideskift; kun admins egne klik åbner en gruppe.
- Brugerens egne fold/sammenklap huskes kun, mens fanen er åben (`sessionStorage`, `src/lib/sidebar-state.ts`) og nulstilles ved login/logout. Aldrig `localStorage` til fold-tilstand.
- **Ark-gennemgang 2026-10-11 (bruger)**: 20 nye/præciserede regler (Quantity uden stk, Pack Count ens, MHD/datoer væk, brand/subbrand egne kolonner, kategori er aldrig produkttype, ingen dobbelte ord, dyremad fjernes, lande i `_is_country_of_origen` undtagen vin, certifikater/alkohol-% til egne felter). Fuld liste: `Excelark/NAVNEREGLER.md` → "Brugerens regler 2026-10-11". Overlevering: `docs/handoffs/2026-10-11-produkttype-gennemgang.md`.
## Middleware: /_next/ på admin-værten (2026-10-11)

- På admin-værten (dmin.hellocal.io) får alle stier /admin foran i middleware.ts, undtagen rod-assets (billedfiler, /icons/, /_next/). /_next/image SKAL være undtaget — ellers lander alle 
ext/image-billeder (logoet i sidebjælken) på /admin/login og forsvinder. Matcheren har siden Adgangsmuren (2026-10-08) ladet /_next/image gå gennem middleware.


## Aldrig 0 kcal på en ret (user rule 2026-10-11)

- Undtagelse (2026-10-16): "Trender netop nu" tager retter uden energi med som opfyldning (uden kcal-tekst), så rækken aldrig er tom.
- "Trender netop nu" er **aldrig** tom (user rule 2026-10-17): op til 10 retter; klik først, derefter et trender-tal nedarvet fra kilden (HelloFresh/Valdemarsro-bedømmelser og favoritter i `recipeDetails.sourcePopularity`, delte retters popularitet) eller et fiktivt tal (samme hele dagen), når kilden intet har. Næringsfiltre (makro, keto, lidt sukker, næringsstoffer) må ikke tømme rækken — kun allergener og kostretning frasorterer dér. `src/lib/trending-score.ts`.
- Delte retter (user rule 2026-10-17): Trender og favoritter kan slås fra under filtrenes Visning (til som standard); favoritter står på én linje som Trender; derunder "Alle retter" sorteret efter popularitet, tre rækker ad gangen med endeløs scroll. Web og native ens.
- En ret (Trender netop nu, søgning, favoritter, Mine retter, web og native) vises **aldrig** med "0 kcal". Er energien 0 eller ukendt, skjules retten på serveren (`/api/shared-recipes`: `nutritionMissing = false`, `kcalPer100g > 0`, delte retter `kcal > 0`), og klienterne viser ingen kcal-tekst i stedet for et nul.
- Importrobotterne gemmer 0 kcal + `nutritionMissing = true`, når næringen er ukendt (Valdemarsro uden Frida-match, BetterFeast/RetNemt uden tal). 0 er en pladsholder, aldrig en værdi — tjek altid `nutritionMissing`, når en liste hentes direkte fra `products`.
- Nye lister, der viser kcal for retter/varer, skal følge samme regel; et nul må aldrig stå uden, at nogen har reageret på det.

## Lange admin-lister (user rule 2026-10-11)

- Enhver admin-liste, der kan blive lang, hentes/tegnes gradvist og har øverst valget "Evigheds-scroll / Sideinddelt" (`ListModeToggle` + `useListMode` i `src/components/admin/ListMode.tsx`). Valget huskes i browseren og gælder alle lister.
- Send aldrig hele tabellen til browseren: lette rækker pr. udsnit, detaljer først ved åbning. Tunge opslag caches kort (`src/lib/ttl-cache.ts`) og nulstilles af ruter, der ændrer data.
- Admin-sider har altid en `loading.tsx`, så sideskift reagerer med det samme.

## Webversionen følger appen (user rule 2026-10-11)

- Webversionen (desktop-skallen `WebShell`, bredde ≥ 1024 px) skal kunne alt, hvad appen kan — undtagen det, der kræver kameraet: Scan med kamera, Billeddagbog og stemme (Chat/Indtast afløser mikrofonen). Plus-cirklen i topbjælken viser hele tilføj-menuen minus mikrofon og kamera.
- Sidebjælken (`src/lib/web-nav.ts`) følger appens Profil- og Indstillinger-sider punkt for punkt (Beskeder med ulæst-tal, Status, Point, Vægtkalibrering, Kropsmål, Søvnmønster, Screeninger, Viden om, Hello Doc, Familie, Kommunikation, Visning med alle undersider, Support …). Nyt menupunkt i appen = nyt punkt i `web-nav.ts` i samme opgave. `src/lib/web-nav.test.mjs` læser appens menuer og fejler, når webben mangler et punkt (eller et nyt udeladt punkt ikke står i testens `NOT_ON_WEB` med begrundelse).
- Alt, der kun er monteret på appens forside (`src/app/page.tsx`), findes ikke på desktop, fordi roden sender videre til kalenderen. Sådanne popups (vægt/tøj, "Det er længe siden, der er synkroniseret", pulsudsving → "Hvad foretog du dig?") monteres derfor også i `src/components/web/WebStartPrompts.tsx` (vises på kalenderen). Testen kræver det.

## Samling af lokale ændringer (2026-10-11)

- Seneste produktregler på master går forud for gamle efterladte implementationer. Samlingsgennemgang: `docs/handoffs/2026-10-11-github-samling.md`.
- Ental/flertal uden artikel: når søgeordet kun findes i den ene titelform, vises denne. Fælles ord og delord beholder standardtitlen (`displayNameForQuery`).
- Labels i Varedatabase bruger de eksisterende certifikatlogoer; ingen tegnede erstatningslogoer.

- **Graf-accent (2026-10-14)**: grafer på forsiden bruger `--hf-color-chart-blue` (mørkere lyseblå, `stroke-hf-chart-blue`/`fill-hf-chart-blue`); grå bruges til anbefalinger/mål. Ingen andre blå i grafer.
- **Antal personer (opskrifter): 0 = tag ikke højde for det (user rule 2026-10-16).** 0 er standard (web + native). Retten vises som gemt, uden skalering og uden "anbefalet servering"/"kcal pr. servering"; først ved ≥ 1 skaleres retten til brugerens anbefalede portion.

- **Fritskrabede varebilleder på hjemmesiden har cirklen bagt ind (bruger 2026-10-16)**: varesiden (web) henter `/product-circle?src=…` i stedet for det rå fritlæg; cirklen skrumper aldrig, billedet vokser i stedet (`product-circle-layout.ts`). Gælder kun hjemmesiden, ikke native.
## Slidere på alle talfelter + haptik (brugerregel 2026-10-16)

- Intet talfelt (mængde, vægt, mål, tid, antal) må stå alene: det har altid en tilgængelig slider (`HfSlider` / `PersonsSlider` / `MacroSliderBar` / `SleepRangeSlider`; native `CaptureSlider` / `FoodSlider`). Tal kan stadig skrives, men slideren skal være der.
- Alle slidere giver mildt haptisk feedback ved værdiskift på alle mobilplatforme: web via `sliderHaptic()` (`src/lib/haptics.ts`, Vibration API), native via `LocalHapticFeedback`.
- Nye slidere skal bruge disse komponenter, aldrig `<input type="range">`.
- **Tallet over en slider kan altid skrives (bruger 2026-10-17, gentaget flere gange):** overalt hvor der er en slider, skal værdien også kunne tastes manuelt. Tallet ser ud som almindelig tekst og ændrer ikke udseende, før man trykker på det; da får det hvid baggrund, og taltastaturet kommer frem. Brug `TapNumberInput` (web) / `CaptureTapNumber` (native) — eller et eksisterende felt ved siden af slideren. Ingen slider uden en indtastningsmulighed.
- Mængdefeltet på produktsiden er selv slideren (bruger 2026-10-16): det store tal trækkes vandret (`DragNumberStrip`, web + native). Under trækket vises nabotallene mindre og mere utydelige i siderne i tal-hjulets stil, alle på det store tals grundlinje; enheden ("g") skjules under trækket og kommer igen, når nabotallene er faldet ud. Ingen separat slider under feltet.
- Præciseret 2026-10-16: reglen gælder felter hvor brugeren selv taster et tal (mængde, vægt, højde, tid, mål, antal). Slider tilføjet på: mængde på produktsiden, aktivitet (tid/distance/kcal), kropsmål, kardio, familie (højde/vægt), graviditet, screening-tal, pulszoner, Opret ret-tid, omregning (web + native). Produktoprettelse (kcal/protein/kulhydrat/fedt pr. 100 g) og admin er undtaget — der indtastes aflæste mærkater præcist. Kode- og tekstfelter har aldrig slider.

- **Vin: brand er producenten (bruger 2026-10-16)**: vintype (Rosso, Rosé), drue, appellation og kvalitetstrin (Riesling, Bourgogne, Qba, Chianti Riserva …) er aldrig brand — de står i variant. "S.C." = Santa Carolina. REMA 1000-vinene i `scripts/rema1000-import/data/rema1000_products.json` er rettet (fx Grande Alberone: brand "Grande Alberone", variant "Rosso"). Uafklaret: række 1960 (brand "Assamblage", titel "CAROLINA GRAN RESERVA") — producenten kendes ikke sikkert. Databasen skal have samme rettelse ved næste REMA-import.

- **Certifikater (Peter, 2026-10-17):** appen viser KUN Peters egne certifikat-billeder (`public/certifications`, kilde NAS `Projektfiler (ikke app)\Certifikater`, mapping i `src/lib/certification-images.ts`). Aldrig tegnede/hjemmelavede mærker — findes intet billede, vises intet.
- **Sortering og visning = dropdown, aldrig knapper (Peter, 2026-10-17)**: Gælder overalt i admin og appen. Brug `<select class="hf-input hf-input--compact">` (admin: `LinkSelect` på serversider, `ListModeToggle` til Visning). Bulk-"Handlinger" står altid til højre. Admin-opgaver afsluttes med linket til den rettede side.

- "Læs mere"/"Vis mere" er altid en lille tekstknap (`hf-btn-text`, 15 px, naturlig bredde) og står som sidste element i sin blok — aldrig tekst direkte under den.

- **Designrettelser er globale (2026-10-17):** generelle design-/stilrettelser gælder altid globalt for browserversionen og hele admin (fra 1024 px) — aldrig pr. side. Mobilvisningen er undtaget. Kontroller er 40 px / 15 px fra 1024 px (globals.css, sidst i filen).
