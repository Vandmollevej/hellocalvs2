# HELLO CAL — decision log

This file records durable decisions. Add a dated entry when a later decision changes one of them.

## 2026-09-26: Support-indbakke (beskedtjeneste i admin)

- "Kontakt os"-henvendelser er nu tråde: `SupportMessage` (USER / SUPPORT /
  NOTE). Den første besked ligger både i `SupportRequest.message` (historik)
  og som første `SupportMessage`. Interne noter (NOTE) vises aldrig for brugeren.
- Prioritet `HIGH/NORMAL/LOW` sættes af admin; nye sager er `NORMAL`.
- "Ikke besvaret" = `awaitingReply` (seneste besked er fra brugeren).
  Admin kan også markere besvaret/ikke besvaret manuelt. En brugerbesked i en
  løst sag genåbner den.
- Admin `/admin/support`: standard = åbne sager, ældste øverst (efter
  brugerens seneste besked); "Senest modtaget øverst" som alternativ.
  Filtre: status (Åbne/Ikke besvaret/Løste/Alle), 3 prioritets-flueben,
  søgning (emne, navn, e-mail, sagsnr.). Filteret ligger i URL'en.
  Sagen åbnes på `/admin/support/[id]` med svar, intern note,
  "Send og marker som løst", prioritet og status.
- Svar sendes via `queueMessage("SUPPORT_REPLY")` (mail + push + brugerens
  indbakke, ikke fravælgelig) med link til `/settings/support/requests/[id]`,
  hvor brugeren ser tråden og kan svare.
- 24-timers-regel: scheduleren (hvert 15. min) sender én samlet mail
  (`SUPPORT_OVERDUE_ADMIN`) til `ADMIN_NOTIFICATION_EMAIL` med alle sager,
  der netop har passeret 24 timer uden svar. `overdueAlertSentAt` sikrer én
  advarsel pr. ubesvaret besked; nulstilles ved svar/ny brugerbesked.
  Eksisterende åbne sager markeres som allerede advaret ved migrationen.

## 2026-09-26: Redigering af målsætninger
## 2026-09-26: Én overskrift med streger — kun `.hf-type-section-title`

Brugerens krav (gentaget): alle overskrifter med streger ("──── Tekst ────")
skal være samme klasse på alle sider. `.hf-type-section-title` er den eneste.

- "Tidspunkt" (`TimeSection`), datogrupperne på Vand og Målsætning,
  Integrationer-sektionerne, brugerens egne overskrifter på statistiksiden,
  "+ Skillelinje" på Ubrugte statistik-kort og "eller" på admin-login bruger
  nu klassen direkte.
- `SectionSeparator` og `DateSeparator` (tan-streger, 80 % bredde, versaler)
  er slettet. Det omstøder udseendet i 2026-09-22 "Global tidspunkt-regel";
  selve reglen (Tidspunkt-overskrift med "Kl. 05.28" under, ingen beige
  bjælke) består.
- Ingen side eller komponent må tegne egne streger, bredder, farver eller
  versaler ved en overskrift — ret kun klassen. Hvor et gitter selv styrer
  afstanden (statistik-gitteret), nulstilles luften via klassens variabler
  `--hf-section-title-space-above/-below`, aldrig med `mt-*`/`mb-*`.
- Statistiksidens tekstløse sorte skillelinje er ikke en overskrift og er
  uændret.

## 2026-09-25: Uncertainties-tærskler, billed-fane, natlig robot og admin "Cron-jobs"

Brugerens svar 2026-09-25 (G4, runde 2):

- **Tærskler** (`src/lib/uncertainty-thresholds.ts`): under 90 % vises på
  Uncertainties (vejledende mål); under 70 % rød ramme og altid øverst;
  under 50 % skjules produktet i søgningen, indtil en admin har gennemgået
  analysen (`AiProductAnalysis.reviewedAt`). `reviewedAt` er adskilt fra
  `correctedAt`, fordi `correctedAt` allerede sættes, når brugeren bekræfter
  værdierne ved oprettelsen.
- **Billeder**: femte fane med den lokale billedrobots match mellem et
  oprettelsesfoto og forsidefotoet (`ProductMatchCheck`, PENDING, under 90).
  Afgørelsen gemmes via Kvalitetskontrols route (træningsdata).
- **Natlig AI-genkørsel** (job `uncertainty-rerun`, standard kl. 03:00):
  samme skema/prompt som oprettelsen (`src/lib/product-ai-tasks.ts`), højst
  100 analyser pr. nat. Mere sikkert svar erstatter det gamle; når det når
  90 %, skrives værdierne til produktet.
- **Én container til robotter?** Nej: app-jobs kører i app-processens
  scheduler, og hver Python-agent beholder sin egen container (forskellige
  tunge afhængigheder, fx torch/rembg). Nye natlige robotter i TypeScript
  tilføjes som app-jobs; kun robotter med egne tunge afhængigheder får en
  container. Alle styres fra samme tabel.
- **Admin "Cron-jobs"** (`/admin/cron-jobs`, tabel `scheduled_jobs`, register
  `src/lib/jobs/registry.ts`): liste med beskrivelse, seneste kørsel/status/
  varighed, pause/genoptag, "kør nu" og plan (dagligt kl. TT:MM dansk tid,
  hvert N. minut, eller kun manuelt). App-jobs og Python-agenterne
  (`scripts/*/job_control.py`, én kopi pr. agent) tjekker tabellen hvert
  minut. REMA-importen kører stadig ved hver container-start.
- **Fra deklarationen**: næringsaflæsningen læser nu også øvrige
  næringsstoffer og producentens egen ± (gemmes som producentdata ved
  oprettelsen). Produkter oprettet uden aflæst næringsdeklaration får
  makroerne markeret som estimerede (~ ved kcal i søgningen).

## 2026-09-25: Usikkerheds-~ + admin "Uncertainties" (bygget)

Erstatter punkterne i "Usikkerheds-bølgeikon (afklaret, ikke bygget)" nedenfor,
hvor de er i modstrid. Kilden er brugerens svar i samtale ef2ba16f (fire
runder + godkendt mockup v4, 2026-09-23) og svarene 2026-09-24 ved
overtagelsen af G4 ("Tegn", Frida-datadumpet er fuldt, admin-siden bygges nu).

- **Tegnet:** et grønt tastatur-`~` (ikke en tegnet SVG), ca. 2,4 × tekstens
  størrelse med tynd kontur (0,75 px; 0,5 px i den grå linje) — målene fra
  mockup v4. Komponent: `src/components/ui/UncertaintyTilde.tsx`.
- **Hvad er sikkert:** producentens egne tal (varedeklaration, producent-/
  kædedata, Open Food Facts) og Frida på selve den generiske vare. **Estimeret
  (~):** når en mærkevare mangler et felt, og værdien lånes fra den nærmeste
  Frida-vare, eller et felt er AI-udfyldt (`nutrientSources` = ESTIMATED/AI).
  Admin-godkendelse fjerner ikke ~ — kun kilden afgør det.
- **±:** vises kun, når producenten selv oplyser den, og da 1:1
  (`Product.nutrientTolerances`). Vi beregner aldrig selv en ±; estimater får
  kun ~. (Erstatter det tidligere "margen ud fra Frida".)
- **Grå linje:** producentens ± og/eller `~ <estimeret mængde>` efter hinanden,
  fx `±0,5 mg  ~ 1,1 mg`. Altid foldet ind; tryk på rækken/pilen folder ud.
- **Indstillinger → Visning → Usikkerhed:** én kontakt, "Fold usikkerhed ud
  automatisk", **slået fra** som standard (`User.autoExpandUncertainty`). Ingrediens-kontakten er droppet. (Erstatter de
  to kontakter "slået til som standard".)
- **Søgeresultater:** `~` foran kalorietallet, kun når kcal/protein/kulhydrat/
  fedt er estimeret (`nutrientSources`).
