# Oprettelses-app — krav og implementering

Dato: 2026-09-24 (krav), 2026-09-25 (bygget). Alle spørgsmål er besvaret, og
appen er bygget — se "Implementeringsstatus" nederst for hvad der mangler,
før den kan bruges i drift.

Dette bygger videre på den tidligere afklaring i
[`PROJECT-BOUNDARIES.md`](PROJECT-BOUNDARIES.md) (2026-09-14), som allerede
indeholder bekræftede krav til en medarbejder-produktoprettelsesapp. Den
afklaring blev bevidst sat på pause af brugeren for at afklare
projekt-/mappegrænser først; se også [`areas/README.md`](areas/README.md),
som dengang anbefalede **ét** repository/Next-app/Prisma-skema og at
"separate apps/repositories og databaser er ikke vedtaget". Dagens brief
beder eksplicit om separate containere til den nye app — det er en direkte
konflikt med den tidligere anbefaling; brugeren har nu valgt samme database +
ny container (se "Besvarede spørgsmål" A).

## Formål

En ny, invite-only medarbejderapp i samme grunddesign som Hello Cal.
Ansatte fotograferer en hel varehylde, får et skærmoverlay der viser hvilke
produkter der allerede er oprettet i systemet, og opretter manglende
produkter direkte (uden forudgående admin-godkendelse). Admin får et nyt
"scan-invites"-punkt til at invitere medarbejdere og et medarbejdermodul til
at se/godkende/afvise scannet arbejde med henblik på aflønning (selve
udbetalingen bygges ikke endnu — kun registrerings-/oversigtsbackend).

## Bekræftet tidligere (2026-09-14, uændret, genbruges her)

- Ansatte oprettes manuelt i admin og får unik adgang til medarbejderappen.
- Tung billedbehandling forventes via OpenAI API.
- Hyldefoto → overlay viser oprettede og usikre produkter; tryk åbner normal
  oprettelse; hyldebilledet opdateres automatisk efter oprettelse.
- Oprettelse har fire bokse (stregkode, ingredienser, energi, produktbilleder
  op til fire billeder) + SEND-knap.
- Indsendelser skal kunne gemmes lokalt og behandles i baggrunden.
- Produkter bliver direkte tilgængelige i Hello Cal uden admin-godkendelse;
  manglende/usikre data blokerer ikke tilgængelighed.
- Manglende/usikre data giver udråbstegn i hyldeoverlay og på adminlisten.
- Advarsel om mangelfuldt produkt vises først efter afsluttet oprettelse.
- Rettelse bruger samme oprettelsesskærm med producent/vægt/varenavn/billede
  øverst til identifikation.
- Korrekt udfyldte bokse får 60% opacitet-overlay + flueben.
- Produktrettelse har kommentarfelt + "Accepter fejl og indberet"; admin får
  fejlbeskeden, arbejdet tæller til aflønning, produktet forbliver mangelfuldt.
- Fanen "Ansatte" viser scanninger/oprettelser pr. måned + total, antal
  produkter og penge til udbetaling.
- Fast beløb pr. produkt; kun fødevarer kan godkendes til aflønning.
- Admin afviser med årsag via overlay med forudbestemte årsagsknapper +
  valgfrit kommentarfelt.
- Produktets datakvalitet og arbejdets accept til aflønning holdes adskilt.

Endnu ikke afklaret dengang (stadig åbent, gentaget som spørgsmål nedenfor):
håndtering af eksisterende stregkoder/supplering, satsstørrelse og evt.
variation pr. medarbejder, automatisk vs. manuel fødevare-vurdering, konkrete
afvisningsårsager, tekniske kriterier for "korrekt udfyldt", datamodel,
API-grænser, synkronisering, udbetalingsregistrering.

## Nyt fra dagens brief (2026-09-24)

**Adgang og login**
- Kun invite-only: nyt admin-punkt "scan-invites" opretter/inviterer brugere.
- Login: brugernavn + adgangskode + tofaktor-godkendelse.

**Forside/kernefunktion (logget ind)**
- Kun to knapper i bunden: "Billede af hylde" og "Opret vare".
- "Billede af hylde": viser seneste hyldebillede med skærmoverlay —
  grønt flueben eller minus pr. produkt, plus 1px kant der følger varens
  kontur, som angiver om produktet allerede findes i databasen.
- Hvert produkt på hyldebilledet registreres med navn + logo (alt der kan
  udtrækkes af billedet) til sammenligning med eksisterende database.
- Når en vare oprettes og matches mod hyldebilledet, skifter dens markering
  til grønt flueben automatisk.
- Swipe mellem tidligere hyldebilleder. Alt er portræt-layout.
- Øverst til venstre: cirkel med kamera-ikon → tag nyt hyldebillede.
- Øverst til højre (modsat hjørne): tandhjul → slet billedet.
- "Opret vare": fire bokse (produktbillede, stregkode, energi, indhold) +
  sort "Opret"-knap, samme design som Hello Cal.

