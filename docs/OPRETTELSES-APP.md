# Oprettelses-app — planlægning (kladde, IKKE implementeret)

Dato: 2026-09-24. Dette er en kravsamling og spørgsmålsliste, ikke en
implementeringsstatus. Ingen kode, database eller deployment er ændret som
del af dette dokument. Intet i dette dokument må sættes i produktion, før
spørgsmålene nedenfor er besvaret og brugeren har bedt om implementering.

Dette bygger videre på den tidligere afklaring i
[`PROJECT-BOUNDARIES.md`](PROJECT-BOUNDARIES.md) (2026-09-14), som allerede
indeholder bekræftede krav til en medarbejder-produktoprettelsesapp. Den
afklaring blev bevidst sat på pause af brugeren for at afklare
projekt-/mappegrænser først; se også [`areas/README.md`](areas/README.md),
som dengang anbefalede **ét** repository/Next-app/Prisma-skema og at
"separate apps/repositories og databaser er ikke vedtaget". Dagens brief
beder eksplicit om separate containere til den nye app — det er en direkte
konflikt med den tidligere anbefaling og er derfor et åbent spørgsmål nedenfor
(spørgsmål A), ikke en besluttet arkitektur.

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

## Åbne spørgsmål

Se den separate spørgsmålsrunde i chatten (AskUserQuestion). Kategorier:

**A. Arkitektur og deling af data**
- Separate containere/app vs. udvidelse af nuværende repo/skema (konflikt
  med 2026-09-14-anbefalingen).
- Delt database (samme Postgres/skema, ny app-container) vs. API mellem apps.
- Hvor bor medarbejder-/aflønningsmodellerne: nyt Prisma-skema i samme
  database, eller helt separat database?

**B. Adgang, sikkerhed og følsomme data**
- Invitationsmekanisme: hvordan sætter medarbejderen sin egen adgangskode?
- Tofaktor-metode: SMS, autenticator-app (TOTP) eller e-mail-kode?
- CPR-nummer og bankoplysninger er meget følsomme data. Hello Cal er midt i
  en gennemgribende privacy-by-architecture/vault-omlægning
  (`docs/PRIVACY.md`, seneste commits om vault). Skal medarbejderdata følge
  samme klient-krypterede vault-mønster, eller er det almindelige
  server-side admin-data (fordi admin skal kunne se det for at afregne)?

**C. Produktgenkendelse og overlay**
- Hvilken model/tjeneste genkender produkter på hyldebilledet (OpenAI
  Vision, som resten af appen, eller andet)?
- Hvad afgør "allerede oprettet": stregkode-match, visuelt/navn-match, eller
  en direkte kobling til det specifikke billedudsnit?
- Hvad sker der med usikkert markerede produkter over tid (kø til senere
  gennemgang, automatisk udløb, andet)?

**D. Aflønning og fødevarevurdering**
- Er raten (fx 1 kr./billede) global fra start, eller skal den kunne variere
  pr. medarbejder allerede i datamodellen?
- Betales der for at supplere/rette et produkt med en stregkode der allerede
  findes, eller kun for helt nye produkter?
- Vurderes "er det en fødevare" manuelt af admin, automatisk, eller en
  kombination (AI foreslår, admin bekræfter)?
- Konkrete faste afvisningsårsager (liste) — skal bruges i afvisnings­
  overlayet.

**E. Lokation, billeder og oprydning**
- Skal hele appen være utilgængelig uden lokationstilladelse, eller kun
  hylde-fotofunktionen?
- Sletning via tandhjul: soft delete (bevares til admin-log) eller reel
  sletning af billedet?
- Hvor mange tidligere hyldebilleder skal kunne swipes igennem (alle, eller
  en grænse)?

**F. Historik, profil og beskeder**
- Kan medarbejderen selv redigere profil/bankoplysninger (med
  versionering), eller er det admin, der redigerer, og medarbejderen kun ser?
- Er "Beskeder" enkeltrettet (admin → medarbejder) eller en reel dialog?
- Bekræft ISO-ugenumre og mandag–søndag-perioder som eneste tidsinddeling.