- **Frida:** agenten importerer nu alle vitaminer, mineraler, fedtsyresummer,
  kolesterol, kostfibre, sukkerarter og salt (`Product.micronutrientsPer100g`,
  nøgler og ParameterID'er i `src/lib/nutrients.ts`). En allerede importeret
  version genimporteres én gang (markør i `frida_import_state.title`), og
  generiske ingredienser får mikrodata kopieret fra deres Frida-match.
- **Snapshot:** registreringer gemmer `nutrientSnapshot` +
  `nutrientEstimatedSnapshot` + `nutrientToleranceSnapshot`, så statistik viser
  hvor meget af et gennemsnit der er estimeret uden at genberegne senere.
- **Admin "Uncertainties"** erstatter "Advarsler" (gamle sektioner vises
  nederst, `/admin/warnings` viderestiller). Datakilden er `AiProductAnalysis`
  (ikke BugReport som noteret 2026-09-24 — BugReport har ingen confidence,
  mens analyserne har confidence + foto pr. type): Produkt = FRONT, Energi =
  NUTRITION, Indhold = INGREDIENTS, EAN = BARCODE. Åben = ikke rettet og
  confidence under 90 % (EAN: forkert GS1-kontrolciffer = 100 %). Usikkerhed
  = 100 − confidence. AI'en returnerer nu `ocrRegion` + `uncertainRegions`
  (`AiProductAnalysis.regions`, normaliseret 0–1) til beskæring og røde
  rammer; ældre analyser vises med hele fotoet. Rettelsen skrives til
  produktet og gemmes som `correction`. Den natlige AI-robot er stadig en
  senere fase; en lavere minimumstærskel er stadig uafklaret.


## 2026-09-25: Blød e-mailbekræftelse ved tilmelding

Brugerens valg. Tilmelding med e-mail + adgangskode logger ind med det samme,
men `emailVerifiedAt` sættes først, når linket i bekræftelsesmailen åbnes
(`/verify-email`, signeret JWT med bruger-ID + e-mail, 7 dage). Indtil da
viser `AuthGate` en bjælke med "Send igen". Logger nogen ind med
Google/Apple/Facebook på en e-mail, hvor en eksisterende konto aldrig er
bekræftet, kobles kontoen på, men dens adgangskode og passkeys fjernes
først (beskytter mod konti oprettet med en fremmed e-mail). Mails sendes
nu straks fra `queueMessage()` i stedet for kun ved scheduler-tick (15 min).


## 2026-09-25: Global lodret rytme (8/16/32) og sorte primærknapper

Brugerens krav: "stringent opsætning på tværs af hele sitet med rene linjer og
globale designregler" — afstande mellem blokke, tekst og knapper var forskellige
fra side til side.

- Kun 8 px (inde i en blok), 16 px (mellem blokke, kortpadding, gutter) og
  32 px (før en sektion). Se `design.md` §5.4.
- Sidecontainere bruger `.hf-page` i stedet for egne `flex flex-col gap-N p-4`;
  kort bruger `.hf-card`. Hele `src/` er normaliseret: alle lodrette
  margener/paddings (`mt/mb/my/pt/pb/space-y`) og stablede gaps ligger på
  4/8/16/32 px, kort har 16 px padding, og `rounded-xl`/`rounded-2xl` er låst
  til 8 px i temaet. Accordion og chip følger samme mål. Undtagelser: vandrette
  gaps i rækker (ikon/tekst), knappers interne padding, kalenderens 7-kolonne
  dagsgitter (6 px) og enkelte special-offsets (`pt-9`, `mt-10`, `mt-20`).
- Primærknapper forbliver sorte, også når de er deaktiveret (ingen grå
  opacity). "Indløs points" på Abonnement er bevidst en grå flade med hvid tekst.
- Abonnement: prislinjen viser kun prisen ("119 kr./måned"), ikke "Seriøs —".
- Sektionsoverskrifter: 32 px over og 16 px under (justerer 12 px fra
  "Sektionsoverskrifter, points-banner …" nedenfor til 8/16/32-skalaen). I en
  `.hf-page` trækkes stakkens gap fra, så resultatet er det samme.

## 2026-09-25: Billeder, fremgangsmåde og kategorier i Opret ret

- Nederst i Opret ret: knapperne "Tilføj billeder" og "Tilføj fremgangsmåde".
- **Billeder:** op til 3 af den færdige ret; det første er forsidebillede i
  listerne. Nedskaleres i browseren (≤ 1600 px JPEG) og gemmes uden EXIF i
  `/product-images/recipe-images` (samme volume som produktbilleder).
- **Fremgangsmåde:** overskrift + tekst pr. trin og et kameraikon i siden
  (billede pr. trin, vist som thumbnail). Plus gør trinnet statisk (uden
  redigerbar baggrund), og et nyt, større trin får fokus. Tryk på et statisk
  trin retter det; × sletter det.
- **Kategorier:** efter Gem vises et vindue (retten er allerede gemt) med
  Diæter (forudvalgt ud fra ingredienserne), Måltidstype, Køkken og
  Tilberedning. LUK gemmer kategorierne en gang til, hvis nogen er valgt.
  Gemmes som `Dish.tags` ("diet:vegan", "meal:dinner" …).
- Billeder, fremgangsmåde og kategorier følger med, når retten deles og
  kopieres. Fremgangsmåden indgår i søgningen og i allergen-/diætfiltrene.
- Kladden (navn, billeder, trin) ligger i sessionStorage, så den overlever
  turen ud efter ingredienser.
- `GET /api/dishes/[id]` kræver nu, at man ejer retten.

## 2026-09-25: Filtre og portionsjustering på "Delte retter"

Brugerens krav: sorteringsknapperne erstattes af et filterikon, der åbner
skærmen "Filtre" (`/profile/recipes/filters`). Fanen hedder nu "Delte retter"
(ikke "Søg i delte retter").

- **Opdateret 2026-09-26:** Filterikonet står til højre for søgefeltet, sort
  direkte på baggrunden (ingen ramme). Før brugeren søger, viser fanen
  "Trender netop nu" (de 3 mest populære retter) og derunder "Mine
  favoritter" ("Du har endnu ingen favoritter", hvis tom). "Ingen opskrifter
  matcher din søgning" vises kun efter en søgning.

- **Rækkefølge på filterskærmen (2026-09-26):** alle grupper er accordions
  med sort ikon foran: Antal personer (1–6; tallet kan trykkes og skrives,
  som gram-tallene i energifordelingen) · Visning på resultater (Vis
  kalorier, Vis energifordeling) · Sorter efter (én ad gangen) · Allergier ·
  Diæter · Specialkost · Fokus på makroer (inkl. Højt på protein) · Nulstil.
  Valgene gemmes i browseren (`localStorage`), ikke på serveren.
- **Filtrering sker på serveren** (`src/lib/recipe-filter-match.ts`). Alt,
  der ikke opfylder et valgt filter, sorteres fra — også når data mangler.
- **Allergier:** EU's 14 plus 15 andre kendte fødevareallergier, alfabetisk.
  Genkendes via madvarens EU-allergenmærkning og en ordscanning (dansk +
  engelsk) af rettens navn, ingrediensnavne og varedeklarationer.
  "Kokosmælk", "muskatnød", "glutenfri pasta" o.l. tæller ikke. Delte retter
  har ingen beskrivelse/fremgangsmåde endnu, så de kan ikke scannes.
- **Spor af:** "kan indeholde spor af …" i en varedeklaration og ingredienser,
  der ofte har spor (chokolade → nødder, havre → gluten osv.) giver en rød
  advarsel under rettens titel — kun for allergener, brugeren har valgt.
- **Diæter:** vegansk, vegetarisk, pescetarisk, glutenfri, laktosefri
  (laktosefri mælkeprodukter tilladt), keto (≤ 10 E% kulhydrat), lavt sukker
  (EU: ≤ 5 g/100 g).
- **Makroer (energiprocent):** Høj på protein ≥ 20 E% (EU-forordning
  1924/2006). Øvrige grænser ligger uden for NNR 2023's intervaller: protein
  lav < 10, kulhydrat høj > 60 / lav < 26, fedt høj > 40 / lav < 25. Høj og lav
  udelukker hinanden pr. makro.
- **Specialkost:** "Højt indhold af" fibre (EU: 3 g/100 kcal), jern, calcium,
  kalium, A- og C-vitamin (≥ 30 % af EU-referenceindtaget pr. 600 kcal). Data
  findes kun delvist (Open Food Facts, HelloFresh); ukendt ⇒ frasorteret.
- **Anbefalet servering** (`src/lib/recipe-portions.ts`): hovedmåltid = 30 %
  af brugerens dagsbehov (Mifflin-St Jeor × PAL 1,4; uden profildata EU's
  2000 kcal). Måltidsfordeling: morgenmad 20–25 %, frokost 25–30 %,
  aftensmad 30–35 %, mellemmåltider 10–20 %. Listen viser kcal pr. servering
  og antal serveringer; opskriftssiden skalerer ingrediensernes gram til det
  valgte antal personer (den gemte ret ændres ikke).
## 2026-09-25: Vægtkalibrering — eksplicit "Opdatér oplysninger"-knap

Brugerbeslutning. `src/app/profile/weight-calibration/page.tsx` er
omdesignet: infotekst øverst i cremefarvet kort (ikke grøn), rigtige
indtastningsfelter for "Uden tøj"/"Med tøj", forholdsvalg som to-vejs
ikonknapper (sko/uden sko, morgen/aften, før/efter toilet, før/efter mad) —
"Ved ikke" er fjernet; et nyt tryk på det valgte felt nulstiller til
`UNKNOWN`. "Vægt over dagen" vises nederst som linjer (som kalenderen), og en
stor sort "Opdatér oplysninger"-knap gemmer alt. Siden er dermed en bevidst
undtagelse fra reglen om automatisk lagring uden "Gem"-knap. Ikoner uden
tabler-modstykke ligger i `src/components/icons/WeighConditions.tsx`.
## 2026-09-25: API-nøgler i admin

Brugerens ønske: en admin-side med overblik over alle API-nøgler og et felt
til at rette dem, "hvis det er sikkert".

- Side `/admin/api-keys` (kataloget i `src/lib/api-keys/catalog.ts`).
  Hemmelige værdier forlader aldrig serveren — kun de sidste fire tegn og
  længden. Client ID'er, adresser og lignende vises i klar tekst.
- En rettet nøgle gemmes i `app_secrets`, AES-256-GCM-krypteret med en
  nøgle afledt (HKDF) af `ADMIN_SESSION_SECRET`. Ved opstart
  (`instrumentation.ts`) lægges værdierne oven på `process.env`, så al
  eksisterende kode virker uændret, og en rettelse slår igennem med det
  samme uden genstart. "Brug .env igen" sletter rækken.
- Skiftes `ADMIN_SESSION_SECRET`, kan de gemte værdier ikke længere læses;
  siden viser det, og .env-værdien gælder, til nøglen gemmes igen.
- Database, sessionsnøgler og adresser (`APP_BASE_URL` m.fl.) kan kun
  ændres i `.env.production` — de læses ved opstart og er vist som
  skrivebeskyttet status.
- "Test" kalder udbyderen med de aktive nøgler (OAuth med bevidst ugyldig
  kode: "ugyldig kode" = nøglerne er godkendt). For Google tjekkes også, om
  redirect-URI'en er registreret.
- Den globale copy/paste-blokering (2026-09-22) undtager indhold under
  `[data-allow-clipboard]` — kun brugt på denne admin-side, så nøgler kan
  indsættes.

## 2026-09-25: Én tekst og ét ikon pr. Tilføj-handling

Brugeren vil have, at tekster og ikoner på Tilføj-skærmen slår igennem på
forsidehjulet og alle andre steder, handlingen vises. `ADD_ACTIONS` i
`src/lib/add-actions.ts` har derfor kun én tekst (`labelKey`). Hjulet har
ikke længere egne kortere hint-tekster. Ikonet for Kropsmål afhænger af køn
og sættes via `visibleAddActions()` / `addActionByKey(key, sex)`.

## 2026-09-25: Minimum for sundt dagligt indtag i kalenderen

Brugeren ønsker en advarsel, når indtaget er for lavt til at være sundt.
Minimum = den højeste af:
1. Hvilestofskiftet (BMR) efter Mifflin-St Jeor (Mifflin et al., *Am J Clin
   Nutr* 1990), beregnet ud fra seneste vejning, højde, alder og køn i
   profilen. Det er samme formel, som ugeestimatet allerede bruger.
2. Et fast gulv på 1.200 kcal for kvinder og 1.500 kcal for mænd. Det er den
   grænse, der typisk anbefales for slankekur uden lægelig opfølgning (bl.a.
   Harvard Health Publishing). Er køn ukendt, bruges 1.200.
Resultatet rundes op til nærmeste 10 kcal. Kun afsluttede dage med
indtastninger kan markeres. Dagen i dag markeres ikke, fordi den ikke er
slut, og tomme dage markeres heller ikke. Det er et vejledende skøn, ikke
medicinsk rådgivning.

## 2026-09-25: Sektionsoverskrifter, points-banner og "Invitér en ven"

Brugerens krav efter skærmbillede af Invitér en ven:

- `.hf-type-section-title` ejer sin afstand: 32 px over (0 som første
  element), 12 px under. Årsag: klassens `margin: 0` lå uden for Tailwinds
  lag og overtrumfede alle sidernes `mt-6`/`mb-2`, så der var ingen luft
  nogen steder. Sidernes lokale margins er fjernet (design.md §4.3).
- `PointsPromoBanner`: ingen stor "Læs betingelser"-knap. Overskriften starter
  med "*", og under kortet står en grå "* Læs betingelser"-linje. Omstøder
  2026-09-11-varianten med hvid fuldbreddeknap.
- Invitér en ven: "Dit navn" (forudfyldt med profilnavn) og en 2-linjers
  personlig besked (maks. 160 tegn) øverst. Standardteksten
  (`src/lib/invite-message.ts`) vises som forhåndsvisning og deles via
  telefonens delemenu (Web Share) med dele-ikon på knappen. Navn og besked
  bruges også i invitationsmailen (`{{personalMessage}}`, HTML-escapet).
  Kladden huskes kun lokalt i browseren.

## 2026-09-25: Blød e-mailbekræftelse ved tilmelding

Brugerens valg. Tilmelding med e-mail + adgangskode logger ind med det samme,
men `emailVerifiedAt` sættes først, når linket i bekræftelsesmailen åbnes
(`/verify-email`, signeret JWT med bruger-ID + e-mail, 7 dage). Indtil da
viser `AuthGate` en bjælke med "Send igen". Logger nogen ind med
Google/Apple/Facebook på en e-mail, hvor en eksisterende konto aldrig er
bekræftet, kobles kontoen på, men dens adgangskode og passkeys fjernes
først (beskytter mod konti oprettet med en fremmed e-mail). Mails sendes
nu straks fra `queueMessage()` i stedet for kun ved scheduler-tick (15 min).


## 2026-09-24: Normalt login — privacy-by-architecture ophævet

Brugerens beslutning: "Man skal bare kunne logge ind som på alle andre
apps." De skrappe sikkerhedsforanstaltninger var kun ment til admin.

- **Omstøder** 2026-09-23 "Privacy-by-architecture" og `docs/PRIVACY.md`
  helt. Krypteret boks (`src/lib/vault`), passkey-only-login, e-mail som
  HMAC-hash, gendannelsesfil/-sager, anonym statistik, supportpakker,
  separat nyhedsbrev og engangs-invitelinks er fjernet (commits rullet
  tilbage). Brugerdata ligger igen server-side i de almindelige tabeller.
- Login: e-mail + adgangskode (med glemt adgangskode), Face ID (passkey,
  WebAuthn), Google, Apple og Facebook. Samme bekræftede e-mail kobles på
  samme konto. Efter login tilbydes Face ID én gang på enheder, der kan.
  Face ID er kun hurtig-login på en enhed, der allerede har slået det til
  efter et almindeligt login — login-siden viser ikke Face ID-knappen på en
  ny enhed (flag `hc_passkey_on_device` i localStorage).
- Den delte demo-bruger kommer ikke tilbage: alle private endpoints kræver
  session (`getSessionUser` + `unauthorized()`), `AuthGate` sender
  ikke-indloggede til `/welcome`.
- Advarsel på mail (`NEW_DEVICE_LOGIN`) ved login fra en ny enhed
  (langlivet `hc_device`-cookie) eller et nyt land (Cloudflare
  `cf-ipcountry`). Første login giver ingen advarsel.
- Delte opskrifter: server-side. Ejer = `publisherHash` afledt af
  bruger-ID (admin ser stadig kun pseudonym). Favoritter er snapshots i
  `SharedRecipeFavorite`.
- Næringsrettelser: `reporterUserId`; admins svar sendes på mail
  (`ADMIN_MESSAGE`).
- Admin-login (adgangskode + TOTP + passkey) er uændret.

## 2026-09-25: G3 — grove produktkategorier, kød/drikke-statistik, "Største kilder" og "Månedens synder"

- `Product.productCategory` bruger brugerens grove regnearks-kategorier:
  Drikkevarer (DRINK), Grøntsager (ny VEGETABLES, migration
  `20260924160000_product_category_vegetables`), Råvarer (RAW), Forarbejdede
  varer (PROCESSED). GENERIC/INGREDIENT bevares. Navne i
  `PRODUCT_CATEGORY_LABELS` (`src/lib/product-display-unit.ts`). Den 30-delte
  Hello Cal-kategoriliste + NOVA/ultraforarbejdet er en senere, separat opgave.
- Klassifikation (`src/lib/food-classification.ts`) læser produktets egne
  regnearksfelter i `Product.dietaryTags`: `meat` (okse/kalv → oksekød, gris,
  kylling/kalkun/and/gås → fjerkræ, fisk inkl. skaldyr; flere typer deles
  ligeligt), `isSugarFree`, `isAlcoholFree`, `pct` (alkohol-%, "x% fedt"
  ignoreres) samt `productType` og sukker pr. 100 g fra `nutritionExtra`.
  Sukkerholdig drik = drikkevare med sukker > 0, ikke sukkerfri/light, ikke
  alkohol (inkl. mælk, smoothie, drikkeyoghurt). Alkohol = drikkevare med
  alkohol-% > 0,5 (eller alkohol-produkttype, når % mangler). 1 genstand = 12 g
  ren alkohol.
- Klassifikationen gemmes som snapshot på registreringen i boksen
  (`classification`), samme snapshot-princip som kcal/makroer. Ældre
  registreringer udfyldes én gang lokalt via `POST /api/registrations/classify`,
  som kun henter de samme offentlige produktsider, registreringen selv hentede.
- Ikke bygget endnu: Frida-AI-beregning af kødandel i sammensatte retter (i
  dag tæller hele varens vægt/kcal, hvis varen har en kødtype; egne retter
  tæller ikke med i kød/drikke-boksene).
- Statistik: 12 nye kort (kød g/kcal ×4, sukkerholdige drikke kcal, alkohol
  kcal/genstande/mængde) som totaler for den valgte periode, egen gruppe under
  "Tilføj kort". Bred boks "Største syndere" (top 5 for Kalorier/Fedt/Sukker,
  samme vare må gå igen, klik åbner varen). Siden "Største kilder"
  (`/statistics/sources`) er fjernet 2026-09-25 efter brugerens ønske, da
  "Månedens synder" dækker det samme; boksen har derfor intet "Se alle".
- "Månedens synder": knap under kalenderens månedsvisning →
  `/statistics/month-sinners?month=YYYY-MM`, grupperet efter produkttype med
  "kcal · %", faner Kalorier/Fedt/Sukker.

## 2026-09-25: Integrationssiden

Brugerens krav: ingen "Kræver app"-mærker eller "Generér enhedskode"-knapper
(telefon-integrationerne er ikke sat op). Sektioner i denne rækkefølge:
Aktive integrationer, Oftest anvendt (Apple Health, Google Health, Strava),
Opskrifter (HelloFresh), Apps (Health Connect, Withings, Garmin, Samsung
Health, Polar Flow — Polar Flow nederst). Aktive/forbundne kort får en grøn
prik foran navnet og "Fjern" som almindelig tekst på egen linje (ingen stor
knap). Ikke-forbindbare kort viser "Ikke tilgængelig endnu". Google Health
bruger Google-login-klienten som reserve. Denne afløser "Telefon-kort"-punktet
i 2026-09-24 "Otte sundhedsintegrationer".

## 2026-09-24: Otte sundhedsintegrationer inden for boks-arkitekturen (G8)

Brugerens valg (6068f78a/69a1b2bd, 8d98b548/2c95590f): "Byg alle 8" på den
låste måde. ChatGPT-opgavens plan (tokens og data åbent i databasen,
enhedskoder fjernet) blev IKKE fulgt, da den strider mod docs/PRIVACY.md.

- Siden viser: Apple Health, Garmin, Health Connect, Google Health, Polar
  Flow, Samsung Health, Strava, Withings med brugerens egne logoer
  (`public/integrations/*.png`, beskåret automatisk).
- **Cloud (OAuth, virker nu):** Withings (vægt + fedtprocent), Google Health
  API (vægt, træning, skridt pr. dag), Strava og Polar (træningspas). Én
  fælles registrering (`src/lib/integrations/registry.ts`) og dynamiske
  ruter `/api/integrations/[provider]/{connect,callback,sync,disconnect}`.
  Hentede data forsegles straks til brugerens anonyme indbakke som før.
  Første synkronisering henter historik (Withings 365 dage, Google/Strava 90,
  Polar 30). Siden synkroniserer automatisk ved åbning (højst hvert 15. min).
- **Google Health ≠ Health Connect.** `GOOGLE_HEALTH` betyder nu Google
  Health API i skyen. Health Connect har fået sin egen værdi
  (`HEALTH_CONNECT`); ingest-ruten modtager det gamle `GOOGLE_HEALTH` som
  `HEALTH_CONNECT`. Dette erstatter beslutningen 2026-08-28 om, at Google
  Health kun kan nås via telefon-app.
- **Telefon-kort:** Apple Health og Health Connect kræver Hello Cal-appen;
  enhedskoden er flyttet ind på netop de to kort (ikke én fælles boks).
  Samsung Health deler via Health Connect. Garmin afventer partneraftale.
- Fitbit vises kun, hvis brugeren allerede har den forbundet (afløses af
  Google Health).
- Redirect-URI: standard `<base>/api/integrations/<slug>/callback`;
  `<PRÆFIKS>_REDIRECT_URI` kan overstyre, og `/api/withings/callback` og
  `/api/google-health/callback` virker også.

## 2026-09-24: Usikkerheds-bølgeikon (afklaret, ikke bygget)

Brugerens krav og valg, punkt for punkt (ikke bygget denne omgang, se
`docs/STATUS.md` 2026-09-24 for "next work"):

- **Erstatter/supplerer** det grønne "godkendt"-skjold i søgeresultater
  (MyFitnessPal-reference) med et grønt bølge-/tilde-ikon ("usikkerhedstegnet"),
  der vises ved fødevarer og ved enkelte mikronæringsstofværdier, som **ikke**
  stammer fra varedeklarationen.
- **Datamodel-omfang:** kilde+konfidens-tracking (`*Source`/`*Confidence`,
  se `ProductFeatureSource` i `prisma/schema.prisma`) findes i dag kun for
  sukker/fiber/salt/fuldkorn. Brugeren har bekræftet at dette skal **udvides
  til alle næringsstoffer** — vitaminer, mineraler, natrium, kalium osv.
- **Udløser for vare-ikon i søgeresultater:** vises kun når producentens egen
  varedeklaration ikke har udfyldt feltet, og værdien i stedet er hentet/
  estimeret (AI eller Frida). Ikke en generel konfidens-tærskel, og ikke et
  manuelt admin-flag.
- **Frida-integration (ny, stort arbejde):** Frida-importen
  (`src/lib/generic-ingredient-match.ts`, `frida-agent`) gemmer i dag kun de 4
  kerne-makronæringsstoffer — vitamin/mineral-estimering fra Frida er
  ifølge tidligere log (2026-08-27/2026-09-19-afsnit ovenfor) aldrig bygget.
  Brugeren har bekræftet at denne Frida-vitamin/mineral-estimering **skal
  bygges som del af denne opgave**, ikke udskydes. Margenen (±-tallet vist i
  gråt) skal udregnes ud fra Frida's data, når værdien ikke kommer fra
  varedeklarationen.
- **Visning i UI:**
  - Under "Statistik"-boksene (StatCardsGrid, `src/lib/stat-cards.ts`): under
    værdien (fx "0,5 mg natrium") vises margen-tallet (fx "±0,1 mg") i gråt,
    med det grønne bølgeikon foran.
  - Samme mønster i varedeklarationstabellen under "vis mere".
- **Indstillinger → Visning:** to separate on/off-knapper, efter samme
  mønster som `src/app/settings/display/limits/page.tsx` (en dedikeret side
  med ét `User`-boolean-felt via `/api/profile` PATCH):
  1. Usikkerhedsmarkering på varer/ingredienser i søgeresultater.
  2. Usikkerhedsmarkering på mikrodata (vitaminer/mineraler).
  Begge er **slået TIL som standard**, for både nye og eksisterende brugere.
- Ikke bygget: ingen skema-migration, ingen UI, ingen Frida-vitamin-pipeline.
  Se `docs/STATUS.md` 2026-09-24 for opgavelisten til senere implementering.

## 2026-09-24: Delte brugeropskrifter uden kobling til brugeren

Brugerens valg (2026-09-23, punkt for punkt): deling starter ON, kan altid
slås fra; intet om ophavsmand vises; andre bruger originalen, kan
favoritmarkere den og beholder favoritten, selvom ejeren sletter/stopper
delingen; ændringer sker i en privat kopi; ved kontosletning bliver delte
retter liggende anonymt; to faner under Opskrifter; søgning i titel,
ingredienser og kategori; alle sprog; synlig straks, men til godkendelse i
admin (afvist = privat hos ejeren); "Anmeld" kun indtil godkendelse; admin
ser kun et anonymt pseudonym; sortering relevans/popularitet/dato som små
knapper; HelloFresh-opskrifter med i søgningen, kun når brugeren har slået
dem til under Integrationer.

Tilpasset `docs/PRIVACY.md` (vedtaget efter afklaringen, har forrang):

- Den afklarede `ownerUserId` er erstattet af et **udgivertoken**, der kun
  ligger i ejerens krypterede boks. Serveren gemmer kun `SHA-256(token)`
  (`publisherHash`) og har ingen reference til `User` eller `Vault`.
  Ejerskab (stop deling) bevises ved at sende tokenet.
- Admin-pseudonymet er afledt af `publisherHash`; blokering sker på
  pseudonymet og rører ikke kontoen.
- Kontosletning: boksen og dermed tokenet forsvinder, så retten bliver
  liggende uden nogen, der kan ændre den — der er intet at destruere på
  serveren.
- Favoritter på delte retter gemmes som kopi i brugerens boks, så de
  overlever ejerens sletning. Popularitet tælles anonymt (favorit/kopi).
- Anmeldelser: én pr. bruger og ret holdes kun i processens hukommelse.
- Kategori/tags findes ikke på brugerretter endnu; søgningen dækker titel
  og ingredienser.

## 2026-09-23: Brugerindberettede næringsrettelser → Kvalitetskontrol (anonymt)

Brugerens valg (opgave fra ChatGPT, afklaret punkt for punkt):

- **Udløser:** så snart en ikke-admin registrerer en vare med protein/
  kulhydrat/fedt ændret via skyderne på Tilføj. Serveren (`POST
  /api/registrations`) afgør selv, om værdierne afviger fra produktet
  (afrundet til 0,1 g), så klienten ikke kan omgå kontrollen. Admin-roller
  opretter aldrig brugerindberetninger.
- **Model:** ny `ProductNutritionReport` (kilde `FoodChangeSource.USER_EDIT`),
  kun ændrede felter, omregnet til pr. 100 g med før/indberettet værdi.
  Oprettes i samme transaktion som registreringen. Snapshot-semantikken er
  uændret: registreringen gemmer brugerens værdier, produktet røres ikke.
- **Status:** `PENDING` (produkt uændret) → `APPROVED` (værdierne skrevet til
  produktet i samme transaktion) eller `REJECTED` (produkt uændret). Kun en
  `PENDING` rapport kan afgøres. Rækker slettes aldrig = historik.
- **Confidence:** fast 25 % (`USER_EDIT_CONFIDENCE`), så de altid ligger blandt
  de kontrolkrævende.
- **Visning:** i admin "Kvalitetskontrol" i samme liste som fotokontrollerne,
  én række pr. produkt med mærket "Brugerindberettet" og antal indberetninger.
  Godkend/Afvis sker på produktets admin-side.
- **Privatliv (docs/PRIVACY.md):** rapporten har intet bruger- eller
  registrerings-ID, så admin ikke kan se, hvem der har spist varen. Brugeren
  ønskede alligevel at kunne skrive til indberetteren: rapporten gemmer en
  anonym svaradresse (`replyInboxId` = indberetterens `VaultInbox`), og admin
  kan sende en besked, der forsegles med `sealToPublicKey` og kun kan åbnes på
  brugerens enhed.

## 2026-09-23: App-distribution kun i HelloFresh-lande (ikke bygget)

- Appen udgives kun i App Store/Google Play i en fast, manuelt vedligeholdt
  liste over HelloFresh-lande (låst pr. 2026-09-23, se `docs/STATUS.md`).
- Kun butiksniveau: ingen geo-blokering i appen, webappen og testversioner
  er globale, eksisterende brugere kan altid fortsætte.
- Nye lande kræver manuel godkendelse; HelloFresh-exit ændrer intet.
- Én central landetabel i databasen er sandheden for landelisten.
- HelloFresh-indhold: eget land øverst, andre lande kan stadig vises.

## 2026-09-23: Privacy-by-architecture — Hello Cal må ikke kunne læse brugerdata

Brugeren har vedtaget en arkitekturændring (forslag fra ChatGPT, afklaret med
brugeren punkt for punkt). Den bindende kontrakt er `docs/PRIVACY.md`.

- Tre adskilte dataverdener: identitet, krypteret boks, anonym statistik. Ingen
  fælles nøgle. Boksen har ingen reference til kontoen.
- Private data krypteres på enheden. Hello Cal har ingen nøgle, der kan
  dekryptere dem.
- Almindelige brugere logger ind med passkey. E-mail gemmes kun som HMAC-hash.
- Gendannelse: delt nøgle. Brugeren **downloader** sin halvdel som fil, og
  Hello Cal gemmer den anden. Support frigiver serverhalvdelen efter
  personlig identitetsbekræftelse. Der gemmes ikke placering eller IP som bevis.
- "Log ind som bruger" (impersonation) fjernes. Support sker kun via brugerens
  egen, tidsbegrænsede tilladelse til udvalgte datatyper.
- Nyhedsbreve: separat, frivillig tilmelding, ikke koblet til kontoen.
- Invitér/videresend til en ven: engangslinks uden gemt afsender→modtager-kobling.
- AI: metadata fjernes, ingen ID'er sendes til OpenAI.
- Statistik: klienten sender buckets uden ID; minimum 25 pr. gruppe.
- **Omstøder** 2026-09-02 (impersonation, e-mail + adgangskode-login,
  server-side GDPR-anonymisering af klartekst) og 2026-09-19 (personlig
  søgehistorik på serveren; flyttes til boksen).
- Konsekvens: stort set alle bruger-API'er og store dele af Prisma-modellen
  ændres. Planen køres i faser, se `docs/STATUS.md`.

## 2026-09-23 (senere): Ugesummering vises nu, `∼`-tegn, rigtigt vægtestimat, fremtidige dage uden status

Ændrer punkterne i indlægget nedenfor, hvor de er i modstrid:

- Brugeren har valgt at vise linjen **med det samme**
  (`ENABLE_WEEKLY_ENERGY_SUMMARY = true`), også i den nuværende web/PWA.
- Usikkerhedstegnet er `∼` (U+223C, enkelt bølge) i grønt. Det er brugerens
  eget valg og erstatter `≈`.
- Kcal-totalen bruger nu **samme fortegn som dagsrækkerne**: "+" betyder
  under dagsmålet og vises i grønt, "−" betyder over målet og vises i rødt.
  Totalen kan dermed læses som summen af kolonnen ovenover. Det er stadig kun
  dage til og med i dag, der har registreringer.
- Fremtidige dage viser i Uge- og Liste-visningen kun ugedag og dato, uden
  "Mål ikke nået" og uden kcal-tal.
- Vedligeholdelseskalorier estimeres nu i to niveauer. Begge dele er bygget nu
  efter brugerens valg:
  1. **Selvlærende** (foretrækkes): Over de seneste 28 afsluttede dage er
     vedligehold lig med gennemsnitligt registreret indtag minus hældningen på
     vejningerne (mindste kvadraters metode) × 7.700. Det kræver mindst 14
     registrerede dage og mindst 3 vejninger, der spænder over mindst 14 dage.
     Resultatet afvises, hvis det ligger uden for 0,7–1,4 × formelværdien, fordi
     det typisk skyldes underregistrering eller væskeudsving.
  2. **Formel** (fallback): Mifflin-St Jeor-BMR (vægt, højde, alder og køn)
     × 1,2 (stillesiddende) plus dagens registrerede `Activity.caloriesBurned`.
     Vægten er seneste vejning inden for perioden og ellers profilens startvægt.
- Estimatet medregner kun **afsluttede** dage (før i dag) med registreringer og
  kræver mindst 3 af dem i ugen. Ellers vises kun kcal-totalen.

## 2026-09-23: Kalender — ugentlig kaloriebalance + estimeret vægtændring (bygget, skjult)

- ROADMAP: bygget, men IKKE synlig endnu. Slås til med
  `ENABLE_WEEKLY_ENERGY_SUMMARY` i `src/lib/weekly-energy-summary.ts`, når
  Hello Cal kører som native app eller kalenderen på anden måde har plads til
  linjen. I den nuværende web/PWA tager browserens URL-bjælke pladsen.
- Én diskret linje under de 7 dagsrækker i Uge- og Liste-visningen (ikke
  tidslinjevisningen): kcal-total til højre under kcal-kolonnen, estimeret
  vægtændring til venstre. Intet ekstra kort og ingen ramme. Linjen må ikke
  presse rækkerne sammen, overlappe noget eller give ekstra scroll.
- Totalen er summen af (spist − dagsmål) for dage fra mandag til og med i dag,
  der **har registreringer**. Tomme dage og fremtidige dage tæller ikke med,
  fordi manglende data ikke er et underskud. Ellers ville en tom uge vise ca.
  −23.000 kcal. Fortegnet vises altid, og negativ betyder underskud.
- Vægtestimatet vises med et grønt `≈`-tegn og "Estimeret ±X g" i grå tekst,
  der ikke er fed. Appen havde ikke noget eksisterende bue-/usikkerhedstegn,
  så `≈` blev valgt.
- Estimatet bruger 7.700 kcal/kg som en grov approksimation. Det er aldrig en
  faktisk vægtændring, så UI'et skriver aldrig "Du har tabt …". Det holdes
  adskilt fra målt vægt og trendvægt (`weight-trend.ts`).
- Estimatet vises kun, når appen kender brugerens **vedligeholdelseskalorier**.
  Dagsmålet (`DAILY_KCAL_GOAL`) kan ikke bruges i stedet, fordi et vægttabsmål
  allerede har et underskud indbygget. Den kilde findes ikke endnu, så
  `estimateWeightChangeGrams` kaldes med `null`, og linjen viser kun
  kcal-totalen, indtil den er på plads (fx via aktivitetsniveau/mål i
  SPECIFICATION §5 eller forbrænding fra en integration).

## 2026-09-22: Global tilbage-navigation på undersider

- Alle routede undersider viser som standard en tilbagepil i **venstre**
  slot af den fælles app-header (`ScreenHeader`/`HfScreen`); profilcirklen
  står i højre slot. Sider sender ikke selv `onBack` for at få pilen —
  `onBack` bruges kun til at overstyre handlingen (fx flertrinsflow).
- Undtaget er kun de sider, der åbnes direkte fra bundnavigationen. Da
  brugeren selv kan ændre footerens ikoner, følger undtagelsen det gemte
  footer-layout (standard: `/`, `/foods`, `/calendar`, `/statistics`).
  Reglen ligger ét sted: `isMainFooterRoute()`/`useFooterRootHrefs()` i
  `src/lib/navigation.ts` (eksakt match — nested routes som `/foods/new`
  har altid pil). `hideBackButton` er en sjælden, eksplicit undtagelse.
- Tilbage = `router.back()`; åbnet direkte uden historik → `/`.
- Ikonet er den fælles `HfChevron` (SVG, hvid) — ingen tekst, intet ✕,
  ingen Unicode-pil. Reelle modals/sheets uden egen route (fx kalenderens
  dagsvisning) styrer selv deres lukke-/tilbagehandling.
- Login-/auth-sider uden profilcirkel (signup, glemt/nulstil adgangskode,
  land) følger samme placering: pil i venstre slot.

## 2026-09-25: Start-vægt kan ikke ændres fra appen

Afløser UI-delen af 2026-09-22-beslutningen: Profil tilbyder ikke længere
ændring via verificeringsmail. Start-vægtfeltet er altid låst og henviser
til dagsvægt. En tom start-vægt sættes én gang af første `WeightEntry`
(betinget `updateMany ... weightKg: null`); derefter ændrer vejninger den
aldrig. `PATCH /api/profile` og det e-mailverificerede API er uændrede.

## 2026-09-22: Start-vægt er låst — ændring kun via e-mailverificeret engangslink

- Start-vægt = `User.weightKg` (canonical, ingen parallel kolonne). Dagsvægt
  = `WeightEntry`. De to påvirker aldrig hinanden: verificeret ændring
  opretter ingen `WeightEntry`, og vejninger ændrer ikke start-vægten.
- `PATCH /api/profile` må kun sætte `weightKg` første gang (mens den er
  null); ellers 403. Al senere ændring går via
  `/profile/start-weight` → "Send verificeringsmail"
  (`POST /api/profile/start-weight/verification`) → mail-link
  `/profile/start-weight/verify?token=…` → `POST /api/profile/start-weight`.
- Token: 32 random bytes, kun SHA-256-hash i `start_weight_change_tokens`,
  30 min levetid, engangs; nyt link sletter tidligere ubrugte. Forbrug +
  vægtopdatering sker i én transaktion med betinget `updateMany` (race-sikker).
- `User.startWeightUpdatedAt` er datoen under start-vægten på Profil
  (fallback `createdAt`); den er ikke længere afledt af seneste `WeightEntry`.
- Mail via `queueMessage("START_WEIGHT_CHANGE")` (transaktionel, ikke
  brugerstyrbar); ruten seeder standardskabeloner først, så mailen ikke
  bliver SKIPPED før admin har åbnet Besked automatisering.
- Identitet følger `/api/profile` (`getDemoUser()`), så linket ændrer den
  bruger Profil viser. Skal migreres til rigtig session samtidig med
  `/api/profile` — ikke halvt.

## 2026-09-22: Forsidens tilføj-cirkel er lodret flytbar

- Den grønne cirkel kan trækkes lodret (kun Y) ved at tage fat uden for
  fingeraftryk-knappen; fingeraftrykket bevarer joystick-funktionen.
  Nederste grænse er altid bundnavigationens målte topkant, øverste grænse
  er top-baren. Ingen snapping.
- Y-position = CSS-px-offset fra standardpositionen i hero'en, gemt pr.
  enhed i localStorage (samme mønster som valg af side), altid re-clampet
  mod det aktuelle layout.

## 2026-09-22: Søvnmønster — separat "Arbejdstider i kalenderen"-toggle fjernet

- Den særskilte brugerindstilling `workHoursInCalendarEnabled` udgår: kortet
  "Arbejdstider i kalenderen" på Søvnmønster og det tilhørende onboarding-trin
  er fjernet, og feltet læses/skrives ikke længere af `/api/profile`.
  Genindfør det ikke — ældre krav (docs/UI.md, UI-KRAVSPEC, DESIGN_V2) om
  denne toggle er overskrevet.
- "Skiftende arbejdstider" (`shiftWorkEnabled`), konkrete `WorkShift`-
  registreringer, `/api/work-shifts` og søvn-overrides bevares uændret.
- Standard stå-op-/sengetid har hjælpeteksten "(Standard vist i kalenderen,
  kan ændres per dag)" under begge felter samlet.