**Lokation**
- Præcise koordinater gemmes ved billedtagning.
- Appen (i hvert fald hylde-fotofunktionen) må kun vises/bruges når
  lokationsdata er slået til.
- Backend skal vise tidspunkt for både billede og produktoprettelse.

**Brugerikon (øverst til højre, som i Hello Cal)**
- Menupunkter: Profil, Bankoplysninger, Historik, Ikke afregnet, Beskeder,
  Kontakt, Log-ud.
- **Historik**: øverst totalt antal oprettede produkter + samlet udbetalt
  beløb. Herunder uger som accordions (ugenummer + periode mandag–søndag);
  øverste/seneste uge er altid udfoldet som standard. Foldet ud viser hver
  uge selv hvor mange billeder/penge for den uge.
- **Profil**: adresse, mail, CPR-nummer, navn, alder, køn — med
  versionering (tidligere ændringer skal kunne ses).
- **Bankoplysninger**: bankforbindelse (konto + registreringsnummer) eller
  PayPal-konto.
- **Ikke afregnet**: samme visning som historik, men ekstra kolonne med
  hvilken butik billedet er taget i (chain/store, jf. eksisterende
  Store-tagging fra REMA1000-import).

**Admin-backend**
- Data om brugere: mail, navn m.m., og hvilke produkter de har oprettet.
- Admin kan afvise billeder.
- Hver bruger har egen adminside: ugentligt antal scannede billeder, med
  mulighed for at acceptere/afvise (til aflønning).
- Aflønning: fx 1 kr. pr. billede — selve udbetalingsflowet bygges ikke nu,
  men backend/brugeroversigt skal understøtte det senere.

**Deling af data**
- Nye produkter skal være direkte synlige i Hello Cal med det samme.
- Produktoprettelsesprocessen i den nye app skal ske "på præcis samme måde"
  som den eksisterende — dvs. genbruge eksisterende produkt-/AI-kontrakt
  (`docs/AI.md`, `docs/DATABASE.md`, `src/app/api/products`,
  `src/app/api/ai/extract-nutrition`, `src/app/api/ai/extract-ingredients`)
  frem for at bygge en parallel oprettelsesmotor.
- Sandsynligvis separate containere til selve appen, men den skal kunne
  "snakke sammen" med både Hello Cal og admin.

## Ikke-mål lige nu

- Intet sættes i produktion.
- Selve pengeudbetalingen (faktisk overførsel) bygges ikke — kun
  registrering af godkendt/afvist arbejde og beløb i backend.
- Ingen arkitektur- eller deploymentændring udføres, før spørgsmålene
  nedenfor er besvaret (jf. AGENTS.md: ingen store omskrivninger eller
  ændret deploymentarkitektur uden eksplicit godkendelse).

## Besvarede spørgsmål (2026-09-24, fire runder i samtale 548ca51e)

Disse svar er bindende for implementeringen og erstatter de åbne spørgsmål,
der stod her før.

**A. Arkitektur**
- Samme Postgres-database og samme Prisma-skema som Hello Cal/admin, men
  medarbejder-UI'et kører i sin **egen container** (egen Next.js-app, nyt
  image i samme compose-stak — samme mønster som REMA-/quality-control-
  agenterne). Ingen separat database og intet API-lag imellem.

**B. Adgang og følsomme data**
- Invitation: admin opretter navn + mail under "scan-invites". Medarbejderen
  får en mail med et tidsbegrænset opsætningslink og vælger selv adgangskode
  og tofaktor (samme mønster som Hello Cals eksisterende invite-flow).
- Tofaktor: genbrug præcis den mekanisme admin-login allerede har
  (`src/lib/admin-auth.ts`): adgangskode + enten autenticator-app (TOTP)
  eller passkey/Face ID (WebAuthn). Medarbejderen vælger selv.
- Privacy-/vault-arkitekturen gælder **ikke** for ansatte (brugerens svar).
  CPR, adresse og bankoplysninger gemmes som almindelige server-side
  admin-data (krypteret i hvile som øvrige server-hemmeligheder), ikke i
  klient-boksen.

**C. Hyldegenkendelse og overlay**
- Genkendelse: OpenAI Vision på hele hyldebilledet — returnerer synlige
  produkter med afgrænsningsboks, navn og logo-/brandtekst.
- Match: stregkoder kan ikke ses på et hyldebillede, så match sker på
  **navn/logo (AI-vurdering)** mellem hyldeudsnittet og databasens produkter.
- Medarbejderen kan manuelt rette en forkert tildeling i overlayet
  ("ret tildeling"), så et fejlmatch ikke låser et udsnit.

**D. Aflønning og fødevarevurdering**
- Én global sats for alle (fx 1 kr.). Ingen sats pr. medarbejder i første
  version.
- Admin vurderer altid selv fødevare/ikke-fødevare og accept/afvisning —
  ingen automatisk regel. Systemet giver admin en **ekstra tydelig
  advarsel**, når en indsendelse mangler energitabel og/eller
  ingrediensliste (ud over den almindelige udråbstegn-markering).
