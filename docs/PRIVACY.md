# HELLO CAL — privacy-by-architecture (bindende kontrakt)

Vedtaget 2026-09-23 af brugeren. Se `docs/DECISIONS.md` samme dato for
baggrund og brugerens valg. Denne fil er kontrakten, som al ny kode skal
overholde. Hvor ældre dokumentation eller kode strider mod den, gælder denne.

## Mål

Hello Cal skal være **teknisk ude af stand til** at læse en enkelt brugers
private data. Det er ikke nok, at en administrator mangler rettigheder:
oplysningerne må ikke findes læsbart og samlet noget sted på serveren.

## Tre adskilte dataverdener

1. **Identitet** (`User`, `Passkey`, `KeyEnvelope`, `RecoveryShare`,
   `RecoveryRequest`, abonnement/betaling, points):
   tilfældigt konto-ID, passkey-offentlige nøgler, `emailHash`
   (HMAC-SHA256 med server-pepper, aldrig selve adressen), krypterede
   nøglekuverter. **Ingen sundheds- eller dagbogsdata.**
2. **Boks** (`Vault`, `VaultRecord`, `VaultInboxItem`):
   alle private brugerdata, krypteret på brugerens enhed.
   `Vault` har **ingen** reference til `User`. Boksen findes via
   `SHA-256(vaultToken)`, hvor `vaultToken` afledes af brugerens hovednøgle,
   som serveren aldrig har.
3. **Statistik** (`AnalyticsBucket`): kun grupperede tællinger
   (dag, land, regionsgruppe, aldersinterval, køn, metrik, interval, count,
   sum). Intet bruger-, konto-, boks- eller enheds-ID.

Ingen fælles nøgle eller fremmednøgle mellem de tre.

## Nøglehierarki (klient, WebCrypto)

- **MK** (hovednøgle, 32 tilfældige bytes) genereres på enheden ved oprettelse.
- Afledt via HKDF-SHA256 fra MK:
  - `dataKey` (AES-256-GCM) krypterer hver post i boksen,
  - `tagKey` (HMAC) giver samlingsnavne som uigennemsigtige tags (serveren kan
    ikke se, om en post er "vægt" eller "menstruation"),
  - `vaultToken` identificerer boksen over for serveren.
- **Boks-nøglepar** (X25519): offentlig nøgle ligger på `Vault` og i
  integrationer, så serveren kan *forsegle* data til boksen (import fra
  Fitbit/Withings/HealthKit, svar fra support) uden at kunne læse dem. Den
  private nøgle ligger krypteret med `dataKey` i boksen.
- MK forlader aldrig enheden ukrypteret. Den gemmes på serveren kun som
  **kuverter**:
  - `PASSKEY_PRF`: MK krypteret med en nøgle afledt af passkeyens
    WebAuthn PRF-output (samme output på alle enheder med en synkroniseret
    passkey, fx iCloud-nøglering).
  - `RECOVERY`: MK krypteret med en nøgle afledt af `R = F ⊕ S`.
- Browsere uden PRF: MK gemmes lokalt i IndexedDB, krypteret med en ikke-
  eksporterbar enhedsnøgle. Nye enheder kræver så gendannelsesfilen.

## Login og e-mail

- Almindelige brugere logger ind med **passkey**. Ingen adgangskoder.
- E-mail gemmes kun som `emailHash`. Links sendes til den adresse, brugeren
  netop har tastet; adressen persisteres aldrig (heller ikke i
  `OutboundMessage`). Uden SMTP kan e-mail-flows ikke gennemføres i
  produktion.
- Navn, fødselsdato, køn, højde, vægt, region til visning m.m. ligger i
  boksen. Serveren kender kun det, der er nødvendigt for en funktion uden at
  være personhenførbart (fx `region` for søgerangering, `appLocale`).
- Admin-/medarbejderkonti er personale og må have klartekst-e-mail.

## Gendannelse (delt nøgle, brugeren downloader sin halvdel)

- Ved oprettelse genereres `F` (32 bytes) og `S` (32 bytes) på enheden.
  `R = F ⊕ S`. MK krypteres med `HKDF(R)` → `RECOVERY`-kuvert.
- Brugeren **downloader** `F` som gendannelsesfil. Serveren ser aldrig `F`;
  den gemmer kun `SHA-256(F)` og `S` (`RecoveryShare`).