- DB-kolonnen `users.workHoursInCalendarEnabled` står midlertidigt tilbage
  (ubrugt); fjernes i en senere migration.

## 2026-09-22: Målsætning — historiske, daterede målsætninger for vægt og kropsmål

"Mål" hedder nu "Målsætning" (for ikke at forveksle med Kropsmål). Profilens
Målsætning-knap åbner en oversigt (`/profile/goals`) med alle målsætninger,
nyeste øverst, grupperet under oprettelsesdatoen (fælles `SectionSeparator`);
"Opret ny målsætning" åbner formularen (`/profile/goals/new`) med Vægt øverst
og alle kropsmål nedenunder. `/profile/target-weight` redirecter hertil.

- Datamodel: `Goal` (userId, createdAt) + `GoalTarget` (type = "weight" eller
  et BodyMeasurement-feltnavn, value, unit, startValue, direction,
  completedAt). Én Goal pr. oprettelse; rækker slettes/overskrives aldrig.
- Kropsmålslisten har én kilde: `src/lib/body-measurements.ts`, brugt af både
  Kropsmål-siden og Målsætning.
- Retning gemmes ved oprettelsen fra seneste registrerede værdi (vægt:
  seneste vejning, ellers profilens startvægt). Uden historik udfyldes
  startværdi/retning af første måling efter oprettelsen.
- Gennemført beregnes server-side (`src/lib/user-goals.ts`) ved hentning af
  oversigten: første måling efter oprettelsen, der når målet i den gemte
  retning, sætter `completedAt`, som aldrig ryddes igen.
- `User.targetWeightKg` bevares og sættes til nyeste vægt-target (Hello Doc
  læser det). Migrationen backfiller eksisterende målvægte som en historisk
  målsætning.
- Formularen har en eksplicit "Gem målsætning"-knap (undtagelse fra
  auto-gem-reglen): det er oprettelse af en samlet, dateret post, ikke
  redigering af en indstilling — samme mønster som opret-ret.

## 2026-09-23: Målsætningsdato på målsætningen

"Opret ny målsætning" har nu en påkrævet målsætningsdato øverst (dato →
målvægt → kropsmål i 2 kolonner); topbjælken hedder "Opret ny målsætning".

- Datoen gemmes på `Goal.targetDate` (nullable), ikke på `User`: hver
  historisk målsætning har sin egen dato. Ældre/backfillede målsætninger har
  ingen dato. Et forslag om `User.targetDate` blev bevidst ikke fulgt.
- Kalenderdato: klienten sender "YYYY-MM-DD", serveren gemmer kl. 12:00 UTC,
  så datoen ikke skifter ved tidszonekonvertering. Datoer før i dag afvises
  (med én dags slæk for tidszoner foran UTC).
- Native date input; hele feltet åbner vælgeren, tomt felt viser "Vælg dato".
- Oversigten viser "Nås senest {dato}" under oprettelsesdatoen.

## 2026-09-22: Global tidspunkt-regel — let separator, "Kl." foran tiden

Bindende UI-regel: redigerbare tidspunkt-sektioner vises aldrig mere som den
tunge beige bjælke ("Tidspunkt 05.28"). De bruger altid den fælles
`src/components/hf/TimeSection.tsx`: en centreret "TIDSPUNKT"-overskrift
mellem to ubrudte (ikke stiplede) streger i separatorfarven `hf-tan-dark`,
ca. 80 % af indholdsbredden, uden baggrund/container, og under den værdien
som "Kl. 05.28" (ikke fed). Eksisterende tidsformat, state og time-input
bevares. Gælder ikke historiske timestamps, lister, admin-tabeller,
"sidst opdateret"-metadata eller felter med egne labels (fx vågen-/sengetid
på søvnprofilen).

## 2026-09-22: Skift adgangskode (Profil → Skift adgangskode)

`/profile/change-password` + `POST /api/profile/change-password`. Brugeren
identificeres kun via den rigtige brugersession (`getSessionUser()`, ikke
demo-brugeren); body indeholder kun `currentPassword`/`newPassword`. Samme
bcryptjs cost 12 og 8-tegns-minimum som register/reset. Forkert nuværende
adgangskode tæller i den eksisterende in-memory `rate-limit.ts` (nøgle
`change-password:<userId>`). Databaseopdateringen er autoritativ; derefter
lægges en `PASSWORD_CHANGED`-sikkerhedsmail (nyt `MessageEvent`, link til
`/forgot-password`, aldrig adgangskoder) i den eksisterende
`queueMessage()`-kø — en fejl her logges men returnerer stadig success.
Andre aktive sessioner invalideres ikke: brugersessionen er en stateless JWT
uden revokeringsmekanisme, og at tilføje en er bevidst uden for scope.

## 2026-09-22: Produktside — energifordeling er låst som standard (UI-lås + reset)

Direkte brugerønske. På `/add/[id]` vises en outline-hængelås (Tabler
`IconLock`/`IconLockOpen`, ingen baggrund) yderst til højre i
"Energifordeling"-headeren. Siden starter altid låst: makro-sliderne
(`MacroSliderBar`, ny `disabled`-prop) viser værdierne normalt, men kan
hverken trækkes eller redigeres. Tryk på låsen låser op og tager et snapshot af
den aktuelle `macroOverride`; det eksisterende reset-ikon (`IconRefresh`, samme
som BottomNav's "Nulstil menu") vises til venstre for den åbne lås og gendanner
snapshottet uden at låse igen. Låsen er ren UI-state — aldrig gemt, ingen
migration; reload starter låst igen.

Indholdsfortegnelsen er i dag ren tekst uden redigering på denne side, og der
findes ikke et admin-review-flow for brugerændrede næringsværdier her
(makro-ændringer går kun i registreringens snapshot). Låsen er derfor den ene
fælles lås, som et fremtidigt ingrediens-/review-redigeringsflow skal gates
bag — der er ikke opfundet et nyt flow.

Samtidig: Hello Cal-logoet på produktcirklen har ikke længere hvid cirkel/skygge;
det ligger i front (`z-10`) med nederste venstre hjørne i cirklens bundpunkt og
en bredde på én radius (95px).

## 2026-09-25: Statistiksidens grafer kan redigeres som kortene

Graferne øverst på statistiksiden er nu et eget, brugerstyret layout
(`src/lib/stat-charts.ts`, localStorage-nøgle `hellocal.statistik.charts`,
standard: "Kalorier og vægt" + "Kalorieindtag i løbet af dagen"). Et langt
tryk får dem til at vibrere som statistik-kortene; i redigering kan en graf
fjernes med slette-cirklen og trækkes op/ned (`StatChartsSection.tsx`). Nye
grafer tilføjes fra `/statistics/unused-charts`, der har samme opbygning som
`/statistics/unused-cards` (søgefelt på tværs af blokkene, hvis resultater
står over accordions, og "+ Tilføj" i højre hjørne af hvert enkelt kort/graf,
som tilføjer netop det ene element). Rettet 2026-09-26 efter brugerens
afvisning: der er ingen "tilføj alle"-knap på accordion-overskrifterne —
elementer tilføjes kun ét ad gangen. Der opfindes ingen nye datatyper: de
ekstra grafer er 7-dages dagsserier af felter, som allerede findes i
`DailyTotal`, med statistik-kortenes navne og enheder.

"+ Tilføj kort" over hhv. graferne og kortene vises kun, mens den sektion er i
redigeringstilstand (vibrerer) — eller er helt tom, så brugeren aldrig kan
låse sig ude.

## 2026-09-25: Global markeringsregel — intet kan markeres i appen

Bindende produktbeslutning: intet i Hello Cal kan markeres — hverken tekst,
kort, billeder eller knapper — og iOS' long-press-menu (Copy/Look Up/Share,
billed-callout) må ikke vises. Reglen håndhæves globalt i
`src/app/globals.css` (`user-select: none` og `-webkit-touch-callout: none` på
`html`, `body` og alle efterkommere samt en gennemsigtig `::selection`) og
som sikkerhedsnet af en `selectstart`-lytter i
`src/components/GlobalClipboardGuard.tsx`. Eneste undtagelse er `input`,
`textarea` og `[contenteditable="true"]`, som skal kunne markeres, ellers
virker fokus, markør og redigering ikke på iOS; copy/cut/paste er dér stadig
blokeret af clipboard-reglen nedenfor. Nye komponenter må ikke slå
markering til igen (fx med `select-text` uden for felter) uden en eksplicit
senere produktbeslutning.

## 2026-09-22: Global clipboard-regel — ingen copy, cut eller paste i appen

Bindende produktbeslutning: Hello Cal tillader ikke copy, cut eller paste i
brugergrænsefladen. Reglen håndhæves globalt af
`src/components/GlobalClipboardGuard.tsx`, som er monteret én gang i
`src/app/layout.tsx` (capture-lyttere på `copy`, `cut`, `paste`, `drop`,
Ctrl/Cmd+C/X/V, Shift+Insert og `beforeinput` af paste/drop/cut-typer), plus
`-webkit-touch-callout: none` på `input`, `textarea` og
`[contenteditable="true"]` i `globals.css` mod iOS' long-press-menu. Reglen
gælder automatisk alle eksisterende og fremtidige input-, textarea- og
contenteditable-felter samt øvrige steder, hvor clipboard-handlinger ellers
kunne udføres. Nye komponenter må ikke omgå reglen (fx med lokale
`onPaste`/`onCopy`/`onCut`) uden en eksplicit senere produktbeslutning.
Almindelig indtastning, markørflytning, sletning og autofill påvirkes ikke;
derfor bruges `user-select: none` ikke på felter. App-initierede
"kopiér link"-knapper (`navigator.clipboard.writeText` i invite/forward) er
ikke brugerens clipboard-handling og er uændrede.

## 2026-09-22: Originale produktimportfelter er permanent skrivebeskyttede

Ved al oprydning, berigelse og efterbehandling af produktfiler må de originale
kilde- og importfelter kun læses som reference og **aldrig redigeres**. Det
gælder altid `Product Name`, `Original Title` og `Subtitle` samt tilsvarende
originale felter med produkt-/kildelinks, billedlinks og billedstier, herunder
`Source URL`, `Image File` og `Image URL`. Afledte oplysninger skal skrives i
andre, særskilte kolonner. Reglen gælder globalt på tværs af leverandørfiler,
også når en ønsket datarensning ellers kunne udføres direkte i et originalfelt.

## 2026-09-19: Admin "Søgealgoritmer" — tunable ranking weights, region-brand popularity, and personal search/click history (reverses the earlier anonymous-only search-stat principle)

Direct user request: a new admin subpage, Søgealgoritmer, where the admin can
turn secondary search-ranking parameters up/down, with a search field + region
dropdown at the top for a **live** test of the effect, sliders grouped into
dropdown accordions, and (clarified via follow-up questions before building)
a "Commit" button plus a backup/restore history — draft weights are only
tested live in the admin panel until committed, and every commit keeps the
previous version rather than overwriting it.

- **Text similarity stays the fixed, non-tunable base of the score** — this
  page only exposes the *secondary* signals, matching the existing 2026-09-19
  "text match is always dominant" principle in `src/lib/product-search-ranking.ts`.
  Nothing here lets an admin make a wrong product outrank a clear text match.
- New `SearchRankingWeights` type + `DEFAULT_SEARCH_RANKING_WEIGHTS`
  (`src/lib/product-search-ranking.ts`): `regionalPopularity`/`timeOfDay`/
  `regionEan` default to the exact previous hardcoded values (18/4/12), so an
  empty/unreachable config table changes nothing. Three genuinely new
  signals — `verification`, `regionBrand`, `personalHistory` — default to 0
  (off) until the admin explicitly turns them on, and `genericVsProduct`
  (signed, favors products vs. generic ingredients) defaults to neutral (0).
- **Commit/backup versioning**: new `SearchRankingConfig` model
  (`weights` Json, `isActive`, `note`, `createdById`). Every commit inserts a
  new row and flips the previous active row to inactive — never overwritten,
  never deleted — so the admin page's history list doubles as the requested
  backup, and "Gendan" (`POST /api/admin/search-ranking/[id]/restore`) just
  re-commits an old row's weights as a fresh active version.
  `getActiveSearchRankingWeights()` (`src/lib/search-ranking-config.ts`) is
  read by the real `/api/products` and `/api/generic-ingredients` search
  routes on every request — a committed change takes effect immediately, no
  caching layer, no deploy needed.
- **Live test tool** (`POST /api/admin/search-ranking/preview`) runs the
  exact same `rankProducts()` end users get, but against the *draft* (not
  yet committed) weights, and — since production still queries Product and
  GenericIngredient through two separate endpoints — merges both into one
  ranked list so the "Generiske ingredienser vs. varer" slider's effect is
  actually visible. This preview never writes impression/click counters.
  `rankProducts()` now also returns a per-signal `breakdown` (raw values
  before the weight multiply) so the admin can see *why* something ranked
  where it did, not just the final score.
- **"Er verificeret med stregkode, mindst 2 billeder, varedeklaration og
  energifordeling"**: computed on read (`deriveIsVerified()`), not stored —
  barcode present + ≥2 `ProductImage` rows + an `AiProductAnalysis` row of
  kind `INGREDIENTS` *and* one of kind `NUTRITION` linked to the product
  (i.e. a real guided-flow photo was analyzed for both, not just typed text).
  A manually-typed or Frida/HelloFresh-imported product is never "verified"
  under this definition — that is the point of the signal.
- **New `BrandRegionSearchStat`** (region-scoped popularity of a *Brand*,
  not a single product) feeds "Region-specifikke brands/mærker". Same
  aggregate-only shape as the existing `ProductRegionSearchStat`, incremented
  alongside a product's own region stat on every search impression/click
  that has a brand.
- **"Generiske ingredienser vs. varer"**: a flat, signed `entityBias` on each
  candidate (-1 Product, +1 GenericIngredient) multiplied by this weight.
  Real and wired into both `/api/products` and `/api/generic-ingredients`
  ranking, but production still shows the two as separate result lists (the
  Foods/search UI was not changed to merge them) — the bias only has a
  visible combined effect in the admin preview above, until/unless a future
  task actually asks for one merged end-user result list.
- **Personal search/click history — explicit reversal of the 2026-09-19
  "aggregate/anonymous-only, never a user id" search-stat principle.**
  Clarified directly with the user before building: the benefit to the user
  (not re-typing/re-finding the same product every time) requires storing it
  per-user, not just per-region. New `UserProductSearchHistory`
  (`userId` + one of `productId`/`ingredientId`/`genericIngredientId`,
  `searchCount`/`clickCount`) — written by `/api/products`, `/api/generic-
  ingredients`, and `/api/products/search-event` whenever a *real* session
  user (never the shared demo user) searches/clicks. Feeds the "Personligt
  tidligere søgte produkter" weight (defaults to 0/off) via
  `personalSearchCount`/`personalClickCount` on `RankableProduct`.
  **Erasure**: `anonymizeUser()` (`src/lib/gdpr.ts`, "Ret til at blive
  glemt") now also fully deletes every `UserProductSearchHistory` row for
  that user — not just anonymizes it, since none of the historical-snapshot
  reasons that protect `Registration` etc. apply here.
  **Not built this pass, explicitly flagged rather than silently added**:
  `docs/UI.md:40`/`:125` already describe a "Privatliv" menu item and a
  per-user on/off toggle for "personlig historik/favoritter/hyppighed" in
  search ranking — there is still **no real `/privatliv` settings page or
  self-service toggle anywhere in the app** (confirmed: no route exists).
  The only way to stop/erase this data today is the existing admin-triggered
  "Ret til at blive glemt" flow (`/admin/users` → `anonymizeUser()`), which
  does erase it fully, but is not a self-service opt-out. Building the
  actual Privatliv settings page is out of scope for this change (a much
  larger, separate UI task) and is recorded here so it is not forgotten.

`npx prisma validate`/`generate`, `npm run lint` (whole repo, clean) and a
full `npx tsc --noEmit` pass (whole repo, clean) all passed. `npm run build`
could not be completed as a single clean run in this session: two *other*,
unrelated concurrent sessions were actively editing overlapping admin/AI
files throughout (a quality-control image-match feature adding
`AiProductAnalysis.imageUrl`/`BARCODE` and a new `/admin/quality-control`
page) — confirmed via `git status`/`git diff` each time a build error
appeared that the failing file/line belonged to that other work, not this
change, before moving on rather than fixing or waiting on it. The last
`npx tsc --noEmit` re-run (after their schema/enum edits landed) showed
exactly one remaining error, in `src/app/admin/quality-control/page.tsx`
referencing a `QualityControlTable` component that session had not yet
created — still their in-progress work, not this one's. Not verified in a
live browser: no reachable local PostgreSQL in this environment, and the
admin login/session setup needed to reach `/admin/search-ranking` was not
available to exercise interactively from this workstation either.

## 2026-09-19: Billed-metatags — tags lever på billedet, ikke på produktet

- **Metatags i stedet for et fast produktfelt**: et billede kan tagges
  `"Multiple"` (viser flere eksemplarer, fx flere æbler) og/eller `"Raw"`
  (rå/fersk, fx råt kød), som en fri `String[]`-liste på selve billedrækken
  (`ProductImage.tags`, samt de to nye galleri-modeller `IngredientImage`/
  `GenericIngredientImage`, se `docs/STATUS.md` samme dato). **Eksplicit
  brugerbegrundelse**: "Det skal ikke være knyttet op på selve produktet jo!
  For det kan være i en pakke når man scanner det, men når man tilbereder det
  er det det ikke." — samme vare kan altså have flere billeder med forskellig
  kontekst, og valget sker pr. billede, ikke som et fast felt på
  `Product`/`Ingredient`/`GenericIngredient`.
- **Gælder alle tre vare-typer** (`Product`, `Ingredient`, `GenericIngredient`)
  — brugerens eget argument: "ellers kan systemet ikke kende forskel mellem
  dem". Hver af de tre beholder sit eksisterende enkelte `imageUrl`-felt som
  det utaggede standardbillede; taggede varianter ligger i et lille galleri
  ved siden af (samme mønster `ProductImage` allerede brugte for "øvrige
  billeder").
- **"Raw" er koblet på ved tilberedning nu**: når en vare tilføjes til en
  ret/opskrift (`/opret-ret`, `?for=ret`), foretrækkes et `"Raw"`-tagget
  billede frem for standardbilledet (`src/lib/image-tags.ts`,
  `selectRawContextImageUrl`) — almindelig logning af et allerede spist
  måltid viser fortsat standardbilledet uændret, per brugerens egen
  beskrivelse af hvornår hvert billede hører til.
- **"Multiple" er kun data-laget indtil videre — ikke den mængde-baserede
  auto-visning.** Brugeren bad eksplicit om at vente med selve opgaven
  ("Vent med opgaven, men sæt den på roadmap") og satte den på roadmap i
  stedet, fordi det først kræver en beslutning om, hvordan en vares "normale
  maksstørrelse" fastsættes (endnu intet datagrundlag til at udregne det
  automatisk). Se `docs/STATUS.md`s "Next work" for samme dato.
- **Admin-skriveflade kun bygget for `Product`** (den eneste af de tre, der i
  forvejen har en billed-administrationsside, `ProductImageGallery.tsx`).
  `Ingredient`/`GenericIngredient` fik kun datamodellen — ingen ny
  admin-side blev bygget for at tagge deres billeder, da det ville være en
  ny administrationsflade, der ikke var bedt om; flagget som opfølgning i
  stedet for gættet på.

## 2026-09-19: Alternative kalorievisninger (per glas/skive/stk.) gemmes og vises; usikre AI-fund går til admin som fejlrapport

Direct user request: gem ekstra felter for alternative kalorievisninger (fx
"per glas (25 ml)", "per skive", "per styk") ud over vægt/mængde, vis dem —
hvor data findes — under valgmulighederne på produktet man tilføjer, og lad
billedegenkendelsen læse dem fra emballagen. Hvor noget er fundet men er
usikkert, skal det indgå i den admin-fejlrapport, der allerede findes fra det
tidligere AI-produktgenkendelses-arbejde (`/admin/bug-reports`).

- `/api/ai/extract-nutrition-v2` (2026-09-17-arbejdet) udtrak allerede denne
  præcise struktur (`NutritionAnalysis.alternativeServings`: label/amount/
  unit/kcal/confidence pr. fund), men den blev tidligere kasseret ved
  produktoprettelse. Genbrugt i stedet for at bygge en ny AI-prompt/skema.
- Ny `Product.alternativeServings` (Json, migration
  `20260919070000_alternative_serving_calories`, hand-written — ingen lokal
  database i dette miljø, samme som andre migrationer i denne fil): gemmer
  arrayet uændret. Kun vist for brugeren på `/add/[id]` (under den
  eksisterende "kcal/100g"-linje, ikke som et separat valg af mængde — jf.
  brugerens egen præcisering midt i sessionen) når `confidence >= 0.7` og
  `kcal` faktisk er sat (`src/lib/alternative-servings.ts`,
  `isAlternativeServingConfident`) — under tærsklen gættes/vises intet.
- **Usikre fund (under tærsklen) filer automatisk en AI-genereret
  `BugReport`** (`src/lib/alternative-servings-review.ts`,
  `flagUncertainAlternativeServings`, kaldt fra `POST /api/products`) i
  samme admin-kø som brugerens egne "Indberet fejl"-rapporter
  (`/admin/bug-reports`), i stedet for en ny separat admin-side — dette ER
  den "Lokal machine learning til produktvisning..."-agents admin-side,
  ikke en ny. Krævede `BugReport.userId` gjort valgfri + ny
  `BugReportSource` enum (`USER`/`AI`) på skemaet, da en AI-fil ikke har en
  indsendende bruger at kreditere/adressere. Godkendelse/afvisning
  (`src/lib/bug-report-approval.ts`) springer nu points/besked over, når
  `userId` er null; `PendingBugReportCard.tsx` viser "AI-genereret (ingen
  bruger)" i stedet for brugerens navn/e-mail og dropper points-teksten på
  knappen for disse rækker.