- Supplering af et produkt, hvis stregkode allerede findes: tæller som en
  hel, betalt vare (stregkoden skal fotograferes igen) — **undtagen** hvis
  det er medarbejderen selv, der oprindeligt oprettede den mangelfulde vare.
- Afvisningsårsager: start med en fornuftig liste, som admin selv kan
  redigere/tilføje uden ny kodeopgave. Startliste: Ikke en fødevare ·
  Ulæseligt/sløret billede · Dublet af eksisterende produkt ·
  Forkert/manglende stregkode · Mangler energitabel/ingredienser · Andet.
  Plus valgfrit kommentarfelt.

**E. Lokation og billeder**
- **Hele appen** spærres, indtil lokationstilladelse er givet (også
  historik/profil).
- Tandhjul → sletning: billedet **slettes helt** (database + lager), også
  for admin.
- Swipe: alle hyldebilleder medarbejderen nogensinde har taget, nyeste først.

**F. Profil, bank og beskeder**
- Kun admin redigerer profil og bankoplysninger (med versionering i admin).
  Medarbejderen ser dem read-only.
- "Beskeder" er en **tovejs** dialog mellem medarbejder og admin. "Kontakt"
  i menuen åbner den samme beskedtråd (ikke en separat side). Almindelige
  Hello Cal-brugere får ikke denne funktion.

**Standardvalg (ikke spurgt, kan ændres):**
- Uger er ISO-uger, mandag–søndag.
- Usikkert markerede produkter på et hyldebillede forbliver markeret, indtil
  de oprettes/rettes eller billedet slettes; intet automatisk udløb.

## Implementeringsstatus (2026-09-25)

Brugeren sagde 2026-09-24: "Ja kør det hele og byg det. Ny container og hele
lortet". Bygget i denne omgang:

- **Container**: `scan-app` i `compose.production.yaml` — samme image og
  database som `app`, men `HELLOCAL_APP_MODE=scan`, så `middleware.ts` kun
  serverer `/scan`-ruterne (+ de delte AI-/produkt-API'er). Port
  `SCAN_APP_HTTP_PORT` (standard 3101). I den almindelige app giver `/scan`
  404 (undtagen på localhost).
- **Database**: migration `20260925090000_scan_app` (medarbejdere,
  profilversioner, hyldebilleder, fundne varer, indsendelser, afvisnings-
  årsager med startliste, global sats 1 kr., udbetalinger, beskeder).
- **Login**: brugernavn + adgangskode + TOTP (`src/lib/scan/auth.ts`),
  invitation via tidsbegrænset link (7 dage) sendt med
  `sendTransientMail`; kan mailen ikke sendes, vises linket én gang for
  admin. Passkey/Face ID som alternativ 2. faktor er **ikke** bygget endnu.
- **App** (`src/app/scan/**`): Billede af hylde (overlay med ✓/−/?, 1 px
  kant, swipe, kamera-cirkel, tandhjul = slet helt, "Opret denne vare",
  "Ret tildeling"), Opret vare (Hello Cals fire bokse + felter, sendes
  uændret videre til `POST /api/products`; eksisterende stregkode =
  supplering), menu med Profil, Bankoplysninger (read-only), Historik,
  Ikke afregnet (butik til højre), Beskeder/Kontakt (samme tovejs-tråd),
  Log ud. Hele appen spærres uden lokation (efter login).
- **Admin**: `/admin/scan-invites` (invitér, oversigt, sats, redigerbare
  afvisningsårsager) og `/admin/scan-invites/[id]` (profil + bank med
  versionering, ugevis godkend/afvis med årsag + kommentar, ekstra tydelig
  advarsel ved manglende energitabel/ingrediensliste, registrér udbetaling,
  beskeder).
- **Butik**: udledes af koordinaterne via Google Places, hvis
  `GOOGLE_PLACES_API_KEY` er sat; ellers "ukendt butik".

Mangler før den kan bruges i drift (kræver brugeren/serveren):

1. `scan-app` startes ikke automatisk af GitHub-deployet endnu: linjen
   `up -d db migrate app` i `.github/workflows` skal have `scan-app` tilføjet
   (en ændring af produktionsdeployet, som kræver brugerens godkendelse).
2. Et hostname (fx `scanhellocal.packroff.dk`) i Cloudflare Tunnel → NAS-port
   3101, og `SCAN_APP_BASE_URL` i `.env.production`.
3. Anbefalet: egne hemmeligheder `SCAN_SESSION_SECRET` og `SCAN_PII_KEY`
   (ellers bruges `ADMIN_SESSION_SECRET`). `SCAN_PII_KEY` må ikke ændres
   senere — så kan gemte CPR-/bankfelter ikke længere læses.
4. Valgfrit: `GOOGLE_PLACES_API_KEY` til butiksnavn.