- Mistet adgang: brugeren bekræfter sin e-mail (link), uploader filen
  (klienten sender kun `SHA-256(F)`) og opretter en gendannelsessag med
  sagsnummer. Support bekræfter identiteten ved personlig henvendelse og
  godkender. Først da frigives `S` (tidsbegrænset). Klienten danner `R`,
  åbner kuverten og binder en ny passkey.
- Serveren alene (`S` + kuvert) eller filen alene (`F`) kan ikke åbne MK.
- Mistes både alle enheder og filen, er data tabt. Kontoen kan genstartes
  tom via e-mail.
- Der gemmes ikke IP-adresse, placering eller "senest indlogget sted" som
  identitetsbevis.

## Support

- Ingen admin-override, ingen "log ind som bruger", ingen universalnøgle.
- Brugeren opretter en `SupportGrant` (valgte datatyper, datoperiode,
  udløb). Klienten dekrypterer de valgte data, krypterer pakken til supports
  offentlige nøgle og uploader den. Support ser kun pakken og et sagsnummer.
- Adgang udløber automatisk og kan tilbagekaldes med det samme (pakken
  slettes).

## Statistik

- Klienten beregner buckets lokalt og sender dem uden identifikatorer.
- Analytics-endpointet gemmer ikke IP, auth-header, session, bruger-/enheds-
  ID eller fuld user-agent. Reverse proxy/app-logs må ikke logge dette
  endpoint med IP.
- Alder kun som 5-års-interval, geografi kun som land/region-gruppe.
- Visning kræver `MIN_COHORT_SIZE = 25`. Mindre grupper returneres som
  "for få". Differential privacy lægges oven på avancerede forespørgsler.
- Statistik er aggregater; de kan ikke gendanne en enkeltbruger.

## AI (OpenAI)

- Billeder genkodes på serveren før afsendelse (fjerner EXIF/GPS/enhed/tid).
- Kald sker via Hello Cals server; ingen bruger-, konto-, boks- eller
  enheds-ID sendes med.
- Selve billedindholdet kan stadig vise noget personligt (ansigt, kvittering);
  derfor beskæres til produktet, hvor det er muligt.

## Sociale funktioner

- "Invitér en ven" og "videresend til en ven" bruger engangslinks. Serveren
  gemmer kun, at et link er brugt, ikke hvem der sendte til hvem.
- Nyhedsbreve kræver en separat, frivillig tilmelding, der ikke er koblet til
  kontoen.

## Backup

- Backups af identitet og boks indeholder kun ID'er og ciphertext.
- Backups taget før overgangen indeholder klartekst og skal slettes, når
  overgangen er gennemført.

## Implementering (2026-09-24)

- Klient: `src/lib/vault/` (kryptering, boks, passkeys, enhedslager).
  Private endpoints håndteres på enheden af `localApi` +
  `src/lib/vault/handlers/*` med samme JSON som de tidligere serverruter.
- Hello Doc: rapporten krypteres på ejerens enhed med en nøgle pr. deling,
  som kun står i lægens link; invitationen sendes fra ejerens mail-app.
- Support: pakken indeholder hele historikken i de kategorier, brugeren har
  valgt; adgangsperioden styrer, hvornår Support må åbne den.
- Invitér en ven: afsenderens belønning afhænger ikke længere af, at den nye
  konto findes efter 3 måneder (den kobling findes ikke).
- Videresend: krydsspærringen mellem to brugere er fjernet (den krævede at
  kende begge); månedsloftet for points gælder fortsat.

## Kendt restlækage (accepteret)

- Serveren ser tidspunkter og antal for boksposter og IP-adresser på
  transportniveau (TLS-terminering). Disse logges ikke til persistens.
- Betalingsudbyderen kender betalerens identitet (identitetsverdenen).
- Integrationer: serveren har Fitbit/Withings-tokens og ser hentede data
  kortvarigt i hukommelsen, før de forsegles. HealthKit-companion-appen
  sender data til serveren, som forsegler dem straks.
- Søgning og produktvisning afslører i selve forespørgslen, hvilke offentlige
  produkter der slås op (gemmes ikke pr. bruger).
- Anonym statistik: sessionen bruges ved indsendelse til at afvise anonyme
  kald og tælle én gang pr. dag (hash i hukommelsen, gemmes ikke).
- Rapporter om ændret næringsindhold og AI-produktkandidater er anonyme
  bidrag til den fælles produktdatabase.