- Draften bærer feltet uændret gennem det eksisterende guidede flow
  (`src/lib/product-draft.ts` → `/camera/create` → `/product/create` →
  `POST /api/products`), samme mønster som `analysisIds`/`marketRegion` —
  ikke et redigerbart formularfelt, kun et transparent pass-through, siden
  det er AI'ens rå fund, ikke noget brugeren selv indtaster.
- Ikke bygget: en portions-vælger (fx "vis i skiver i stedet for gram") —
  brugeren præciserede eksplicit at disse værdier skal vises som ekstra
  linjer under standard-per-100g-tallet, ikke som et alternativt
  mængde-/registreringsvalg.

## 2026-09-19: Statistik-udvidelse — ingen opdigtede grænseværdier eller allergen-aggregater

Relayeret brugerkrav (via ChatGPT/Codex-handoff, se `docs/STATUS.md` samme
dato for den fulde implementeringsliste): tilføj Sport og aktivitet/Søvn/
Vitaminer og mineraler/Allergener og E-numre til Statistik, brug rigtige
grundstofsymboler, fjern de eksisterende opdigtede fallback-tal, og tilføj en
indstilling der giver statistikbokse en mørkerød kant, når en anbefalet
grænse er overskredet.

- **Ingen grænseværdier opdigtes.** `StatCardValue.outsideRecommendedRange`
  findes som et felt en fremtidig region/profil-bevidst evaluator kan skrive
  til, men ingen `compute()`-funktion i `src/lib/stat-cards.ts` sætter det.
  Den nye `warnOnRecommendedLimits`-indstilling (`/settings/display/limits`)
  og den røde `border-hf-red-dark`-kant i `StatCardsGrid.tsx` er derfor reelt
  klar UI-infrastruktur uden synlig effekt, indtil en sådan evaluator
  besluttes og bygges separat — det er en fremtidig opgave, ikke gættet nu.
- **Allergener/E-numre viser altid "—", ikke et rigtigt aggregat.**
  `Product.allergens`/`additives` findes pr. produkt, men `Registration` har
  ingen allergen-/E-nummer-snapshot-felt (kun næringssnapshot-felter). Et
  aggregat bygget på det *nuværende* produkt i stedet for et snapshot ville
  bryde registrerings-snapshot-princippet (AGENTS.md: "preserve snapshot
  semantics for registrations") — en historisk registrering ville kunne vise
  et allergen, der først blev tilføjet til produktet bagefter. At tilføje nye
  snapshot-kolonner er en mulig fremtidig udvidelse, men er en eksplicit
  skema-beslutning, der bør tages for sig, ikke som en biting af denne opgave.
- **`distanceKm`, ikke `DISTANCE_METERS`.** Den eksterne pakke forudsatte et
  nyt `DISTANCE_METERS`-felt, men samme dags tidligere arbejde (front-page-
  tal-slideren) havde allerede tilføjet `HealthMetricType.DISTANCE_KM` til
  præcis samme formål ("bevægelsesdistance"). Beholdt den eksisterende
  km-baserede metrik i stedet for at indføre to konkurrerende
  distance-repræsentationer.

## 2026-09-19: Generic (non-scanned) ingredients get their own database, separate from Product

Direct user request, clarified with three questions before building (see
`docs/STATUS.md` for the implementation write-up):

- Loose fruit/vegetable/meat items with no brand or packaging get a new,
  standalone `GenericIngredient` model — **not** the existing `Ingredient`
  model (which stays exactly what it already was: a HelloFresh recipe-image
  cache, not a loggable item) and **not** a repurposed `Product` row. The
  user explicitly chose "own database" over reusing either existing table.
- A generic ingredient has no energideklaration to read, so its per-100g
  macros are resolved **once, at creation time**, from the closest-matching
  FRIDA-imported reference product (`src/lib/generic-ingredient-match.ts`,
  looser matching than the guided-flow's ≥90% threshold, since Frida names
  are verbose). Copied onto the row rather than looked up live, so a later
  Frida re-import can't silently change an already-logged ingredient's
  numbers. An unmatched ingredient shows "Næringsindhold ukendt" — never an
  invented number, same convention as the 2026-09-19 `distanceKm` field.
- **Displayed through the exact same `/add/[id]` screen as an ordinary
  Product** (the user's explicit ask: "samme struktur i visning som øvrige,
  statiske produkter"), by having `GET /api/products/[id]` fall back to
  `GenericIngredient` when no Product matches the id, rather than building a
  parallel display page. The only visible differences are the ones that
  follow directly from having no brand/barcode: no brand line, no
  "report error" link, no favorite button (favoriting isn't wired up for
  ingredients yet — flagged, not built).
- `Registration` gained a `genericIngredientId` FK (alongside the existing
  `productId`/`dishId`) rather than forcing every logged ingredient through a
  synthetic `Product` row — this keeps the "own database" separation real
  instead of just cosmetic, while reusing the exact same snapshot semantics.
- **Region/country popularity linkage reuses the existing search/click-count
  pattern** (`GenericIngredientRegionSearchStat`, same shape as
  `ProductRegionSearchStat`/`IngredientRegionSearchStat`), per the user's own
  choice — not a manually curated "this ingredient is popular in these
  countries" list. Ranking goes through the same
  `src/lib/product-search-ranking.ts` used for product search.
- Not built this pass: making generic ingredients discoverable through
  `/foods`/`/search` (only reachable immediately after creation right now)
  and favoriting. Both are natural next steps, not silently skipped forever.

## 2026-09-19: Manual food creation now asks "Ingrediens eller Produkt?" first

`src/app/foods/new/page.tsx` (reached from the "Manuelt" tile in
`/create-dish` and elsewhere) now shows a top-level choice before any form:
"Ingrediens" (see the GenericIngredient decision above) or "Produkt" (the
pre-existing manual-product form, direct user request). The Produkt branch
gained **brand/subbrand** text fields, per the user's explicit ask that
manually-created products carry the same brand/subbrand structure as products
from the guided barcode-first flow (2026-09-17) — `POST /api/products`
already accepted these fields from that flow, so no backend change was
needed, only the missing form fields on this older, simpler screen.

## 2026-09-19: Regional product/ingredient search ranking, integrated from a ChatGPT-prepared handoff package

User requirement (verbatim spec pasted from a ChatGPT conversation, then a
second message with the actual code as a downloadable
`hellocal-search-ranking-code.zip`, following the same handoff pattern as the
2026-09-17 barcode-first entry below): search/autosuggest should weight
text match, regional popularity (searches/clicks per region), GS1
origin/market relevance, and time-of-day×region click patterns — with text
match always dominant, and low-regional-popularity products required to have
more typed characters and a higher text similarity before they can surface.
Live autosuggest should start at 2 typed characters and show a cached result
instantly while revalidating live. None of this may ever be exposed to the
end user — it's ranking input, not a visible field/badge.

Integrated against the actual current `master` (the handoff's own stated
base commit, `097fca5`, was already several commits behind by the time this
was applied — re-checked every target file's real current content rather
than blindly applying the package's patches).

- New hidden `Product.originCountryCode`/two new stat model pairs
  (`ProductRegionSearchStat`/`ProductRegionHourStat`,
  `IngredientRegionSearchStat`/`IngredientRegionHourStat`) — aggregate
  region-scoped counters only, never a user id or raw query text. Migration
  `prisma/migrations/20260919000000_product_search_ranking`.
- `src/lib/product-search-ranking.ts` (`rankProducts`): text similarity via a
  prefix/substring/Dice-bigram cascade is the base score; regional
  popularity, hour-of-day popularity and a GS1 origin boost only add on top
  of that, and a product below a similarity/character-count threshold is
  dropped outright regardless of popularity — a popular-but-wrong product can
  never outrank a clear text match.
- `src/lib/regions.ts`: new `inferGs1OriginCountryCode()` — a single-value
  origin/market code (or `"US_CA"` when the GS1 prefix is ambiguous, `null`
  otherwise), distinct from the pre-existing `gs1RegionCandidates()` (which
  returns every matching region for OCR-language fallback). Same caveat as
  that function: a GS1 prefix is an issuance/market signal, not proof of
  physical manufacturing origin — must never be shown as such in the UI.
  Set on product creation in `/api/products` (POST + the Open Food Facts
  live-import helper) and `/api/products/lookup/[barcode]`.
- `/api/products` GET: autosuggest returns `{ products: [], minQueryLength: 2
  }` for a 1-character query; a 2+ character query without `?source=` now
  also matches on brand name (not just product name), ranks a wider
  candidate pool (up to `take * 6`, min 80) through `rankProducts()`, and
  records a regional search-impression per returned product. Every response
  strips `regionSearchStats`/`regionHourStats`/`originCountryCode` before
  returning — this is enforced in the route itself, not left to callers.
  `?source=HELLOFRESH` (dish browsing) is deliberately excluded from ranking
  and impression-tracking, unchanged from its prior plain name-match+
  createdAt-desc behavior.
- New `POST /api/products/search-event`: records a click (product or
  ingredient, region + local hour) when a search result is opened. No
  session is required (falls back to the shared demo user, same pattern as
  other unauthenticated read paths in this app).
- `/foods` (`src/app/foods/page.tsx`): replaced the old
  "fetch-all-then-filter-client-side" search (which only ever searched
  whatever the initial unfiltered `/api/products` fetch happened to return)
  with real per-query calls to the ranked endpoint — 140ms debounce, a
  module-level 5-minute-TTL cache for the instant/cached-then-revalidate
  behavior, and a `sendBeacon`-based `search-event` call when a search result
  row is opened. The instant-cache read is a plain derived value (no
  `setState` inside the debounce effect for that path — the project's React
  compiler enforces effect purity/no-synchronous-setState-in-effect; see the
  file for the pattern), since a bare `Date.now()`-gated cache check inside
  render/`useMemo` is also rejected as an impure render.
- **Not built in this pass, out of scope for the handoff as scoped**: the
  admin "Søgealgoritmer" page the user described (to view/tune the ranking
  weights live) — mentioned only as a future destination for these weights
  in the ChatGPT conversation, not part of the delivered code package.
  Region×hour cross-tabulation is stored (`ProductRegionHourStat`) but has no
  admin-facing view yet.
- Verified: `npx prisma validate`/`generate`, `npm run lint` (repo-wide,
  clean), `npm run build` (full TypeScript + all routes, clean, including the
  new `/api/products/search-event` route) — see `docs/STATUS.md` (2026-09-19)
  for the full write-up. **Not verified against a live database** — same
  recurring `hellocal_no_local_db` constraint as most other entries in this
  file; the ranking/impression-tracking/click-tracking behavior should be
  exercised against real search traffic before trusting the weights.

## 2026-09-18: Front-page joystick wheel becomes user-configurable; new all-elements screen

- The front page's joystick wheel (`AddButton.tsx`) is no longer a fixed set
  of 6 actions. Its top slot is now permanently a "list" action opening a
  new `/add/menu` screen listing every add-element in the app
  (`src/lib/add-actions.ts`'s `ADD_ACTIONS` catalog); the remaining slots
  (up to 5) are whichever catalog entries the user picked under
  Settings → Visning → Forside (`src/app/settings/display/front-page/page.tsx`).
  See `docs/STATUS.md` (2026-09-18) for the full build/verification writeup.
- **This selection is a per-device UI preference stored in `localStorage`
  (`hellocal.frontpage.wheelActions`), not the database** — deliberately
  matching the existing precedent set by the statistics page's card layout
  (`StatCardsGrid.tsx`). Do not migrate this to a `User` column without a
  fresh decision; the project's existing convention treats this class of
  preference (which cards/fields show, in what order) as local, not synced
  account state.
- Reading a `localStorage`-backed preference for a component that is part of
  a statically prerendered/hydrated route (like the front page) must use a
  `useSyncExternalStore`-based hook with `DEFAULT_WHEEL_ACTION_KEYS` as the
  server snapshot (`useWheelActionKeys()` in `add-actions.ts`) — a lazy
  `useState(() => loadFromLocalStorage())` initializer, while fine for a
  component only ever reached via client-side navigation, produces a real
  React hydration error the moment the saved value differs from the default
  on a route that's part of the initial server-rendered HTML. Apply this
  pattern to any future localStorage-backed preference read by something
  rendered on first paint of a prerendered route.
- `docs/UI.md`'s existing rule that the front page's half-circle button and
  wheel are exempt from the general HelloFresh visual-style migration is
  about visual styling only, not about freezing its feature set — this
  change adds behavior/configurability without altering its established
  visual language (same circles/icons/animation).

## 2026-09-17: Barcode-first guided AI product recognition

Top-priority task, built from a ChatGPT-prepared handoff package
(`HelloCal_OpenAI_ProductRecognition_Handoff_2026-09-16/`, kept as
reference only, excluded from lint). See `docs/STATUS.md` (2026-09-17) for
the file-level summary.

- **Flow**: `/camera/create` now scans the barcode first, always. A known
  barcode still redirects straight to the existing product. An unknown
  barcode derives a GS1 country-prefix signal (`gs1RegionCandidates` in
  `src/lib/regions.ts`) and freezes it, together with the user's market
  region, into the session draft (`src/lib/product-draft.ts`) — later
  photos (front/ingredients/nutrition) must never change this signal.
  Front photo extracts `brand`/`subbrand`/`productName`/`variant`/
  `packageSizeText`/`claims` as explicitly separate fields: brand is the
  commercial mark/logo, subbrand is the product line/family, productName is
  the item itself, variant is flavor/type/strength. This is a data/flow
  change, not a redesign — existing HelloFresh-style components/layout are
  reused throughout.
- **Language priority is a priority, not a whitelist**: market region (the
  user's own setting, never the phone's/browser's display language — see
  the 2026-09-12 entry below, which this extends rather than replaces) is
  the primary OCR/vision language signal; the barcode's GS1 prefix is a
  secondary/fallback signal. Low-confidence OCR/vision may still recognize
  other languages. Consolidated into `src/lib/regions.ts`
  (`gs1RegionCandidates`, `primaryOcrLanguages`) instead of keeping a
  second, separate region→language table in `barcode-context.ts` — that
  file is now a thin wrapper so there is exactly one source of truth for
  region/language mapping.
- **GS1 prefix is a registration/issuance signal, not a confirmed physical
  production country.** It is used only to prioritize languages, never
  stored or presented as a verified country of manufacture.
- **Ground-truth training data**: new `AiProductAnalysis` table
  (`prediction`, `correction`, `confidence`, `model`, `promptVersion`,
  `barcode`, `marketRegion`, `gs1Regions`, `languages`). Each guided-flow
  photo analysis writes a `prediction` row immediately; `POST /api/products`
  links the row to the created product and writes the user's final
  (possibly edited) values as `correction` — this is the actual mechanism
  the user asked to have made explicit and verifiable, since it's the
  foundation for later prompt evals/fine-tuning (`GET
  /api/admin/ai-training/export`, canonical JSONL, admin-only).
- **Brand normalization**: `POST /api/products` upserts `Brand` by exact
  name from the (possibly user-corrected) brand text. A dedicated
  `BrandAlias` table for real aliasing (e.g. "Arla Foods" → "Arla") is a
  known follow-up, not built here — see `docs/STATUS.md`.
- **Model**: `OPENAI_PRODUCT_VISION_MODEL` (default `gpt-5.6-terra`),
  reusing the existing `OPENAI_API_KEY`, kept as its own env var so the
  model can be A/B-tested without a code change. Verified via web search
  (2026-09-17) to be a real, current OpenAI model name — it initially looked
  fabricated (outside this session's training data) but is not.

### Explicit temporary dispensations (user-approved 2026-09-16/17) — must be revisited

The pre-existing 2026-09-12 decision below established "local OCR/regex
first, AI only as fallback" for both ingredients and nutrition in the guided
flow. For this integration, the user explicitly approved a **temporary**
reversal for both:

- `POST /api/ai/extract-ingredients-photo` and `POST /api/ai/extract-nutrition-v2`
  send the photo to AI vision as the **primary** reader; local OCR
  (`extractTextPrioritized` in `src/lib/product-ocr-prioritized.ts`) only
  runs as supporting context passed alongside the photo, not as a first
  attempt whose failure triggers AI.
- **Why**: the user wants a working prototype they can actually use/test
  now, rather than spending time first building the local-OCR-first
  intelligence. Their own words: this is a deliberate, temporary
  "dispensation", not a reversal of the underlying principle.
- **How to apply**: do not treat this as final architecture. Once the user
  has a working prototype and has tested it, revert both routes to
  "local OCR/regex first, AI only as fallback", matching the front-photo
  duplicate-search step (which still does local OCR first) and the
  2026-09-12 nutrition/ingredients pattern in `/camera/create`'s older
  stages. Track this reversal as outstanding work in `docs/STATUS.md` until
  it's done.

## 2026-09-14: Project boundaries before further feature discovery

- Prioritize agreeing work-project and folder boundaries for Hello Cal,
  admin, employee product creation and integrations. No physical split or
  deployment/database architecture has been approved yet.
- Confirmed employee-product workflow requirements and open questions are
  preserved in `PROJECT-BOUNDARIES.md`; they do not imply implementation.
- User explicitly paused detailed feature discovery to return to the split.

## 2026-09-13: ChatGPT context and handoff to Codex

- `docs/chatgpt/CONTEXT.md` maps the canonical product/design sources and current
  code structure; it supplements rather than replaces the existing contracts.
  `PROJECT-INSTRUCTIONS.md` is copied into the ChatGPT project's instructions,
  and `HANDOFF-TEMPLATE.md` defines a reviewable delivery with exact target paths.
- ChatGPT deliveries without local write access are files/patches for Codex to
  integrate against the current checkout. Read access to GitHub does not mean
  local changes have been made. Uploaded context is a dated snapshot.
- For this handoff workflow, integrated changes remain local and uncommitted by
  default. Commit, push and deployment require a separate user request. Preserve
  unrelated work, including changes in shared files; do not stage everything.
- Do not put loose TS/TSX draft copies inside the checkout: the current tsconfig
  includes them broadly. Use Markdown/patch deliveries or transport files outside
  the checkout until integration. New real pages belong in `src/app`.

## Product and data

- The product name is **HELLO CAL**.
- PostgreSQL is the primary database; Prisma is the application ORM.
- Registrations store nutrition snapshots so later product edits cannot alter historical records.
- HELLO CAL is the primary data source. Apple Health and Google Health Connect are write-only integrations as described in the specification.
- Product behavior and UI decisions in `docs/SPECIFICATION.md`, `docs/UI.md`, `docs/AI.md`, `docs/DATABASE.md`, `docs/BACKEND.md`, and `docs/ADMIN.md` take precedence over prototype placeholders.
- 2026-08-26: The simulated phone frame is a desktop presentation aid only.
  On phones and other coarse-pointer devices, the application fills the browser
  viewport without an outer frame, rounded corners, shadow, or mockup background.
- 2026-09-11: Hello Cal is now a proper installable PWA (`src/app/manifest.ts`,
  `src/app/apple-icon.png`, `appleWebApp`/`themeColor` in `src/app/layout.tsx`)
  so the app can match HelloFresh's native header height. In a normal browser
  tab, `.hf-appbar` (design.md §6.1) is unavoidably shorter than a native app's
  header, because the phone's own status bar (clock/battery) is drawn by the
  browser above the page and cannot be repainted with CSS — measured directly:
  the reference `Hello Fresh inspiration/Log-in.png` header is 100px
  (CSS px), ours was 52px with 0 safe-area-inset-top in that context. Only
  when a user adds Hello Cal to the home screen and opens it standalone does
  `apple-mobile-web-app-status-bar-style: black-translucent` hand the status
  bar area to the page, at which point `env(safe-area-inset-top)` (already
  used in `.hf-appbar`, design.md §6.1/§9.3) becomes non-zero and the green
  header genuinely extends behind it like the reference. This is intentionally
  not "fixable" by just enlarging `.hf-appbar`'s own height in CSS — doing
  that would either look wrong when a real safe-area-inset-top later stacks
  on top (double-tall header) or still not reach the real status bar in an
  un-installed browser tab.
- 2026-08-26: Voice registration shows the live transcript at the top below a
  stand-microphone status circle. The circle pulses while AI processes the
  speech; detected entries appear below in the daily-meal row style and can be
  edited before the user approves them.
- 2026-08-26: Voice capture uses the browser-provided Speech Recognition API in
  Danish as the first implementation step. It provides real microphone access
  and live transcription independently of HELLO CAL's later structured-food AI,
  with an unsupported-browser fallback instead of silently failing.
- 2026-08-26: Calendar success is deliberately understated: a completed day has
  a 1 px green border and a light-green checkmark in its upper-right corner.
  Today alone receives the solid green date treatment.
- 2026-08-26: Calendar navigation supports month, week, and list views. The
  period can be changed by horizontal swipe, arrow controls, or a year-aware
  month picker. Selecting any date opens its database-backed day view.
- 2026-08-26: The home-screen key-metric panel behaves as a vertical wheel.
  Swipe, scroll, adjacent-item taps, and keyboard arrows rotate calories,
  protein, water, calories burned, and steps through the emphasized center.
  Food-derived totals use today's registration snapshots.
- 2026-08-27: Supersedes the 2026-08-26 "visualizes success, not failure"
  principle for the calendar. The calendar now shows a calm red marker on
  days the goal was not met, alongside the existing green marker for days it
  was met. A star streak indicator (with a day count) appears once the goal
  has been met at least 5 days in a row and disappears immediately the streak
  breaks. No other badges or motivational messaging were added.
- 2026-08-27: A fullscreen first-run setup wizard (`OnboardingWizard`) was
  implemented for the three questions the user specified: sleep-pattern /
  shift-work / daily work-hours-vs-sleep-times logging preference, smartwatch
  health-data import, and work-hours-in-calendar. Only these are specified,
  so the wizard's step list (`ALL_STEPS` in `src/components/OnboardingWizard.tsx`)
  currently has 3–5 visible steps (shift-work and daily-log-preference are
  conditionally skipped), not the "10 trin" example in `docs/UI.md`. The
  remaining onboarding content (goals, activity level, etc. from
  `docs/SPECIFICATION.md` §5) is unspecified and must be added to the step
  list once decided — do not infer it. "Vis ikke igen" only appears after the
  user has chosen "Påmind mig senere" once, mirroring the existing forced
  onboarding modal's pattern.
- 2026-08-27: Unknown product barcodes are resolved through a deterministic
  fallback chain: HELLO CAL's own database, Open Food Facts, then USDA
  FoodData Central when `USDA_FDC_API_KEY` is configured. Imported products
  retain their external source, external id, and lookup timestamp. USDA data
  never overwrites an existing local product, and all external imports remain
  `PENDING` for the existing validation/admin flow.

- 2026-08-27: Danish generic-food data comes from DTU Fødevareinstituttet's
  Frida database, imported as `Product` rows with `externalSource='FRIDA'`
  and `status='APPROVED'` (no barcode). Frida's own site
  (`fcdb.fooddata.dk`) has no public reuse API — only an undocumented
  internal API behind its frontend, deliberately not used for anything more
  than confirming this. Instead, its dataset releases are published to
  DTU's official Figshare-based repository (`data.dtu.dk`), which has a
  real public, documented, unauthenticated, CC-BY-4.0 API
  (`api.figshare.com`, DTU Food's group id `18053`). `scripts/frida-import`
  (`frida-agent` service) polls that API on a schedule
  (`FRIDA_AGENT_POLL_INTERVAL_SECONDS`, default 24h), and — unlike the
  USDA/Open Food Facts barcode fallback — imports automatically as
  `APPROVED` without an admin review step, since it is DTU's own curated
  reference data rather than a single external contributor's submission.
  `frida_import_state` tracks which Figshare release has already been
  imported so the same version is never reprocessed.

- 2026-08-27: The calendar's landscape week timeline and day-detail timeline
  now render sleep as a light-grey background band (00:00–wake and
  bedtime–24:00) derived from `SleepSchedule`/`WorkShift`/`User` defaults.
  Holding the sleep/wake boundary line for ~0.5s and dragging adjusts the
  time (15-minute snap); releasing asks whether the change applies only to
  that date (`WorkShift` override) or the standing weekly pattern
  (`SleepSchedule`). See `docs/DESIGN_V2.md` §6 for the source spec.

- 2026-08-27: The admin product/image approval UI (docs/ADMIN.md) is served
  from the same codebase and deployment as the rest of the app, reached at a
  dedicated hostname (`adminhellocal.packroff.dk`) rather than a path on
  the public domain — `middleware.ts` rewrites that hostname's root to
  `/admin` and refuses `/admin/*` and `/api/admin/*` entirely on any other
  hostname (except `localhost` for local development), even though every
  route is also login-gated. There is still no general user account/login
  system (see "Next work" in `docs/STATUS.md`); this only adds the two
  `User` fields (`passwordHash`, `totpSecret`) needed for the single
  administrator account, created once via `/admin/setup` (blocked after the
  first admin exists). Login is password + TOTP (Google
  Authenticator/Authy-compatible, `otplib`), sessions are a signed JWT cookie
  (`ADMIN_SESSION_SECRET`, `jose`), and login/TOTP attempts are rate-limited
  in-memory per email/user. `/admin/produkter` approves or rejects new
  `ProductStatus.PENDING` products; `/admin/billeder` shows each
  `imageStatus = PENDING` product's current image beside the image-agent's
  `pendingImageUrl` suggestion (see the 2026-08-27 image-agent entry above)
  and promotes or rejects it.

- 2026-08-28: Added passkey (WebAuthn) login for the admin account as an
  alternative to password + TOTP — e.g. Face ID on iPhone via iCloud
  Keychain. `@simplewebauthn/server`/`@simplewebauthn/browser`; a new
  `Passkey` model (migration `20260828170000_admin_passkeys`) stores each
  credential. Registration (`/admin/passkeys`, `POST
  /api/admin/passkey/register/*`) requires an existing session — only the
  already-authenticated admin can add a new device — and uses a discoverable
  credential (`residentKey: "required"`) so login doesn't need an email
  first. Login (`POST /api/admin/passkey/authenticate/*`, public, listed in
  `middleware.ts`'s public admin API paths) is usernameless: the browser/OS
  shows whichever passkeys it has for the site. A verified passkey assertion
  already proves possession plus biometric/PIN user verification, so it
  grants a full session directly, skipping the separate TOTP step — treated
  as equivalent strength to password + TOTP combined, not as a weaker
  shortcut. Relying-party ID/origin are derived from the request's
  `Origin`/`Host` headers rather than a fixed env var, so the same code
  works on `adminhellocal.packroff.dk` and `localhost`. `/admin/setup`
  now signs the new admin straight into a session after TOTP confirmation
  (previously redirected to `/admin/login`) so they can add a passkey
  immediately without a second login round-trip.

- 2026-08-28: Admin UI v2 design (not yet implemented — currently a static
  HTML mockup only, no code): the default/only landing view is "Nye
  produkter" in reverse-chronological order — no separate dashboard/start
  screen. Each product row expands (on image click) into two image rows —
  top 5 highest-scoring "primær" candidates (front-of-package, meets the
  background/quality bar, used as the profile photo) and up to 5 "sekundær"
  images (no background requirement) — drag-reorderable, each with a
  checkbox ("brug billede") and a ⋮ menu (Slet / Send til revision). An
  image sent to revision moves to a new "Billeder til gennemgang" page
  (placeholder for now) and is expected to come back and update the product
  automatically once manually processed (e.g. background removed in
  Photoshop) — this is a *conditional* approval, not a rejection. A new
  "Billeder" page lists every submitted image across all products, sortable
  by an AI-assessed quality score (0–100%, threshold-based status) alongside
  product/type/status — the AI scoring model/pipeline itself is not yet
  designed. Each product also has a ⋮ menu: Afvis (rejects — does **not**
  retroactively affect any user who already logged the item, and does not
  create the product in the shared database), Godkend, and Betinget
  godkendt (opens a note field + SEND; the product stays in the database but
  moves to a new "Betingede godkendelser" page — placeholder for now —
  pending revision).
- 2026-08-28: **Product edits must not retroactively change historical data**
  other users already logged — this is already true today (registrations
  snapshot nutrition values, see the top of this section) and stays true by
  default. A new admin setting is planned — "Overskriv tilføjede produkter
  ved ændringer og opdateringer i databasen" (on/off) — that, when enabled,
  would deliberately let a product edit retroactively update existing users'
  logged registrations instead of only affecting future ones. Not yet
  implemented; default must be **off** (preserve current snapshot behavior)
  until this setting exists.

- 2026-08-28: **Correction, overrides any contradicting guidance given earlier
  (in this file or verbally to other agent sessions):** screens/windows and
  their headers fill the entire viewport edge-to-edge, matching the HelloFresh
  app — never inset with a visible margin or frame around them (the desktop
  `PhoneFrame` presentation aid is unaffected, see 2026-08-26). The
  profile/user-menu circle moves from the top-right to the **top-left** corner
  of the standard top bar, because the top-right corner is needed for a
  close-cross (×) on pages that can be closed — there is no room for both in
  the same corner. This supersedes the earlier `docs/UI.md` claim that there
  is no separate close-cross on the persistent frame. See `docs/SPECIFICATION.md`
  §6 and `docs/UI.md`'s Navigation/Layout-konsistens sections.

- 2026-08-28: Health-API integration strategy, chosen with the user before
  implementation started: **Fitbit and Withings get real, working OAuth2
  integrations now** (both have genuine cloud APIs). **Apple Health, Apple
  Watch, Garmin, and Google Health Connect are shown as disabled "kommer
  snart" cards with no live connection** — Apple Health/Health Connect
  cannot be read by a plain web app at all (HealthKit/Health Connect are
  native-only; there is no cloud REST API Apple or Google expose for
  third-party reads), and Garmin's Health API requires a separate business
  partner application. A future connection to those either needs a native
  companion app or a paid third-party aggregator (Terra/Vital/Spike) — not
  decided, and out of scope for this batch. See `src/lib/integrations.ts`
  (`INTEGRATION_CATALOG`, `connectable` flag) and the `Integration` Prisma
  model.
- 2026-08-28: Sport/activity data (`Activity` model) and its calendar/
  statistik surfacing (icon + green bonus calories on the calendar; dynamic
  `sport:<type>` stat cards) are only shown when the user has at least one
  *connectable* integration (Fitbit/Withings) actually `CONNECTED` — not
  merely because `Activity` rows exist. This matches the user's own framing
  ("HVIS integrationerne er slået til").
- 2026-08-28: "Trendvægt" (AI-estimated weight, `docs/SPECIFICATION.md` §5)
  is computed on-the-fly from `WeightEntry` + `Registration` timestamps
  (`src/lib/weight-trend.ts`) — separate exponential smoothing for morning
  vs. evening weigh-ins, nudged down slightly when food was logged within
  ±2h of the weigh-in. It is deliberately plain TypeScript, not a Python/ML
  service, since the underlying method is simple statistical smoothing, not
  a trained model — revisit only if a real model is later warranted. It is
  never stored as its own `WeightEntry` row, to keep measured data
  unpolluted; needs ≥5 samples before it is shown at all.
- 2026-08-28: The calendar day-detail timeline's long-press vocabulary is
  gesture-specific, refining (for calendar rows only) the older general rule
  in `docs/SPECIFICATION.md:26`/`docs/UI.md:27` ("langt tryk = tilføj som ny
  registrering") — that rule was never actually implemented for calendar
  entries. Holding an entry now arms "move" mode (drag to retime, shown via
  a live `HH:MM · title` label, committed on release through the new
  `PATCH /api/registrations/[id]`); a plain tap still opens the
  registration's detail page. A two-finger vertical drag on the day
  timeline zooms it (up to 4×, persisted per-browser in `localStorage`) to
  reveal 15-/5-minute gridlines and per-registration markers, which only
  render once zoomed — at the default zoom level the timeline still shows
  only the existing per-hour aggregate, unchanged.

- 2026-08-28: **HealthKit/Health Connect as the future integration hub**
  (user-directed, based on a ChatGPT architecture discussion the user
  relayed): rather than building a direct API integration per device brand,
  a single future native iOS companion app (HealthKit) and Android companion
  app (Health Connect) would each read whatever the user's devices already
  sync there (Apple Watch, Fitbit, Garmin, smart scales, etc.) and relay it
  to HELLO CAL's own backend — see the new `docs/SPECIFICATION.md` §4
  wording and `docs/HEALTHKIT_COMPANION.md`. This does **not** replace the
  direct Fitbit/Withings OAuth integrations already built (2026-08-28,
  above) — those remain independently useful for a user who doesn't want to
  install anything beyond the web app. Building the actual native app is a
  separate project requiring a Mac + Xcode (+ an Apple Developer Program
  membership) that could not be done from this session; what *was* prepared
  ahead of time, so the backend is ready the moment such an app exists:
  - `DeviceToken` model + `POST /api/integrations/healthkit/tokens`
    (create/list) and `DELETE .../tokens/[id]` (revoke) — a personal,
    SHA-256-hashed bearer token, generated from the Integrationer page
    ("Generér enhedskode"), shown once.
  - `HealthMetric` model (generic `type`/`value`/`recordedAt`, one row per
    day for cumulative types) for data that doesn't fit `WeightEntry`/
    `Activity` — steps, active/resting energy, heart rate, sleep minutes,
    body fat %, height, BMI, water.
  - `POST /api/integrations/healthkit/ingest`, bearer-token authenticated
    (no user login exists yet to build a real OAuth flow against), accepts
    a batch of `metrics`/`weights`/`activities` tagged
    `source: APPLE_HEALTH | GOOGLE_HEALTH`.
  - The three previously-hardcoded Statistik placeholder cards (`steps`,
    `water`, `burned` in `src/lib/stat-cards.ts`) now read real averages
    from `HealthMetric` once any exist, falling back to the old placeholder
    text otherwise — no UI change until real data is actually ingested.
  - `docs/HEALTHKIT_COMPANION.md` documents the full contract (HealthKit
    type → `HealthMetricType` mapping, request/response shape, a minimal
    Swift reference snippet) for whenever the native app work starts.

- 2026-08-29: HelloFresh Danmarks recipe catalog is imported as ordinary
  `Product` rows (`externalSource='HELLOFRESH'`, `status='APPROVED'`, category
  "Retter") rather than a separate `Recipe` model — this makes every imported
  dish immediately searchable/loggable through the existing Madvarer/tilføj
  flow with no new UI. A new shared `Ingredient` model (category
  "Ingredienser") caches each unique HelloFresh ingredient's image once and
  reuses it across every recipe that contains it; `ProductIngredient` records
  each ingredient's raw amount, gram amount (when the unit is grams), and its
  proportion of the dish's total tracked weight — the concrete building block
  for later "how much did the bell pepper contribute" estimates. **Explicit
  user decision (asked before building, given this reverses the copyright-risk
  avoidance established for the image-agent/Frida sources): download and
  rehost HelloFresh's dish/ingredient photos as requested, accepting the
  copyright/ToS exposure** — "Det er en app til [mig] jeg er igang med at
  udvikle. Så bare fortsæt som jeg skrev."
  Four `Category` rows (Retter/Menuer/Ingredienser/Færdigmad) were seeded for
  internal scanning/filtering only, not shown in the UI; "Menuer" and
  "Færdigmad" are reserved for future use — nothing populates them yet.
  `scripts/hellofresh-import` (new `hellofresh-agent` service) crawls
  `sitemap_recipe_pages.xml` — the sitemap HelloFresh's own `robots.txt`
  explicitly links for crawling — rather than the "Se flere" pagination UI:
  that button calls an internal `recipe.search` API on a Kubernetes-internal
  hostname (`products-service.live-k8s.hellofresh.io`, private DNS only, not
  reachable outside their cluster) and the `?page=` URL parameter is itself
  disallowed by `robots.txt`. Each recipe's own public page embeds its full
  data (name, macros, ingredients with gram amounts, image path) in a
  `__NEXT_DATA__` script tag — the same public HTML any visitor's browser
  receives, no auth or private API involved. Re-import matches on `recipeId`
  and updates existing rows rather than duplicating; HelloFresh frequently
  re-publishes the same dish under a new `recipeId` week to week
  (`clonedFrom` in their data) — a full same-dish-across-reruns dedup chain
  was **not** attempted in this first version, so near-duplicate `Product`
  rows across reruns of a dish are a known limitation. Per-ingredient
  vitamin/mineral estimation (matching each ingredient against Frida data)
  was also not implemented yet — Frida import currently only stores the four
  core macros (see the 2026-08-27 Frida entry above), not vitamins/minerals,
  so there is nothing yet to match against; the gram/proportion data this
  import produces is what a future pass would need. Recipe-level minerals
  HelloFresh already publishes directly (potassium/calcium/iron/fiber/sugar/
  salt) are stored as-is in a new `Product.nutritionExtra` JSON field.
  Images are downloaded at `w=2000` from `media.hellofresh.com` (Cloudinary-
  style `c_limit` never upscales, so this reliably returns the source file's
  native resolution) into a new shared `./data/hellofresh-images` volume,
  mounted into both the agent and the app (served as `/hellofresh-images/...`
  the same way `/product-images` already is for the image-agent).
  **Note:** a concurrent session was found mid-way through this same feature
  (an empty `scripts/hellofresh-import/`, an enum-only migration, and a
  `hellofresh-agent` compose block using different env var names, plus a
  separate `/api/ai/recognize-hellofresh` endpoint and a `kamera` "hellofresh"
  mode answering the "compare a plate photo against HelloFresh's catalog"
  part of the request) — the compose service block was reconciled to this
  session's actual env vars/volume; the recognize-hellofresh endpoint/camera
  mode were left untouched as out of this session's scope.
- 2026-08-29: The other side of the same feature, from the session referenced
  in the note directly above (recognize-hellofresh/kamera "hellofresh" mode):
  the user's original request asked for a "Ret nr." (dish number) field above
  the normal search box on `/madvarer`. **Confirmed directly with the user:
  HelloFresh only prints that number on the physical recipe card at
  delivery** — it does not appear anywhere on their public website (verified
  by inspecting the same `__NEXT_DATA__` payload the catalog-import agent
  reads), so it cannot be looked up from a typed number at all. Per the
  user's own follow-up ("den del må vi skippe... billedegenkendelsen må
  forhåbentligt kunne genkende retten"), the number field was dropped
  entirely in favor of AI photo recognition: `/api/ai/recognize-hellofresh`
  sends a photo of the plated meal plus the names of every currently
  non-discontinued `externalSource='HELLOFRESH'` product to `gpt-4o-mini`
  (vision), which returns its best-guess product id; a new `kamera`
  `?mode=hellofresh` capture flow (single-purpose — it hides the usual
  Stregkode/Måltid/Næring tab row) shows the match via `HelloFreshMatchReview`
  for the user to confirm before landing on the existing `/tilfoej/[id]`
  screen, reusing the ordinary registration flow rather than a new one. The
  entry point is a "HelloFresh — Genkend din ret" row above the search box on
  `/madvarer`. Separately, `/tilfoej/[id]` now treats any product with
  `servingSizeGrams` set as counted in portions rather than grams (the
  amount stepper steps by half a serving and labels itself "portion(er)");
  this is a small generic UI change, not HelloFresh-specific, but it is what
  makes the recognized HelloFresh dish's real per-portion `servingSizeGrams`
  (from the 2026-08-29 catalog-import entry above) display and log
  correctly. This session's own first-draft `scripts/hellofresh-import` (a
  simpler menu-listing crawler using a nominal 500 g serving size) was
  superseded on disk by the more thorough sitemap/ingredient-catalog version
  from the other session — only that version remains.
- 2026-09-12: Body measurements (waist/hip/chest/thigh/upper-arm circumference
  in cm) are a distinct concept from `User.targetWeightKg` ("mål" as in
  goal weight, set 2026-09-11) and from `WeightEntry` (the scale weight
  itself) — added as the new `BodyMeasurement` model specifically so the
  photo diary can caption a photo with "Aktuel/Seneste mål" the same way it
  already does for weight. The user initially deferred the actual
  measurement-entry screen ("måleside") to a separate chat/session, so this
  model and its read+write API were built first without that screen, so the
  data had a real place to live rather than being faked, per the project's
  standing rule against inventing placeholder data mechanisms. Later the same
  day, the user chose to have the entry screen (`/profile/body-measurements`)
  built in the same chat after all — see the matching `docs/STATUS.md` entry.
  It merges same-calendar-day field edits into one row (PATCH the existing
  row, else POST a new one) rather than one row per field, specifically so
  the photo diary's caption can show several measurements together for a
  single day.

## Hosting and delivery

- Production is intended to run on the user's Synology NAS through Docker/Container Manager.
- PostgreSQL runs as a separate container with persistent storage.
- Remote web access uses the existing Cloudflare Tunnel; no application portforwarding is intended.
- Source code is stored in the private GitHub repository, and application images are published to GHCR.
- Secrets belong in server-side environment configuration and must never be committed.
- 2026-08-26: Production delivery uses GitHub-hosted image builds followed by an authenticated GHCR pull on Synology. Images receive both `latest` and immutable Git SHA tags; controlled deployments pin a SHA.
- 2026-08-26: The new stack is isolated as Compose project `hellocal-v2` under `/volume1/docker/App/hellocal-v2`, with PostgreSQL 17 and host port `3100`. The stopped legacy stack and `/volume1/docker/App/hellocal/postgres` remain untouched until a separate data-migration decision is made.
- 2026-08-26: The public HELLO CAL application remains accessible to anyone who
  knows its address, but every response carries an `X-Robots-Tag` noindex policy
  so search engines are instructed not to index or surface its contents.
- 2026-08-27: Nutrition-label photo capture (`/kamera?mode=naering`, per
  `docs/AI.md`'s "næringsdeklaration" flow) was previously unbuilt, not
  broken — only `produkt` and `maaltid` camera modes existed. Added a third
  camera mode with client-side OCR via `tesseract.js` (new dependency; no
  server/API key required) and pragmatic Danish-keyword regex heuristics
  (`src/lib/nutrition-ocr.ts`) to extract kcal/protein/kulhydrat/fedt per
  100 g. Extracted values, if any, are handed off to a new shared manual
  create-product screen, `src/app/madvarer/nyt/page.tsx` — the app had no
  such screen before this change, so both the OCR flow and the barcode
  "product not found" fallback needed one. `NutritionLabelReview.tsx` shows
  the OCR status and forwards the read values via `sessionStorage` to that
  screen for a final editable review before `POST /api/products` creates
  the `PENDING` product and opens the existing `/tilfoej/[id]` registration
  flow; OCR failure shows a clear manual-entry fallback there instead of
  failing silently. This is intentionally minimal — it does not implement
  the full four-step unknown-barcode flow (front + barcode + næringsdeklaration)
  described in `docs/AI.md`; that remains separate future work on the
  `produkt` mode.

## Engineering process

- Keep changes small and reviewable; large rewrites require explicit approval.
- Preserve unrelated local changes.
- A checkpoint is complete only after lint and production build pass, unless an unresolved check is documented in `docs/STATUS.md`.
- Local `npm run dev` uses Next.js' Webpack mode. Turbopack 16.2.12 produced a reproducible HMR panic in the OneDrive-synchronized repository, while Webpack and the production build are stable.
- 2026-08-30: Root `design.md` is the binding visual implementation contract
  for colors, typography, geometry, spacing, radius, icons, and reusable UI
  primitives. It does not override product behavior in `SPECIFICATION.md`,
  `DECISIONS.md`, or `UI.md`. Existing code is not a design authority when it
  differs from this contract. The source HelloFresh screenshots are measured
  at their original 1206x2622 resolution (exactly 3x a 402x874 logical
  viewport), not the 941x2048 preview size recorded in the older typography
  note. The references contain two contextual greens: `#067A46` for
  brand/auth/onboarding and `#35784A` for newer app bars; implementations must
  use named variants instead of blending them into an arbitrary third green.
  General horizontal screen padding is 16 px. The measured 32 px padding is a
  named editorial/feature variant, not a second default. Cards, rows, fields,
  buttons, modals and safe-area containers own their internal padding so pages
  may not compensate with route-specific margins or nested padding wrappers.
  `design.md` also contains the proposed CSS blueprint. That code is guidance,
  not an implemented state: runtime CSS must be migrated component by
  component, with temporary semantic legacy aliases, fresh in-place visual
  verification, lint, and build before any part is marked complete.
- 2026-08-31: The live official HelloFresh Denmark website is secondary visual
  evidence, while the supplied original app screenshots remain primary for
  Hello Cal. Official web computed styles confirm the shared core colors
  `#242424`, `#232323`, `#067A46`, `#FAF8F3`, `#656565`, and `#7D7561`, plus
  the 4/8-based spacing/radius family and 48 px controls. Web-only typography
  (Agrandir Tight/Roboto), marketing green `#056835`, and provider/state color
  differences must not overwrite direct app measurements. Exact documented
  web hover/active/focus values may be used only in their named interaction
  states.
- 2026-09-02: Standing rule — checkboxes must never be used anywhere in the
  app; every on/off preference uses the shared right-aligned iOS-style
  `Toggle` component (`src/components/ui/Toggle.tsx`). Replaced all remaining
  `type="checkbox"` usages (profil/indstillinger, profil/soevn, StatChart).
  Added `HfChevron` (`src/components/hf/HfChevron.tsx`) as the single allowed
  chevron primitive per `design.md` §6.7; `AccordionCard`'s literal "›" was
  replaced with it.
- 2026-09-02: Billede-dagbog stores photos client-side only (localStorage) —
  there is no blob/object storage infrastructure in this project yet. Only
  the "requires phone passcode" preference (`User.photoDiaryRequiresPasscode`)
  is persisted server-side; there is no real OS-level passcode/biometric
  enforcement, which is a future native-app concern.
- 2026-09-02: "Invitér en ven" reward bookkeeping (`Referral` model,
  `User.freeMonthsCredited`, `src/lib/referrals.ts`) is pure data-model and
  computation logic. There is still no real invite-link/referral-code or
  signup-attribution mechanism anywhere in the app (no account/login system
  generally, see `docs/STATUS.md`), so no `Referral` rows can be created yet.
  Do not invent a fake referral-code system to fill this gap — wire this up
  once real attribution exists.
- 2026-09-02: `design.md` typography resolved against a second independent
  measurement pass (ChatGPT) plus fresh visual re-checks of the source
  screenshots, closing prior ambiguities: inline text-links use only
  `#242424` (no separate muted/back-link color); `.hf-type-tab` differs
  active/inactive by color only, never weight (confirmed against
  `Startside.png`); social-login labels are weight 700 (confirmed against
  `Log-in.png`, same weight as adjacent CTA buttons); a new
  `.hf-type-progress-active` (600, `#035624`) and `.hf-type-progress-inactive`
  (400, `#828282`) pair was added for onboarding step indicators (confirmed
  against `Oprettelsesflow.png`); `.hf-type-page-title` and
  `.hf-type-category-title` are centered by default app-wide (not a
  auth-only variant) — this changes existing left-aligned page headings and
  must be applied when those screens are next touched.
- 2026-09-02: Standing rule — the appbar's closable-page action is always a
  back arrow (←), never an ✕/cross, anywhere in the app. This overrides
  `docs/UI.md`'s prior wording (now corrected) which had specified a cross
  icon; no shipped code used a cross in the appbar yet, so this was a
  forward decision, not a fix. Matches the user's separately stated global
  preference (back arrow over cross for close/back actions in any project).
- 2026-09-02: Built the guided product-creation auto-recognition flow the
  user specified (a fuller realization of `docs/AI.md`'s "Ny vare via
  stregkode" four-step flow, explicitly noted as never fully implemented —
  see the 2026-08-27 entry above). New, self-contained route
  `src/app/kamera/opret/page.tsx` (own camera bootstrap, does **not** touch
  the existing `/kamera` `produkt`/`maaltid`/`hellofresh` tabs, per explicit
  instruction) drives three stages: forsidefoto → stregkode → næring, ending
  on a new `src/app/produkt/opret/page.tsx` create-product page prefilled
  from whatever was recognized/captured (`src/lib/product-draft.ts`
  sessionStorage cache, same pattern as the existing OCR-draft key).
  Recognition order is local-first, AI only as the documented last resort
  per the user's explicit instruction: OCR text (`tesseract.js`, activating
  the previously-unused dependency noted in the 2026-08-27 entry) → fuzzy
  ≥90% text match (`src/lib/text-similarity.ts`, hand-rolled Levenshtein, no
  new dependency) against local products; if no text, a local average-hash
  image similarity check (`src/lib/image-similarity.ts`, canvas-based, no ML
  model) against generic Frugt/Grønt-category products; only then
  `/api/ai/recognize-product-photo` (OpenAI `gpt-4o-mini`, same pattern as
  `/api/ai/recognize-hellofresh`, requires ≥95% confidence to count as a
  match). Barcode step reuses the existing ZXing setup and
  `/api/products/lookup/[barcode]`. Nutrition step: regex parsing
  (`src/lib/product-ocr.ts:parseNutritionText`) first, `/api/ai/extract-nutrition`
  only if regex can't derive all four per-100g values, then a tolerance-based
  dedupe check (`/api/products/match-nutrition`) before falling through to
  the create page, matching the user's "if not ~identical to an existing
  product" wording.

  **Known limitation, flagged as an explicit assumption (not silently
  chosen):** there is no image-embedding/ML infrastructure in this project
  (no pgvector, no vision-embedding pipeline), so the "vektor"-matching step
  is a lightweight perceptual average-hash, not real ML similarity — it can
  reliably match a near-identical photo but cannot reliably distinguish
  visually similar produce (e.g. a peach vs. a nectarine). The AI-vision
  fallback is the real safety net for that case, per the user's own
  instructions. It also depends on `imageUrl` being readable by canvas
  (`crossOrigin: "anonymous"`) — an externally hosted candidate image without
  permissive CORS headers is silently skipped rather than breaking the flow.

  The 2×2 create-product media grid (`src/components/hf/CreateProductMediaGrid.tsx`:
  stregkode/næringsindhold/indholdsfortegnelse/produktbilleder, each behind a
  numbered corner badge) and its supporting primitives (`NumberedBadge`,
  `HfBarcodeIcon`, `ScanningOverlay`) are new Hello Cal-specific components,
  documented in `design.md` §6.11 per its own governance rule requiring new
  primitives to be named before a page uses them. The points banner
  ("Opret produktet og optjen 10 points") is **UI only** — there is no points/
  gamification data model anywhere in this project; the user explicitly
  deferred that to a separate task and asked only to show the box for now.
  `POST /api/products` was extended to optionally accept `barcode`,
  `imageUrl`, `ingredientsText`, and `extraImages` (creates the `Barcode`/
  `ProductImage` rows) — additive, existing manual-create behavior from
  `src/app/madvarer/nyt/page.tsx` is unchanged.

  While preparing to verify this with `npm run build`, found and resolved
  two unrelated pre-existing git merge-conflict-marker blocks left in
  `src/components/StatCardsGrid.tsx` and `src/components/StatChart.tsx`
  (from a `git stash`/pull conflict, not part of this change) — resolved by
  keeping the more complete/integrated side in each case (an orphaned
  `deviationLabel` helper and a `setSwipe` call with no matching `useState`
  declaration were dropped as clearly incomplete work-in-progress, not a
  deliberate feature removal). A concurrent session appeared to be resolving
  the same files at the same time; only the conflict(s) still present when
  checked were touched.

## 2026-09-02/03: Pointsystem, betaling, besked-automatisering, admin-brugere

- Points tildeles ved admin-godkendelse (produkter, fejlrapporter), ikke ved
  indsendelse — forhindrer at spam-indsendelser giver points.
- Ledger frem for et cachet saldofelt: `PointsTransaction` er kilden til
  sandhed, saldo er altid en SUM-forespørgsel.
- "Invitér en ven" giver 300 points til begge parter (ikke en direkte gratis
  måned); 300 points kan indløses til 1 gratis måned, som kræver en gemt
  betalingsmetode, så abonnementet fortsætter automatisk til fuld pris
  bagefter. Lifetime-loft på 12 gratis måneder er uændret fra den
  oprindelige `freeMonthsCredited`-regel.
- "Videresend ret/produkt til en ven" giver kun points når modtageren rent
  faktisk tilføjer varen til sin egen dag (ikke blot åbner linket), har et
  loft på 50 points/måned/bruger, og krydsspærrer to brugere der sender frem
  og tilbage mere end én tur-retur på 24 timer (flag håndteres i den
  eksisterende admin "Advarsler"-side, ingen ny admin-side).
- 48-timers admin-eskalering (produkter og fejlrapporter) kører som et
  in-process baggrundsjob i selve Next.js-serveren (`src/lib/scheduler.ts` +
  `instrumentation.ts`), DB-drevet og bevidst IKKE bundet til Synology Task
  Scheduler eller andet OS-cron — appen skal kunne flyttes til en anden
  host uden at miste funktionen.
- Mail (`src/lib/mailer.ts`, nodemailer) og Web Push (`src/lib/push.ts`,
  web-push) er forberedt fuldt ud men er bevidst no-op indtil
  `SMTP_*`/`VAPID_*`-miljøvariabler findes — se `docs/DEPLOYMENT.md`. Ingen
  konkret mailudbyder er valgt endnu.
- **Sydtrafik-infrastruktur eller -konti må ALDRIG bruges til noget i dette
  projekt** — Hello Cal er brugerens eget personlige projekt, fuldstændig
  adskilt fra dennes arbejdsplads. Gælder mail, hosting, betaling — alt.
- Betalingsside/-model er bevidst udbyder-uafhængig: der er endnu ingen
  indløsningsaftale, så `Subscription`/`PaymentMethod` er forberedt med et
  `PaymentProvider`-enum (Reepay/Quickpay/Stripe/MobilePay Online), men
  ingen konkret PSP-API kaldes i kode endnu. MobilePay-understøttelse kræver
  en dansk PSP (ikke Stripe alene) — vælges når en aftale findes.
- GDPR "ret til at blive glemt" er en **anonymisering**, ikke et hårdt slet:
  mange tabeller kræver `userId` (RESTRICT) for at bevare
  registrerings-snapshot-princippet. `src/lib/gdpr.ts` rydder PII og
  login-midler, men bevarer selve User-rækken og dens historik.
- Admin "log ind som bruger" (impersonation) og GDPR-sletning logges begge i
  en ny `AdminAuditLog`-tabel — følsomme admin-handlinger skal kunne
  efterspores.
- To Prisma-migrationer i denne batch (`20260902020000_points_messaging_forwards`,
  `20260902030000_payments_referrals_admin_users`) blev skrevet i hånden,
  fordi arbejdsstationen ikke har lokal database-adgang til at generere dem
  med `prisma migrate dev`. De er kun valideret med `prisma validate` +
  `prisma generate` + `tsc --noEmit` — skal gennemgås og køres med
  `prisma migrate deploy` ved næste Synology-udrulning før de kan stoles på.

## 2026-09-12: Hello Doc — del fremgang med læge/diætist

- Ny funktion under Indstillinger → "Hello Doc": ejeren kan invitere en
  navngiven modtager (læge/diætist) pr. e-mail til at se en udvalgt del af
  sine egne data. Ny `DoctorShare`-model (migration
  `20260912000000_hello_doc`, hånd-skrevet — samme "ingen lokal database"-
  begrundelse som andre nylige migrationer i dette projekt): navn, e-mail,
  status (PENDING/ACTIVE/EXPIRED/REVOKED), et unikt `token` (samme mønster
  som `Product.approvalToken`, til den fremtidige eksterne visning), hvilke
  datakategorier der er delt (`categories`, JSON-liste af nøgler fra
  `src/lib/doctor-share.ts`), og en valgt historikperiode (7 dage/måned/
  år/hele). Invitationsmailen genbruger den eksisterende
  besked-automatiserings-infrastruktur (`queueMessage`, nyt
  `MessageEvent.DOCTOR_SHARE_INVITATION`), samme no-op-indtil-SMTP-regel som
  alt andet i den kø.
- **Oprindeligt kun sat op, ikke færdigbygget end-to-end** (eksplicit
  brugerønske — "Nøjes med at sæt den op for nu"): ved denne funktions første
  udbygning fandtes der endnu ingen token-autentificeret ekstern visning.
  `/settings/hello-doc/preview` ("Sådan ser det ud") og dens API
  (`/api/doctor-shares/preview`) viser den INDLOGGEDE ejers egne data i det
  planlagte layout — en forhåndsvisning af formatet, ikke selve
  modtagersiden. **Rettet samme dag:** den rigtige, login-frie visning findes
  nu på `/hello-doc/[token]` (`src/app/api/hello-doc/[token]/route.ts`
  GET+POST), inklusive accepteringsflowet der rykker status PENDING →
  ACTIVE — se `docs/STATUS.md`s dedikerede 2026-09-12-post om dette. "Next
  work" #12A er lukket; kun spørgsmålet om menstruationscyklus som en rigtig
  fremtidig funktion er stadig åbent.
- **To af de ni datakategorier har intet underliggende datagrundlag i Hello
  Cal endnu** og vises derfor som deaktiverede/informative rækker, ikke
  rigtige til/fra-valg, samme "ikke lav en tom/falsk funktion"-konvention som
  resten af appen: "Menstruationscyklus" (ingen cyklus-model findes noget
  sted i skemaet) og "Fordøjelse" (eksplicit udskudt af brugeren selv,
  "kommer senere"). Flagget direkte til brugeren, da funktionen blev bygget,
  som svar på deres eget spørgsmål "Er der nogen felter jeg har overset?".
  De øvrige kategorier (profil, vægt, mål, søvnrytme, mad/kalorier,
  mineraler/vitaminer, væske) bruger allerede eksisterende felter/modeller
  (`User`, `WeightEntry`, `Registration`-snapshots, `HealthMetric` for
  væske) — væske og søvnrytme er dog stadig prototype-/integrationsafhængige
  data samme sted som resten af appen (se `docs/STATUS.md` "Next work" #3).
- Startvægt/startmål på forhåndsvisningen bruger `User.createdAt` som
  tidspunkt, fordi hverken `User.weightKg` eller `User.targetWeightKg` har
  sit eget "indtastet den"-tidsstempel — en tilnærmelse, ikke et præcist
  logget tidspunkt.
- Aktiveret adgang (status ACTIVE) er permanent som standard — der er ingen
  UI endnu til at sætte en kortere adgangsperiode efter accept, kun
  invitationens egen 14-dages udløbsfrist før accept.
- **Tilføjelse samme dag**: brugeren gav et skærmbillede af HelloFreshs eget
  checkout-login-trin ("Log ind på din HelloFresh-konto") som direkte
  visuel reference for felt-/tekststørrelse/knap-stil på "Inviter bruger"-
  og redigér-siderne — eksplicit undtagelse fra den generelle
  `.hf-field`/`TextField`-kontrakt for netop disse to skærme. Ny
  `NotchedTextField`/`.hd-notched-field` (native `<fieldset>`/`<legend>`,
  giver "hakket" kantlabel uden JS) bruges kun i `DoctorShareEditor`, samt en
  større/rundere primærknap (64px, radius 12px) på begge skærme. Dette er en
  bevidst side-specifik afvigelse godkendt direkte af brugeren, ikke en ny
  generel designsystem-primitiv — `docs/design.md` er ikke opdateret med
  denne variant.

## 2026-09-19: Køn, fødselsdato og menstruationscyklus (kun kvinder)

- `User.sex` (FEMALE/MALE) fandtes allerede i `/profile/edit` sammen med
  navn/vægt/højde — bekræftet fungerende, ingen ny funktion nødvendig der.
- `User.birthYear` (kun årstal) erstattet af `User.birthDate` (fuld dato), så
  alderen beregnes præcist og opdateres automatisk hvert år i stedet for at
  være en statisk "indeværende år minus fødselsår"-værdi. Se `src/lib/age.ts`.
- Ny `MenstrualCycleEntry`-model (startDate/endDate pr. periode) + tre nye
  `User`-felter: `cycleTrackingEnabled` (slåknappen under Indstillinger →
  Visning → Menstruationscyklus, default fra — samme konvention som
  showAllergens/showExtendedNutrition), og `averageCycleLengthDays`/
  `averagePeriodLengthDays` (reserveret til en fremtidig prognosefunktion,
  ikke brugt endnu — der er ikke bygget nogen prognose-/fertilitetsvisning i
  denne omgang, kun logning af en periodes startdato).
- Menstruationscyklus er **kun** synlig/aktiv når `sex = FEMALE` — både
  Indstillinger → Visning-rækken og "Menstruation" i den fælles tilføj-menu
  (`src/lib/add-actions.ts`'s `visibleAddActions()`) skjules helt for mænd,
  ikke bare grået ud.
- Eksplicit brugerønske: kalenderens time-baserede "Tilføj"-bjælke
  (`src/app/calendar/page.tsx`) åbner nu samme `/add/menu`-skærm som
  forsidens joystick-hjuls faste "liste"-felt, i stedet for at gå direkte til
  `/foods` som tidligere. `date`/`time` videreføres som query-parametre til
  det valgte tilføj-element.
- Bevidst ikke bygget i denne omgang: prognose/fertilitetsvindue på selve
  kalenderen, redigering/afslutning af en igangværende periode, og at koble
  de nye rigtige `MenstrualCycleEntry`-data ind i Hello Doc
  (`src/lib/doctor-share.ts` lister stadig `menstrualCycle` som
  `DOCTOR_SHARE_UNAVAILABLE_CATEGORIES`, selvom der nu findes en datamodel) —
  bevidst holdt uden for denne ændrings scope, tilføjet til `docs/STATUS.md`
  "Next work".

## 2026-09-11: Udvidet næringspanel (MyFitnessPal-stil)

- Produktets næringsindhold udvides med et "MyFitnessPal-stil" udvidet panel:
  mættet/umættet/transfedt, kolesterol, natrium, kalium, kostfibre, sukker,
  vitamin A, vitamin C, calcium, jern. De seks nye felter (mættet/umættet/
  transfedt, kolesterol, vitamin A, vitamin C) er nye `Product`/`Registration`-
  felter pr. 100g/snapshot; natrium/kalium/kostfibre/sukker/calcium/jern
  genbruger det eksisterende `Product.nutritionExtra`-felt (kun HelloFresh-
  opskrifter, se 2026-08-29-posten) via de allerede tilføjede
  `Registration`-snapshot-kolonner.
- **Vises aldrig som standard.** Kun som en kollapset "Vis mere"-sektion
  under næringsindholdet på `/add/[id]`, og kun når brugeren selv har slået
  "Vis udvidet næringsindhold" til under `/profile/settings` (nyt
  `User.showExtendedNutrition`-felt, default false, samme mønster som
  "Få vist allergener"). Sektionen vises slet ikke, hvis produktet ingen af
  de 12 værdier har — aldrig en tom boks.
- Kun Open Food Facts leverer de seks nye felter indtil videre
  (`src/lib/openFoodFacts.ts`); Frida og HelloFresh-scrapet har dem ikke.
  Enhedskonvertering (g/mg/µg) sker via OFF's egne `<nutrient>_unit`-felter,
  aldrig ved at antage en enhed — en ukendt enhed (fx "IU") giver `null`,
  ikke et gæt.
- Ny hånd-skrevet migration `20260911120000_extended_nutrition_panel` (ikke
  anvendt endnu — ingen lokal database). En tidligere migration,
  `20260910000000_registration_extra_nutrition_snapshots`, var allerede
  skrevet af en tidligere/samtidig session, men `schema.prisma` var aldrig
  opdateret til at matche den — rettet i samme omgang.

## 2026-09-12: Offline produktoprettelse + admin "Dobbeltoprettelser"

- **Offline-kø** (`src/lib/offline-product-queue.ts`): brugerappen skal kunne
  fotografere produkter og udfylde opret-formularen uden netværk; indsendelsen
  uploades automatisk, når enheden får forbindelse igen. Da hele
  opret-produkt-formularens `POST /api/products`-krop allerede sendes som
  ren JSON med hvert billede som en `data:`-URL (ingen separat binær
  upload-trin findes), er selve køen en IndexedDB-butik
  (`hellocal-offline`/`pendingProducts`) af netop denne JSON-krop —
  `localStorage` blev bevidst fravalgt, da nogle få fotos som data-URL'er
  nemt kan overskride dens ~5-10MB pr. origin. `/product/create` tjekker
  `navigator.onLine` og fanger også en `fetch`-fejl, og kø'er i begge
  tilfælde i stedet for at vise en blindgyde-fejl. En ny
  `OfflineQueueBanner` (monteret én gang i `src/app/layout.tsx`, uden for
  `PhoneFrame`, så den overlever navigation) fletter køen ved mount, ved
  browserens `online`-event og hvert 60. sekund mens der er forbindelse, og
  viser en lille fast bjælke øverst mens noget stadig afventer. Et element,
  der rent faktisk får et rigtigt fejlsvar fra serveren (ikke en
  netværksfejl — fx en stregkode der allerede er taget), fjernes fra køen i
  stedet for at blive forsøgt igen i det uendelige.
- **Dobbeltoprettelser** (`docs/ADMIN.md`s eksisterende regel om at admin
  advares ved dubletter, og at de kan flettes, var allerede beskrevet, men
  aldrig bygget som en dedikeret side med billed-sammenligning): en ny
  `ProductDuplicateLink`-model (migration
  `20260912010000_product_duplicate_links`, hånd-skrevet — samme "ingen
  lokal database"-begrundelse som andre nylige migrationer) flager to
  produkter oprettet med samme normaliserede navn inden for et 10-minutters
  vindue (`src/lib/product-duplicates.ts`, kaldt lige efter oprettelse i
  `POST /api/products`, fejler aldrig selve oprettelsen). Ny admin-side
  `/admin/duplicate-products` ("Dobbeltoprettelser") viser hvert par side om
  side med alle billeder fra begge produkter som afkrydsningsfelter
  (standard: alle valgt) og en Merge-knap. Fletning
  (`POST /api/admin/duplicate-products/[id]/merge`) flytter alle
  referencer (stregkoder, registreringer, favoritter, ingredienser, points,
  videresendelser — samme mønster som det allerede eksisterende
  `/api/admin/products/[id]/merge` bag `/admin/warnings`s navne-baserede
  dublet-liste) til det valgte produkt, erstatter begge produkters billeder
  med præcis den afkrydsede/ordnede liste, og sletter det andet produkt.
  Registrerings-/points-snapshots ændres aldrig, jf. snapshot-princippet.
  En separat "Ikke en dublet"-handling markerer parret `DISMISSED` uden at
  flette noget.
- `npx prisma validate`/`generate`, `eslint .` (hele repoet) og `next build`
  (fuld TypeScript + alle 112 routes) er alle kørt rent. Ikke verificeret
  live i en browser — se `docs/STATUS.md` for detaljer og kendte
  begrænsninger; migrationen mangler stadig `prisma migrate deploy` på
  næste Synology-udrulning.

## 2026-09-12: Produktoprettelse — scanning af stregkode/næring/ingredienser, region styrer sprog (ikke telefonens visningssprog)

Topprioritets-opgave: `/product/create`s eksisterende 2×2 `CreateProductMediaGrid`
(design.md §6.11: 1 stregkode, 2 næringsindhold, 3 indholdsfortegnelse,
4 produktbilleder) skal have reelt auto-udtræk pr. boks, nu hvor
`OPENAI_API_KEY` er sat op. Afklaret med brugeren via `AskUserQuestion`
(2026-09-12) plus en direkte opfølgende besked, der udvidede scopet:

- **Stregkode (boks 1):** afkodes lokalt og gratis med `@zxing/browser`
  (allerede en dependency, bruges i dag til live-scanning i
  `src/app/camera/create/page.tsx`) på selve stillbilledet. AI bruges kun som
  absolut sidste udvej, hvis ZXing slet ikke kan afkode billedet — aldrig som
  primær metode, fordi en stregkode er et præcist stregmønster, som AI-vision
  er markant dårligere til at læse korrekt end en rigtig decoder.
- **Næring (boks 2):** samme "lokal regex først, AI kun som fallback"-mønster
  som allerede findes i det guidede `/camera/create`-flow
  (`src/lib/product-ocr.ts` `parseNutritionText` + `/api/ai/extract-nutrition`)
  skal genbruges her — det er i dag kun forbundet til det guidede flow, ikke
  til den manuelle grid-boks.
- **Ingredienser (boks 3):** ny route (findes slet ikke i dag). Lokal gratis
  OCR (tesseract.js, `extractText`) først. AI må **kun oversætte** den
  OCR'ede tekst — den må ikke selv gætte/slå ingredienser op eller foreslå
  indhold, den skal udelukkende sikre, at den tekst, der rent faktisk stod på
  billedet, ender i `ingredientsText`-feltet på det sprog, appens UI viser
  (bruger-locale `da`/`en`, jf. `src/i18n/`), uanset hvilket sprog
  deklarationen selv var trykt på.
- **Produktbilleder (boks 4):** ren upload, ingen scanning nødvendig — virker
  allerede.

**Region styrer forventet sprog, ikke telefonens/browserens visningssprog.**
Bruger-feedback, ordret pointe: EU-lovgivning kræver, at indholdsdeklarationer
er på det lokale sprog, uanset hvilket UI-sprog en bruger har valgt på sin
telefon (brugerens eksempel: telefon sat til engelsk visning, men bosat i
Danmark — pakken er stadig trykt på dansk, og AI/OCR skal forvente dansk,
ikke engelsk). Samme regel gælder allerede-eksisterende
`User.region`/`REGIONS`/`barcodeMatchesRegion` (`src/lib/regions.ts`, GS1-
præfiks `57` = Danmark) og skal fremover også styre:
  - Hvilket sprog tesseract.js's `extractText()` forventer (i dag hardcodet
    `"dan+eng"` — skal udledes af regionens officielle sprog i stedet, med
    engelsk som sekundært OCR-sprog for blandet emballagetekst).
  - Talegenkendelsens sprog i `/voice` (`src/app/voice/page.tsx:430`,
    `recognition.lang = "da-DK"` er i dag hardcodet uden hensyn til
    `User.region` overhovedet — skal udledes derfra på samme måde, ikke fra
    browserens/telefonens visningssprog).
- **Automatisk multi-shot-optagelse ved fokus ("grøn kant"):** brugeren
  refererer til en anden, allerede beskrevet opgave om, at stregkode-
  scanneren skal vise en grøn kant, når koden er i fokus, og har bedt om at
  det arbejde kombineres med dette, så det ikke laves to gange: når
  stregkoden (og tilsvarende næringsdeklaration/indholdsfortegnelse) er i
  fokus, skal appen selv tage 2-3 billeder automatisk (ikke vente på et tryk),
  til brug for at krydstjekke, at den scannede stregkode rent faktisk matcher
  de billeder, der bliver taget af produktet. **Denne sessions research kunne
  ikke finde en skriftlig kilde til "grøn kant ved fokus"-opgaven** (tjekket
  `docs/UI.md`, `Fejlretninger/FEJLLISTE.md`, og de utriagerede
  skærmbillede-mapper `Fejlretninger/Nye rettelser til Hello Cal/` og
  `Fejlretninger/MyFitnessPal/`, som kun indeholder rå `.png`/`.jpeg`-filer
  uden tilhørende tekstbeskrivelse) — implementeres derfor efter bedste
  vurdering (fx: ZXings egen succesfulde decode-callback som "i fokus"-signal
  for stregkoden; en simpel stabil-frame-heuristik for næring/ingredienser),
  og brugeren bedes bekræfte/rette det, når det er bygget.
- Brugeren har eksplicit bedt om **ikke** at vente på flere afklarende svar —
  byg det, der kan bygges ud fra denne beslutning, og flag i `docs/STATUS.md`
  hvad der kræver brugerens egen handling (fx en manglende reference-kilde,
  eller server-side environment/deploy-trin denne workstation ikke selv kan
  udføre).

## 2026-09-19: Abonnement/betalingsside — Gratis vs. Seriøs, gavekoder, 30-dages rullende historik

Direkte brugerønske: en ny "Abonnement"-side (nr. 2 på profilsiden, lige efter
"Profil") med et gavekode-felt (label + felt + højrepil som accept), en
"Indløs points"-mulighed nedenunder, og et Gratis/Seriøs-abonnement hvor
Gratis kun viser de seneste 30 dages historik (data slettes aldrig, men
skjules — som et overvågningskameras rullende optagelse — og kommer tilbage
med det samme ved opgradering). Se `docs/STATUS.md` (2026-09-19) for
build-/verifikationsnoter.

- **Pris**: Seriøs koster **119 kr./måned**, vist direkte på siden fra nu af
  (bevidst IKKE "kommer snart" — eksplicit brugerinstruks, i modsætning til
  den generelle 2026-09-02-beslutning om at holde selve betalingssiden
  udbyder-uafhængig). Der er stadig ingen konkret PSP-aftale, så "Opgradér
  til Seriøs"-knappen på `/profile/subscription` er bevidst disabled med en
  forklarende tekst — kun gavekode og points-indløsning kan reelt gøre en
  bruger Seriøs indtil en betalingsudbyder er valgt.
- **Tier udledes, gemmes ikke som et nyt felt**: `src/lib/subscription.ts`s
  `getSubscriptionTier()` afleder Gratis/Seriøs fra den allerede
  eksisterende `Subscription.status`/`currentPeriodEnd` (ACTIVE/TRIALING/
  FREE_MONTH = Seriøs, forudsat `currentPeriodEnd` ikke er overskredet) —
  ingen ny "tier"-kolonne, for ikke at få to kilder til sandhed.
- **Ny `GiftCode`-model** (migration `20260919050000_gift_codes`,
  hånd-skrevet — samme "ingen lokal database"-begrundelse som andre nylige
  migrationer i dette projekt): admin-oprettede engangskoder med en fast
  `durationDays`. Indløsning (`src/lib/gift-codes.ts`) forlænger/sætter
  `Subscription.currentPeriodEnd` og status `FREE_MONTH` — **ingen
  betalingsmetode kræves**, samme "seriøs uden reel PSP-aftale lige nu"-
  semantik som den eksisterende points→gratis måned-mekanisme.
  **Ikke bygget denne omgang, flagget som opfølgning:** der findes endnu
  ingen admin-side til at oprette/generere gavekoder — kun datamodellen og
  selve indløsningen (`POST /api/subscription/redeem-gift-code`) er klar.
- **Korrektion af den eksisterende 2026-09-02-beslutning**: points→gratis
  måned (`redeemFreeMonth` i `src/lib/points.ts`, 300 points = 1 måned)
  krævede tidligere en gemt betalingsmetode, "så abonnementet fortsætter
  automatisk til fuld pris bagefter". Eksplicit brugerbeslutning i denne
  omgang: **kravet om gemt kort er fjernet** — en gratisbruger må gerne
  indløse uden kort; abonnementet falder blot tilbage til Gratis igen efter
  perioden, medmindre brugeren selv har tilføjet et kort og en rigtig
  PSP-aftale findes. `/profile/points`s tekst er opdateret til at matche.
- **Rullende 30-dages historik for Gratis** (`getRetentionCutoffDate()` i
  `src/lib/subscription.ts`): en ren forespørgselsgrænse (`createdAt >=
  cutoff`), ikke en fysisk "skjult"-markering eller et sletnings-job — data
  ældre end 30 dage bliver aldrig rørt i databasen og er derfor øjeblikkeligt
  synlige igen i samme øjeblik brugeren bliver Seriøs, uden noget
  "genfremkald"-job. Eksplicit brugerbeslutning: dette gælder **al**
  brugerdata (registreringer, vægt, søvn, helbredsmålinger, fotodagbog osv.),
  ikke kun mad-/kalorieregistreringer.
  **Ikke bygget denne omgang, flagget som opfølgning:** grænsen er kun
  faktisk koblet på `GET /api/registrations` (kalenderens/statistikkens
  primære datakilde) i denne omgang. `WeightEntry`, `HealthMetric`,
  `BodyMeasurement`, søvn m.fl. har **ikke** fået samme forespørgselsgrænse
  endnu — kræver at hvert af disse GET-endpoints får samme
  `getSubscriptionTier`/`getRetentionCutoffDate`-kald tilføjet, en
  cross-cutting ændring der bevidst ikke blev lavet i én stor omgang uden
  brugerens gennemgang. Billede-dagbogen er allerede localStorage-only
  (2026-09-02-beslutning) og derfor slet ikke omfattet af denne
  server-side-mekanisme.
- **Hello Doc kræver Seriøs** — den ene datakategori der eksplicit er
  udelukket fra Gratis. Håndhævet både server-side (`POST
  /api/doctor-shares` afviser med 403 hvis tier ikke er Seriøs) og i UI'et
  (`/settings/hello-doc` viser et opgraderings-link i stedet for
  "Inviter bruger"-knappen, når brugeren er Gratis).
- `/api/subscription` (GET) fandtes allerede som forventet endepunkt i den
  tidligere forberedte `/settings/payment`-side (2026-09-02/03-batchen) —
  men selve route-filen var aldrig bygget, så den side har kørt mod et
  404-svar indtil nu. Denne omgang bygger endepunktet og bevarer det
  oprindeligt forventede svar-format (`subscription`, `paymentMethods`) ved
  siden af de nye felter (`tier`, `pointsBalance`, `priceDkk` m.fl.), så
  begge sider deler ét endepunkt uden at knække den eksisterende side.

## 2026-09-23: "Nyt produkt" — sammensat produktnavn, Produkttype, Mængde, knapper nederst

- Den manuelle formular (`/foods/new`) har ikke længere et Produktnavn-felt.
  Felterne er Brand (påkrævet), Sub brand (valgfri), Produkttype (påkrævet),
  Variant (valgfri) og Mængde (total) (påkrævet: tal + enhed g/kg/ml/cl/L/stk).
- **Produkttype** er et navneord for selve varen (fx "Skyr"), som ellers læses
  af AI eller importeres fra Excel — fri tekst, ikke en kategori. Gemmes i den
  nye kolonne `Product.productType`.
- `Product.name` sammensættes server-side af Sub brand + Produkttype + Variant
  (`composeProductName` i `src/lib/product-naming.ts`). Brand ligger i
  brand-relationen og mængden i `packageSizeText`, så ingen af dem gentages i
  navnet. `POST /api/products` bruger et eksplicit `name`, hvis det sendes
  (øvrige flows), ellers det sammensatte navn.
- **Global UI-regel:** primære handlingsknapper på formularsider ligger altid
  nederst, lige over footer-navigationen — via `HfScreen`'s `footer`-slot og
  `form`-attributten — og aldrig lige efter felterne midt på siden.

## 2026-09-23: Statistik → "Tilføj kort" med fold-ud-grupper, separate Mineraler og Vitaminer

- Hver gruppe på `/statistics/unused-cards` er en fold-ud-boks
  (`src/components/hf/AccordionSection.tsx`, samme geometri som kalenderens
  timegrupper). Kun første gruppe (Næringsindhold) er åben fra start; flere
  må være åbne samtidig.
- "Vitaminer og mineraler" er delt i **Mineraler** og **Vitaminer**. Mineraler
  indeholder kun grundstoffer fra det periodiske system (15 kort). Salt er
  ikke et grundstof og ligger nu under Næringsindhold.
- Mineralkort viser periodisk-system-ikoner (`public/icons/minerals/`),
  vitaminkort vitaminikoner (`public/icons/vitamins/`) via `iconSrc` og den
  fælles `StatCardIcon`. Dette erstatter tekstsymbolerne (`symbol`) fra
  2026-09-19-beslutningen om "rigtige grundstofsymboler". Objekt-ikonerne for
  mineraler i `Icons/Vitaminer` bruges ikke.
- Nye kort Klorid og Fluorid med nye `HealthMetricType`-værdier
  `CHLORIDE_MG`/`FLUORIDE_MG` — samme forberedte mønster som de øvrige
  sporstoffer: "—" indtil en kilde sender data.

## 2026-09-23: Support-side med tidsbegrænset tilladelse + normaliserede fiber-/sukker-/salt-/fuldkornsfelter

Support (Indstillinger → Support, `/settings/support`):

- Brugeren vælger en periode (Fra/Til, standard i dag → om 7 dage) og hvilke
  af 25 datakategorier Support må se. Alle er slået fra som standard, og
  "Vælg alle" findes øverst. Kategorierne er defineret ét sted:
  `src/lib/support-permissions.ts`. Produktdatabasen og alt
  sikkerhedsrelateret (adgangskode-hash, TOTP, passkeys, tokens,
  betalingsoplysninger) kan aldrig vælges.
- Tilladelsen gemmes server-side som `SupportAccessGrant` med `permissions`
  som JSON (ingen boolean-kolonner på `User`). Den er kun aktiv, når
  `revokedAt` er null og `validFrom ≤ nu ≤ validUntil`. Perioden fortolkes
  som hele kalenderdage i Europe/Copenhagen, så en dag ikke kan forskydes af
  tidszonen. Adgangen udløber af sig selv, fordi forespørgslen ikke længere
  matcher efter Til-datoen.
- Gem med alt slået fra = tilbagekald. Tilbagekaldelse sætter `revokedAt`, og
  intet slettes. Et nyt gem tilbagekalder den forrige tilladelse og opretter
  en ny.
- "Kontakt os" er en intern formular (`SupportRequest`: kategori, emne,
  besked), ikke `mailto:`. Den virker uden datatilladelse og kobles til den
  aktive tilladelse, hvis der er en. Admin ser henvendelserne under
  `/admin/support` med tilladelsens kategorier og periode.
- Teksten øverst bruger den faktuelt korrekte formulering ("Support har som
  udgangspunkt ikke adgang …"). "Hello Cal gemmer intet om dig" ville være
  forkert, fordi appen gemmer brugerens egne data.
- **Brugerens valg (2026-09-23):** Support må kun få adgang, når brugeren
  selv har bedt om hjælp. Det flugter med `docs/PRIVACY.md`. Derfor er
  "Log ind som bruger" fjernet (routes, admin-knap og handoff-token), og
  sessioner, som en admin tidligere har udstedt, afvises. Der er ingen
  server-side læsning af brugerens klartekstdata til Support. Selve
  datapakken skal bygges og krypteres til Supports offentlige nøgle på
  brugerens enhed ud fra de valgte kategorier og periode (boks-fasen i
  `docs/PRIVACY.md`). Tilladelsesmodellen her er den del, pakken skal
  bygges ud fra.

Normaliserede produkt-søgeparametre (`ProductNutritionFeatures`, 1:1 med
`Product`):

- Kolonner med index: `sugarsPer100g`/`sugarPercent`,
  `fiberPer100g`/`fiberPercent`, `saltPer100g`/`saltPercent`,
  `wholeGrainPercent`/`isWholeGrain`, og til hver af dem en kilde
  (`ProductFeatureSource`) og en sikkerhed (confidence). Fuldkorn har
  desuden `wholeGrainEvidence`. kcal/protein/kulhydrat/fedt/mættet fedt
  ligger allerede på `Product` og kopieres ikke over. Tilsat sukker er ikke
  det samme som sukkerarter og skal have sit eget felt, hvis det bygges.
- Procenter er altid 0–100. En ukendt værdi er null, aldrig 0.
  Procent = g pr. 100 g kun når grundlaget er 100 g. Ved 100 ml er procenten
  null, fordi den kræver produktets densitet.
- Værdierne udledes deterministisk af den evidens, der allerede er gemt:
  næringsanalysen (`AiProductAnalysis`), `Product.nutritionExtra`
  (REMA-/OFF-nøgler pr. 100, HelloFresh pr. portion) og **varedeklarationen**
  (`ingredientsText`) plus forsidens claims. Brugeren præciserede, at
  fuldkorn skal læses ud fra indholdet og varedeklarationen, ikke gættes ud
  fra billeder, og AI'en bliver aldrig spurgt om procenterne. Derfor kan
  alt genberegnes uden ny OCR.
- Fuldkorn (`src/lib/whole-grain.ts`): en eksplicit total ("41% fuldkorn")
  vinder. Ellers lægges fuldkornsingredienser med procent af hele produktet
  sammen, og procenter i en underblanding ganges med blandingens egen
  procent (60% × 50% = 30%). Mangler en fuldkornsdel en entydig andel, bliver
  procenten null, mens `isWholeGrain` er true. `false`/0 bruges kun, når der
  findes en rigtig ingrediensliste uden fuldkorn. Ordene genkendes på dansk,
  svensk/norsk, engelsk, tysk, hollandsk, italiensk/spansk, fransk, finsk og
  polsk.
- Kilde-prioritet: MANUAL > PACKAGE_PERCENT > NUTRITION_LABEL = MANUFACTURER
  > EXTERNAL_DATABASE > DERIVED > AI_INTERPRETATION. Automatiske værdier
  følger den aktuelle evidens, og en manuel værdi overskrives aldrig
  automatisk.
- Beregningen kører, når et produkt oprettes (guidet flow/manuelt), ved
  import fra OFF (søgning og stregkodeopslag) og via
  `POST /api/admin/products/nutrition-features` (backfill i sider, også
  efter REMA-/HelloFresh-importer, der skriver direkte til databasen).

## 2026-09-24: Produktkategori styrer mængdeenheden (g / ml / cl)

- Ny kolonne `Product.productCategory` (enum `DRINK`/`GENERIC`/`PROCESSED`/`RAW`/`INGREDIENT`), nullable. Autoritativ for mængdeenheden: drikkevare → ml/cl, alt andet → g. Null/ukendt → g. Der gættes aldrig ud fra produktnavnet.
- Kilden er Excel/JSON-kolonnen "Type" (Drikkevare, Processed Foods, Råvarer, Pålæg, Slik …), som REMA1000-importen nu mapper ind (`scripts/rema1000-import/agent.py`, `PRODUCT_CATEGORY_BY_TYPE`). Importen kører ved hver container-start, så eksisterende REMA-varer backfilles ved næste deploy.
- Manuelt oprettede produkter ("Nyt produkt") vælger Madvare/Drikkevare i en dropdown. Generiske ingredienser (GenericIngredient) er altid `INGREDIENT` → g.
- Drikkevarer: cl bevares, når pakningsstørrelsen (`packageSizeText`) er angivet i cl (fx "33cl"); ellers ml (også for liter). Et fejlagtigt "g" på en drikkevare giver aldrig gram.
- Mængden gemmes fortsat i basisenheden (`amountGrams` = g eller ml, 1:1 mod næringsværdierne pr. 100). cl er kun visning (1 cl = 10 ml), så kcal-beregning og +/− trin (10 g/ml = 1 cl) er uændrede.
- Én fælles helper: `src/lib/product-display-unit.ts` (tests: `npm test`).

## 2026-09-24: Midlertidigt login med e-mail + kode

- Indtil rigtigt adgangskode-login er bygget, logger ejeren ind på `/login` med e-mail + kode (`src/app/api/auth/code-login/route.ts`). E-mail og kode ligger kun i serverens `.env.production` (`CODE_LOGIN_EMAIL`, `CODE_LOGIN_CODE`); tomme = slået fra.
- Boksens hovednøgle for denne konto afledes på serveren af `USER_SESSION_SECRET`, så den er den samme på alle enheder. Bevidst, midlertidig undtagelse fra "serveren kan ikke læse data"; fjernes, når rigtigt login findes.
- Login- og opret-siden viser ingen tekster om databehandling.

## 2026-09-24: HelloFresh kun i Opret ret; handlingsknapper i fuld bredde

- HelloFresh-boksen ("Genkend din ret") er fjernet fra Madvarer-siden. Opret ret når den via kameraet (`/camera?...&for=ret`). HelloFresh må ikke vises på Madvarer, produktsøgning, produkt-/ingrediensoprettelse eller produktvisning. Kameraets "Produkt"-fane (`mode=hellofresh`) vises kun med `for=ret`; ellers er kameraet altid stregkode.
- Almindelige primære/sekundære handlingsknapper fylder altid hele indholdsbredden. Fælles komponent: `ActionButton`/`ActionLink` (`src/components/hf/ActionButton.tsx`); regel i design.md §6.2. Små ikon-/inline-kontroller er undtaget. Eksisterende smalle knapper rettes efterhånden, når deres side alligevel ændres.

## 2026-09-25: Oprettelses-app som egen container fra samme image

- Medarbejder-hyldeappen (docs/OPRETTELSES-APP.md) bruger samme Postgres/Prisma-skema som Hello Cal og kører som sin egen container (`scan-app`) fra det samme Docker-image med `HELLOCAL_APP_MODE=scan`. `middleware.ts` serverer dér kun `/scan`, `/api/scan` og de delte AI-/produkt-API'er; i den almindelige app er `/scan` 404 (undtagen localhost). Valgt frem for et separat Next-projekt, så designet er 1:1 Hello Cal, og "Opret vare" genbruger `POST /api/products` uændret (produkter synlige i Hello Cal med det samme).
- Medarbejdere er `ScanWorker`-rækker, ikke `User`: eget login (brugernavn + adgangskode + TOTP) og egne cookies. Privacy-/vault-arkitekturen gælder ikke for ansatte (brugerbeslutning 2026-09-24); CPR og bank-reg.nr./konto krypteres server-side (AES-256-GCM, `SCAN_PII_KEY`), så admin kan afregne.
- Hyldegenkendelse: OpenAI Vision finder varer + afgrænsningsbokse; match mod databasen sker på navn/logo (stregkoder kan ikke ses på en hylde): tekstsøgning efter kandidater, derefter AI-vurdering med billedet. ≥ 80 % = findes, 50–80 % = usikkert. Medarbejderen kan rette tildelingen manuelt.
- Aflønning: én global sats, fastfrosset på hver indsendelse. Supplering af et eksisterende produkt betales som en hel vare, undtagen når medarbejderen selv oprettede det. Admin afgør altid accept/afvisning.

## 2026-09-25: Logo-robot bruger Google Vision, ikke Custom Search

- `scripts/logo-agent` (docs/LOGO-AGENT.md) isolerer logoet med Vision `LOGO_DETECTION` og finder kandidater med Vision `WEB_DETECTION`. Googles Custom Search JSON API er lukket for nye kunder og stopper 2027-01-01, så det mønster (image-agent) genbruges ikke til søgningen — kun container-/databasemønstret. Besluttet af brugeren 2026-09-24.
- ≥ 90 % og brandnavn på siden/linket → automatisk logo; ellers admin-kø "Logoer" (≥ 50 %). Hentede kandidater slettes 7 dage efter afgørelsen.
## 2026-09-24: Egne, private ingredienser ("Opret egen ingrediens")

- Linket "Opret egen ingrediens" under Opret ret åbner `/ingredients/new`. Brugeren angiver kun et navn (og mængde, når det er fra en ret) — ikke kcal/makroer, som brugeren ikke kan kende. Næringsindholdet står som ukendt, indtil admin har oprettet ingrediensen globalt.
- Den private ingrediens ligger kun i boksen (samling `privateIngredients`) og vises kun for brugeren selv: øverst i søgningen på Opret ret og på `/ingredients` ("Mine ingredienser": omdøb/slet). I retter bruges produkt-ID `private:<id>`, som aldrig sendes til serveren; retter med egne ingredienser kan ikke deles, før de er gjort globale.
- Admin varsles: serveren får kun navnet og en anonym engangsindbakke (`IngredientRequest`, ingen bruger-ID) plus e-mail `INGREDIENT_REQUEST_ADMIN`. Admin → "Ønskede ingredienser" kan rette navnet og "Tilføj globalt" (GenericIngredient med Frida-næring) eller afvise.
- Når admin tilføjer den globalt, overskriver den global brugerens private automatisk (valgt blandt brugerens to muligheder): indbakken leverer den globale ingrediens, og enheden erstatter den private i alle egne retter og sletter den private.

## 2026-09-25: Betingelser og Privatlivspolitik omskrevet (Lifesum-analyse)

- `/betingelser` er omskrevet, og der er en ny `/privatlivspolitik` (offentlig, linket fra Indstillinger). Strukturen er inspireret af Lifesums tekster, men indholdet er bevidst mere forbrugervenligt og med en let kæk tone: "Kort fortalt"-boks øverst, ingen annoncesporing/profiler/datasalg, ingen ensidige klausuler (fx lukning "af enhver grund" eller krav om at klage til os først), dansk ret og Forbrugerklagenævnet.
- Teksten må kun love det, koden faktisk gør (data ligger på serveren efter "Restore normal user login"). Ændres databehandlingen, skal `/privatlivspolitik` opdateres samtidig.
- Firmanavn, CVR-nr., adresse og kontakt-e-mail står som gule pladsholdere (`Placeholder` i `src/components/hf/LegalDocument.tsx`), indtil ejeren udfylder dem.
- Åbent: teksten lover et udtrykkeligt samtykke til helbredsdata (GDPR art. 9) ved oprettelse og samtykke til fortrydelsesret-afkald ved køb; ingen af delene er bygget endnu. Konto-sletning sker via Hjælpecenter (ingen selvbetjening). Juridisk gennemlæsning anbefales før lancering.

## 2026-09-25: Billede-dagbog-lås via WebAuthn, ikke native app

Kontakten "Kræver telefonens adgangskode for at vise" håndhæves i webappen med
WebAuthn (Face ID/Touch ID/telefonens kode, `userVerification: "required"`),
ikke via en native app. Formålet er at billederne ikke vises ved et uheld —
det er en visningslås, ikke kryptering af billederne. Siden låser igen, når
den går i baggrunden. Selfie-funktionen er fjernet efter brugerens ønske og
skal ikke genindføres uden en eksplicit anmodning.


- Samtykke til helbredsoplysninger (GDPR art. 9) gemmes som `User.healthDataConsentAt` (migration `20260925150000_health_data_consent`). E-mail-tilmelding kræver vippekontakten slået til (`HealthConsentToggle`); alle andre indloggede brugere uden samtykke (Google/Apple/Facebook, ældre konti) sendes af `ConsentGate` til `/samtykke`. Juridiske sider og admin er undtaget.
- Køb af Seriøs kræver en vippekontakt, der bekræfter straks-levering og forholdsmæssig refusion ved fortrydelse (forbrugeraftaleloven). Knappen er fortsat lukket, indtil en betalingsudbyder findes (`PAYMENT_AVAILABLE`).
- Åbent: konto-sletning sker via Hjælpecenter (ingen selvbetjening), og tilbagetrækning af samtykke sker via support. Juridisk gennemlæsning anbefales før lancering.



- Åbent: teksten lover et udtrykkeligt samtykke til helbredsdata (GDPR art. 9) ved oprettelse og samtykke til fortrydelsesret-afkald ved køb; ingen af delene er bygget endnu. Konto-sletning sker via Hjælpecenter (ingen selvbetjening). Juridisk gennemlæsning anbefales før lancering.

## 2026-09-25: Billede-dagbog-lås via WebAuthn, ikke native app

Kontakten "Kræver telefonens adgangskode for at vise" håndhæves i webappen med
WebAuthn (Face ID/Touch ID/telefonens kode, `userVerification: "required"`),
ikke via en native app. Formålet er at billederne ikke vises ved et uheld —
det er en visningslås, ikke kryptering af billederne. Siden låser igen, når
den går i baggrunden. Selfie-funktionen er fjernet efter brugerens ønske og
skal ikke genindføres uden en eksplicit anmodning.

## 2026-09-25: Billede-dagbogens billeder i IndexedDB, ikke localStorage

Brugeren tog 5 billeder; efter at have forladt siden var der 2 tilbage.
Årsag: billederne lå som fulde data:-URL'er i localStorage, som på iPhone kun
har ~5 MB pr. side — det tredje billede kunne ikke gemmes, fejlen blev slugt,
og billedet stod kun i hukommelsen, til siden blev forladt. Nu:

- Billederne gemmes som Blobs i IndexedDB (`src/lib/photo-diary-store.ts`),
  skaleret ned til højst 1600 px på den længste side (JPEG 0,85).
- Et nyt billede vises først, når det faktisk er gemt; slår det fejl, vises en
  fejltekst i stedet for et billede, der forsvinder igen.
- Gamle billeder i localStorage flyttes automatisk over og nøglen ryddes.
- Kameraet må ikke udløse låsen (den låser ellers, når siden kortvarigt
  skjules af kameraet, og det nye billede ligner så et tabt billede).
- Billederne ligger fortsat kun på enheden (ingen server-upload) — samme
  produktvalg som før. Browseren bedes om vedvarende lager
  (`navigator.storage.persist()`), men sletter brugeren Safaris websitedata,
  eller skifter telefon, er billederne væk.

## 2026-09-25: Forsidens tal-hjul — ikon til højre, én linje, vifte

Brugerens krav (gentaget flere gange): ikonet står til HØJRE for tallet, hvert
tal på én linje uden "/ mål"-linje, samme luft mellem alle rækker, op til 3
tal over og 3 under midten, en svag vifte-hældning (2° pr. række: rækker over
midten med venstre ende opad, rækker under med venstre ende nedad) og ingen
beskæring af lange tal. `docs/UI.md` er rettet tilsvarende; den gamle regel om
ikon foran tallet gælder ikke længere. Indtil brugeren har slået nok felter
til, fylder to opfundne eksempeltal (søvn, puls) de tomme pladser — de
forsvinder af sig selv, når flere rigtige felter vælges.

## 2026-09-25: Stregkode-scanning — egen afkodningsløkke, lodret/skæv aflæsning og AR-afkodning

Brugerens test på iPhone (skærmbilleder): dæmpningen om guide-boksen var for
sort og forsvandt brat; en statisk lysegrøn firkant dukkede op et forkert
sted og blev stående; lodrette stregkoder kunne ikke læses (at dreje
telefonen drejer hele webappen, så det er ingen løsning); og ønsket var, at
afkodningen *ses*: stregerne tegnes, og tallene skrives som overlay oven på
den rigtige stregkode.

- **Egen afkodningsløkke** (`src/lib/barcode-frame-scanner.ts`) i stedet for
  @zxing/browser's `decodeFromConstraints`. Kun viewfinderets synlige
  kvadrat afkodes, så resultat-punkter i canvas-pixels / sidelængde er
  direkte en brøkdel af viewfinderet (den gamle video→skærm-omregning ramte
  ved siden af). Hvert billede prøves både som det er og drejet 90°, så en
  stregkode på højkant læses med telefonen holdt normalt. ZXing's egen
  TRY_HARDER-rotation bruges ikke: @zxing/browser's canvas-kilde opdaterer
  ikke bredde/højde ved rotation af et ikke-kvadratisk billede. Formater
  begrænset til EAN-13/EAN-8/UPC-A/UPC-E.
- **Stregkodens rigtige vinkel og højde** måles i billedet efter hver
  aflæsning: ZXing returnerer kun den pixelrække, den læste. Højden findes
  ved at gå vinkelret ud fra læselinjen, til stregmønstret forsvinder;
  vinklen ved at sammenligne stregmønstret på to parallelle linjer (trinvis,
  så gentagne stregmønstre ikke giver en forkert top). Verificeret i
  Chromium mod tegnede EAN-13/EAN-8 ved 0–180°: vinkel inden for ±0,3°,
  bredde eksakt.
- **AR-afkodning**: den aflæste kode gen-kodes til sit ægte stregmønster
  (`src/lib/barcode-pattern.ts`), og `BarcodeScanOverlay` tegner det streg
  for streg + ciffer for ciffer oven på den fysiske stregkode (se design.md
  §6.11). Enhver aflæsning i billedet starter afkodningen — kravet om at
  koden skal ligge inden i boksen og den røde/grønne kant er fjernet.
- **Ikke fundet** gemmes pr. kode i sessionen, så samme stregkode i billedet
  ikke looper animation + opslag; en anden kode kan scannes med det samme.
- **UPC-E har egen læser** (`src/lib/upce-reader.ts`): @zxing/library's
  UPC-E-læser returnerer aldrig et resultat (den taber de afkodede cifre,
  tjekker EAN-kontrolciffer/slutvagt i stedet for UPC-E's og udvider
  UPC-E→UPC-A forkert). Vores læser genbruger ZXing's række-løkke
  (`OneDReader`), så position/retning virker som for de øvrige formater.
  Verificeret i Chromium: EAN-13, UPC-A, EAN-8 og fem UPC-E-koder ved
  0/90/180/−90/14/−20/75° — alle læst korrekt, vinkel inden for 0,5°.

## 2026-09-24: G11 — E-numre, toksiner og advarsel ved usundt fedt

- Opsætning har to nye kontakter, "Vis E-numre" og "Vis toksiner" (felterne `User.showAdditives`/`User.showToxins`, fra som standard; migration `20260925120000_product_additives_toxins_toggles`). E-numre-sektionen på produktsiden vises nu kun, når kontakten er slået til.
- Toksiner er en kurateret, statisk liste i `src/lib/toxins.ts` (ca. 23 stoffer: plantegifte, skimmelgifte, tungmetaller, akrylamid, alkohol, koffein m.fl.). Hver post har kildelinks til Fødevarestyrelsen/EFSA. Råd til gravide/ammende og fertilitet står kun, hvor Fødevarestyrelsen selv giver et råd, og vises først (brugerens ønske: særligt vigtigt ved graviditet, amning og fertilitet).
- Matchning sker mod produktnavn + `Product.ingredientsText`. Et fund betyder "fødevaretypen er kendt for stoffet", ikke en måling af produktet; det står i UI'et.
- Statistik-boksen "Toksiner" er en pladsholder ("—") ligesom E-numre, fordi registreringer ikke har et snapshot af indholdsstoffer.
- "Vis udvidet næringsindhold" er åben som standard på produktsiden, og beskrivelsen i Opsætning siger, at værdierne står nederst på produktsiden.
- Mættet fedt og transfedt vises med en advarselstrekant (statistik-bokse og produktsidens udvidede næringsindhold). Umættet fedt får ingen advarsel.

## 2026-09-26: Billede-dagbog som loop-karrusel

Billeder vises i en vandret karrusel (ikke grid, ikke 1:1), ældste til venstre og nyeste til højre, nyeste i midten ved start. Loop kun ved 3+ billeder, så samme billede aldrig står på begge sider samtidig; ved 2 billeder stopper den ved kanterne. Kun et vindue på 7 kort renderes, så loopet ikke kræver kopier af hele listen. Dato/tid står under billedet, aldrig som overlay.

## 2026-09-26: Tooltips og start-up tips (Indstillinger → Visning)

- To vippekontakter under Visning: "Vis tooltips" (små hjælpetekster via `HelpTip`, `src/components/hf/HelpTip.tsx`) og "Vis start-up tips". Begge er slået til som standard og gemmes pr. enhed i localStorage (`src/lib/help-prefs.ts`), samme mønster som Kalendervisning.
- Start-up tips er 1-sides overlays med én fast standard (`StartupTipOverlay`): "Luk" øverst til højre, ikon + titel + tekst, evt. én stor knap, og "Slå fra" nederst til højre (slår alle start-up tips fra). Højst ét tip pr. besøg, kun for indloggede brugere med samtykke, aldrig på login-, samtykke-, juridiske eller admin-sider (`StartupTipsGate` i root layout).
- Tips står i `STARTUP_TIPS` (`src/lib/startup-tips.ts`) og vises i rækkefølge. Et tip er færdigt, når det lukkes, eller når funktionen bruges (`markStartupTipSeen(id)` kaldes fra funktionens egen kode). Første tip er altid "Dine data er dine" med "Læs mere" til `/privatlivspolitik`.

## 2026-09-26: Integrationer — egen side pr. app, til/fra pr. datatype, og push

Brugerens krav: appen skal også kunne *sende* data til Health og de øvrige
integrationer, og brugeren skal kunne vælge til/fra, hvad der synkroniseres —
både når integrationen slås til og bagefter.
- Hver app har sin egen side `/settings/integrations/<app>` (fx
  `apple-health`, `google-health`, `strava`). Oversigten er nu kun kort, der
  linker dertil. Siden har to grupper kontakter: "Hent til Hello Cal" og
  "Send fra Hello Cal til <app>". Valget gemmes med det samme
  (`PUT /api/integrations/<app>/settings`) på `Integration.syncSettings`
  (migration `20260926190000_integration_sync_settings`). Alt, appen kan, er
  slået til, indtil brugeren slår det fra.
- Valget kan træffes før "Forbind": OAuth beder kun om skriveadgang til de
  typer, der er slået til. Slår man senere en skrivetype til, som adgangen
  ikke dækker, viser siden "Forbind igen".
- Hvad hver app kan (`src/lib/integrations/sync-settings.ts`):
  Apple Health/Health Connect henter vægt, fedt%, træning, skridt, kalorier,
  puls, søvn, vand, højde/BMI og modtager måltider, vand, vægt og træning.
  Google Health henter vægt/træning/skridt og modtager måltider
  (nutrition-log), vand (hydration-log) og vægt. Strava henter og modtager
  træning. Withings, Polar og Fitbit tager ikke imod data (kun hent).
  Samsung Health går via Health Connect.
- Kun data, brugeren selv har lavet i Hello Cal, sendes (registreringer,
  vand, manuelle vejninger, manuel træning) — aldrig data hentet fra en
  integration, så intet sendes i ring. Kun data lavet efter tilkoblingen.
  Rettelser/sletninger i Hello Cal sendes ikke videre.
- Cloud-integrationerne synkroniseres (hent + send) automatisk hvert 15.
  minut i scheduleren, ikke kun når siden åbnes.
- Apple Health/Health Connect skrives af Hello Cal-appen på telefonen:
  `GET /api/integrations/healthkit/export` giver brugerens valg og de data,
  der skal skrives; ingest filtrerer efter valget
  (docs/HEALTHKIT_COMPANION.md). Den native app er stadig ikke bygget.

## 2026-09-26: Integrationer: start-vægt og målingstidspunkt

- Vejninger fra Withings, Google Health, Fitbit, Apple Health/Health Connect tilføjes altid som nye vejninger med målingens eget tidspunkt (`weighedAt`), aldrig synkroniseringstidspunktet. "Aktuel vægt" er dermed seneste vejning (SPECIFICATION §4).
- Start-vægten (`User.weightKg`) overskrives aldrig af en integration; er den tom, bliver den ældste synkroniserede vejning start-vægt.
- Samme vejning (±2 min, ±0,05 kg) eller træning (samme sport, ±5 min) fra to kilder gemmes kun én gang.
- Sportstyper normaliseres til Statistik-nøglerne (`normalizeSportType` i `src/lib/sport-icons.ts`); dagssummer (fx skridt) opdateres ved næste synkronisering. Kode: `src/lib/integrations/store-items.ts`.
