# HELLO CAL — decision log

This file records durable decisions. Add a dated entry when a later decision changes one of them.

## 2026-10-03: Familie — "Skift profil" under cirklen, "Tilføj familiemedlem" / "Tilføj barn (under 18)" og rettigheder "se" / "oprette på deres vegne"

Brugerens krav: "i stedet for administrator skal der stå med fed Skift profil i stedet for overskrift for oven man ikke ser. Men det skal hedde tilføj familiemedlem. Og 'tilføj barn (under 18)'. Og når man opretter skal man for alle have mulighed for at vælge … både læse og skriverettigheder", præciseret: "Rettigheder til at oprette på deres vegne og se deres profil". Profilvælgeren øverst på Profil beholdes.

- **Profilvælger:** ingen overskrift over cirklen. Under den står fed "Skift profil" med pil (ikke navnet), og under det "Din egen profil", "Du taster ind for {navn}" eller "Du kan se {navn}s profil".
- **Tilføj:** "Tilføj profil" er erstattet af "Tilføj familiemedlem" og "Tilføj barn (under 18)" i profilvælgeren og på familiesiden (`?add=member` / `?add=child`, `?add=1` = familiemedlem). Valget afgør `isChild`; toggle'en "Er det et barn?" er fjernet fra formularen.
- **To rettigheder pr. person pr. profil:** "Se profilen" og "Oprette på deres vegne (fx tilføje mad)". At oprette kræver, at man kan se, så kontakterne følges ad. Gemmes som `FamilyAccessGrant` (rækken = se) med `canWrite` (oprette); eksisterende tildelinger var "se og taste ind" og beholder begge (migration `20261003230000_family_grant_write`). Betaleren har altid begge dele.
- **Ved oprettelse** vælger betaleren for hvert andet familiemedlem begge veje: hvad personen må hos den nye profil, og hvad den nye profil må hos personen (`access` i `POST /api/family/members`). Alt starter slået fra. Bagefter ændres det under Familie → Adgang (`PUT /api/family/grants` med `level` = `none`/`read`/`write`).
- **Håndhævelse:** `canActFor(…, "write")` kræves for alle ændringer på en andens profil (`getProfileContext` med CREATED/UPDATED/DELETED, fælles måltid og "Kopier til konto"). Må man kun se, afvises ændringen (401) i stedet for at falde tilbage til ens egen profil. "Til:"-rækken og "Kopier til konto" viser kun profiler, man må oprette for. Kontrol-loggen viser "Må se" eller "Må se og oprette" ud for hver person.
- **Beslutning ved sammenfletning (2026-10-03, brugerens valg):** dette design erstatter "Skift profil som række med buet pil" fra PR #206; "Inviter familiemedlem" (PR #199) er uændret ved siden af.

## 2026-10-03: Flere sider kan lægges i bundmenuen

- Brugerens ønske: Favoritter, Viden om, Opskrifter, Status, Billeddagbog og Kropsmål kan vælges som ikoner i bundmenuen. De ligger i puljen (ikke i standardmenuen, som stadig er Tilføj/Madvarer/Kalender/Statistik).
- Ikoner som i Profil-listen, undtagen Billeddagbog, der får et billed-ikon (`IconPhoto`), så det ikke forveksles med Kamera.
- "Skift konto" er et bundmenu-ikon uden egen side: det åbner et ark med profilskift. Kun synligt med familieabonnement eller familiemedlemskab (`hasFamilyPlan || family`); uden det skjules det i puljen og flyttes ud af menuen.
- Favoritter havde ingen egen side; `/favorites` samler favoritmadvarer og favoritopskrifter (begge findes allerede via `/api/favorites` og `/api/recipe-favorites`).

## 2026-10-03: Betalingssiden — ens logo-chips, familieabonnement og Stripe-testkort

Brugerens krav: logoerne var "meget små i boksene og burde være den brunlige standardfarve"; ikonerne skal have samme størrelse i bokse af samme størrelse; "Og jeg har aktivt abonnement. Det er familieabonnement" (brugeren er administrator); "Kunne du ikke tilføje dummykort-betalingen fra Stripe integrationen".

- Logo-chips (købssiden, betalingsarket på forsiden og Indstillinger → Betalingsmetode) er `--hf-color-card` uden kant, alle 64 × 40 px, og hvert logo skaleres ind i samme 40 × 24-felt. MobilePay-chippen er bredere, fordi navnet står ved siden af. Logo-SVG'ernes viewBox er beskåret til selve mærket.
- Seriøs uden egen aftale (administratorer, der altid er Seriøs Familie) vises som aktivt abonnement på betalingssiden, og med familieplan står der "Aktivt familieabonnement".
- Administratorer uden et rigtigt kort får Stripes testkort (Visa •••• 4242, 12/34, "Stripe-testkort") som betalingsmetode (`testPaymentMethod` i `GET /api/subscription`). Det er kun til visning: det kan ikke skiftes eller opsiges.

## 2026-10-03: En stregkode skal ses i flere billeder, før den godkendes

Årsag: et par cowboybukser blev godkendt som stregkode i kameraflowet.

- Live-scanningen godkender først en kode, når den er afkodet **3 gange inden for 1,5 s** (`src/lib/barcode-confirm.ts`). Andre koder ind imellem nulstiller ikke tællingen. Decode-animationen og opslaget starter først derefter.
- En aflæsning tæller kun, hvis stregerne har en målelig højde (`measureBarExtent`). Et mønster, hvis striber fortsætter ud over 1,4 × stregkodens bredde, er ikke en stregkode.

## 2026-10-03: Admin "Log" — afbrudte vareoprettelser med billeder

Brugerens krav: "I admin skal der under log meldes og kunne sorteres på madoprettelser som bliver afbrudt, og man skal kunne se stregkoden / de billeder som er taget og droppet."

- **Afbrudt oprettelse** = et kameraflow, hvor stregkoden var ukendt (eller en genscanning), og som sluttede uden vare. Et flow, der afbrydes allerede på stregkoden, er ikke en oprettelse (vises stadig under "Alle").
- **Melding**: Scanninger viser et banner med antallet af afbrudte oprettelser de seneste 30 dage og et link til dem. **Filtre** (`?show=`): Alle · Afbrudte oprettelser · Nye varer · Kendte/dubletter · Med fejl, hver med antal. Kortet viser, hvilket trin brugeren forlod ("Afbrudt på Energi").
- **Fotos gemmes, så snart de er taget**: forside, energi og indhold lå før kun i telefonens hukommelse og forsvandt ved afbrydelse. Telefonen skalerer dem til 1280 px JPEG og sender dem til `POST /api/debug-log/photo` (kun mens loggen er slået til) → `public/product-images/scan-log/`, logget som `flow_photo`. Stregkode-fotoet var allerede gemt (`barcode_photo_saved`). Billederne vises som miniaturer på kortet og i tidslinjen og åbnes i fuld størrelse. De slettes sammen med logrækkerne efter 30 dage. Det betyder én ekstra upload pr. foto i kameraflowet, så længe test-loggen er slået til.
- **Lukket app**: React afmonterer intet, når appen/fanen lukkes, så `pagehide` melder nu `flow_abandoned` ("Appen lukket"). Et flow uden afslutning, der har stået stille i 15 minutter, vises også som afbrudt ("ingen melding fra telefonen"). Kommer siden tilbage og bliver færdig, vinder den senere afslutning.

## 2026-10-03: Forsidens puls-linje slår i den målte puls

Brugerens krav: "Pulsen skal svare til den rigtige puls som måles, hvis ur tilsluttet. Ellers svarende til 60bpm."

- Puls-linjen slår ét hjerteslag hvert 60/bpm sekund i stedet for ét slag pr. fej. Fejet tager stadig 3–4 s over skærmen, så der ses ca. 3–4 slag ved 60 bpm og dobbelt så mange ved 120. Næste fej starter straks og visker det forrige ud foran spidsen (som en pulsmåler); den tidligere pause mellem fejene er væk.
- Pulsen = nyeste `HEART_RATE_BPM` fra en integration med status `CONNECTED`, højst 30 minutter gammel (integrationerne synkroniserer hvert 15. minut) og mellem 30 og 220 bpm (`src/lib/live-heart-rate.ts`, `GET /api/health-metrics/heart-rate`). Ellers 60 bpm. Forsiden spørger én gang i minuttet, mens siden er synlig.
- Pulsen låses pr. fej, så slagene ikke hopper, hvis en ny måling kommer midt i et fej.
- Placering (bruger samme dag: "ovenover midten … så den ikke går om bag det tal i hjulet, som står i midten"): grundlinjen ligger 26 px over tal-hjulets midterste række, målt i siden (`data-stats-wheel` på hjulets boks). Det rækker til, at dykket efter R-takken og stregens glød går fri af det midterste tal. Ændrer placeringen fra 2026-10-03 ("omkring tal-hjulets midte").

## 2026-10-03: Familiekoder er bundet til en e-mail og vises som krypteret QR-kode

- **Ejerens krav:** koden skal være helt unik og kan kun bruges sammen med den
  e-mail, den er lavet til. Betaleren skriver personens e-mail, når koden
  laves (både "Inviter en med egen konto" og "Lav login-kode" til en profil
  uden login). Koden (8 tegn, `XXXX-XXXX`) er unik i databasen (`codeHash`
  `@unique`; ved sammenfald laves en ny).
- **Tilknytning (eksisterende konto):** koden + e-mailen skal passe sammen,
  og den indloggede kontos e-mail skal være præcis den e-mail. Forkert
  kombination giver samme fejl som ukendt kode, så man ikke kan gætte koder.
- **QR-kode:** betalerens familieside viser hver ventende kode med QR-kode,
  kode og udløb, indtil den er brugt, udløbet (7 dage) eller trukket tilbage.
  QR-koden er et link (`/family-code/join?t=…`, login-koder
  `/family-code?t=…`), hvor kode og e-mail er AES-256-GCM-krypteret med en
  nøgle afledt af `ADMIN_SESSION_SECRET` (`src/lib/family-invite-token.ts`).
  Hverken kode eller e-mail står i klartekst i linket, og et ændret link
  afvises. Scannes den med telefonens kamera, åbnes tilknytningssiden; er man
  ikke logget ind, sendes man til login og tilbage. Koden gemmes krypteret
  (`codeCipher`) ud over hashen, så betaleren kan se den igen.
- **En ny kode til samme e-mail erstatter den gamle.** Koder fra før denne
  ændring (uden e-mail) virker ikke længere — betaleren laver en ny.
- **Tilmeldingssiden** har sektionen "Familie": "Opret dig som medlem af en
  familiekonto. Indtast invitationskoden eller scan QR-koden." (ejerens tekst).
  QR-koden kan scannes både med telefonens kamera-app og i appen
  (`/family-code/scan`); kun links til `/family-code` og `/family-code/join`
  med token accepteres.
- **Tællere på betalerens familieside:** "x ud af y abonnenter tilmeldt"
  (profiler i familien / pladser) og "n/5 ekstra tilkøb". `Family.extraSeats`
  (højst 5) lægges oven i de 5 pladser. Selve købet af ekstra pladser er
  **ikke bygget** — pris og betaling skal afklares med ejeren.


## 2026-10-03: Adgangsarkets knapper ligger under listen, ikke ovenpå

Ændrer "faste knapper nederst" fra 2026-09-27: knapperne og "Vilkår og
betingelser"-bjælken står stadig fast i bunden af `HfAccessSheet`, men i deres
egen hvide bund under den scrollbare liste i stedet for ovenpå den med
gennemsigtig toning. Brugeren kunne ikke se, hvad der skete i bunden (rækkerne
skinnede igennem bjælken). Kun en 32 px toning over kanten viser, at listen
fortsætter.
## 2026-10-03: Profil → Status

- **Placering:** rækken "Status" står som nr. 3 i profilmenuen, lige under Points (brugerens ønske: "under Profil, Points"). Points bliver som nr. 2 (beslutning 2026-10-02).
- **Nuværende vægt** = seneste `WeightEntry`. Uden vejninger vises start-vægten (`User.weightKg`). **Mål** = `User.targetWeightKg`, som følger den nyeste vægt-målsætning (`user-goals.ts`). Felterne linker til vægtloggen og Målsætning; siden redigerer intet selv.
- **Historik:** én dropdown pr. punkt — Vægt og hvert kropsmål i `BODY_MEASUREMENT_FIELDS` — lukket som standard, med en forløbsgraf øverst (alle målinger, x efter tid) og listen nyeste først under den (10 ad gangen). Vægtgrafen viser målet som stiplet linje. Enheder følger brugerens valg (kg/lb/st, cm/in).
## 2026-10-03: Højden låses ligesom vægten + hele kropssammensætningen fra integrationer

Brugerens krav: "Denne [højden] skal også låses ligesom vægten. I integrationen skal ALT med. Fedtprocent, muskelmasse og alt."

- Højden (`User.heightCm`) kan kun vælges på Profil, mens den er tom. Derefter vises den med lås; et tryk åbner `/profile/height`, der henviser til integrationer. `PATCH /api/profile` afviser en ny højde med 403, når den er sat (`src/lib/height.ts`, 50–250 cm).
- Den låste højde følger den nyeste gyldige `HEIGHT_CM`, en integration har målt (alle kilder), hver gang en integration leverer højde (`store-items.ts`). Withings henter altid hele højdehistorikken, da højden typisk er indtastet for længe siden.
- Withings henter alt, vægten måler: vægt, højde, fedtprocent, fedtmasse, fedtfri masse, muskelmasse, kropsvand, knoglemasse, visceralt fedt, puls, iltmætning, temperatur og VO2 max. Nye `HealthMetricType`: `FAT_MASS_KG`, `FAT_FREE_MASS_KG`, `BONE_MASS_KG`, `VISCERAL_FAT_INDEX` (migration `20261003150000_full_body_composition`). Garmin henter også knoglemasse; Health Connect-modulet læser også knoglemasse og fedtfri masse (LeanBodyMass).
- Hver kropsmåling har sin egen til/fra-række på integrationssiden (`ReadType`: `bodyFat` = fedtprocent og fedtmasse, `muscleMass`, `fatFreeMass`, `bodyWater`, `boneMass`, `visceralFat`; `body` = højde, BMI og temperatur). Nye rækker er slået til, indtil brugeren slår dem fra — også hvor "Fedtprocent" før var slået fra og dækkede muskler/kropsvand.
- Hjul-arkene (`WheelPicker`, `BirthDatePicker`) portales til `<body>`: inde i et `<label>` sendte iOS tryk på "Færdig" videre til åbne-knappen, så arket ikke lukkede.
## 2026-10-03: "Tillad" giver altid synlig besked

Afløser "ellers er valget allerede gemt → luk" fra 2026-09-27: "Tillad" på en integrations adgangsark lukker aldrig arket uden at vise, hvad der skete. Forbundet cloud-app → hent data nu og vis resultatet; knappen hedder derefter "Færdig" og lukker først da. Tilkoblingsfejl sendes tilbage med årsag (`config`, `tier`, `denied`, `expired`, `failed`) og vises øverst i arket.

## 2026-10-03: ALT med fra integrationerne

Brugerens krav: "I Withings og øvrige integrationer skal ALT med. Fedtprocent, muskelmasse og alt!"

- **Alle tal, en app kan levere, hentes** — ikke kun vægt og fedtprocent. Nye `HealthMetricType`-værdier: fedtmasse, fedtfri masse, skeletmuskelmasse, knoglemasse, ekstra-/intracellulært vand, visceralt fedt, proteinandel, BMR (`BASAL_METABOLIC_RATE_KCAL`, vægtens enkeltmåling — adskilt fra dagssummen `RESTING_ENERGY_KCAL`), metabolisk alder, blodtryk (systolisk/diastolisk), pulsbølgehastighed, karalder, EKG-intervaller (QRS/PR/QT/QTc), fitnessalder, hudtemperatur, blodsukker, nervesundhed, hudledningsevne, restitution og strain.
- **Withings:** alle numeriske måletyper (vægt, højde, hele kropssammensætningen, blodtryk, puls, SpO2, temperatur, PWV, karalder, EKG, VO2 max, BMR, metabolisk alder …) + dagsaktivitet, søvn og træning (scope `user.activity`). Ikke med: AFib-klassifikationer og segmentmålinger pr. arm/ben (ikke ét tal).
- **Øvrige:** Garmin (knoglemasse, blodtryk, VO2 max/fitnessalder, HRV, SpO2, vejrtrækning), Huawei (hele vægtens sammensætning, blodtryk, SpO2, temperatur, blodsukker), WHOOP (strain, dagspuls, restitution, hudtemperatur), Polar (søvn, Nightly Recharge, dagsaktivitet, cardio load), Fitbit (dagsserier, hvilepuls, HRV, SpO2, vejrtrækning, VO2 max, søvn, BMI), Google Health (højde, hvilepuls, HRV, SpO2, vejrtrækning, temperatur, VO2 max) og Health Connect (knoglemasse, fedtfri masse, BMR, blodtryk, temperatur, blodsukker). Strava har kun træning.
- **Hver delforespørgsel er tolerant:** mangler en tilladelse eller en enhed, fejler kun den del; resten gemmes.
- **"Forbind igen" også for læsning:** adaptere kan angive `readScopes`; mangler et scope, brugeren gav ved tilkobling, vises "Forbind igen" (samme besked som for skriveadgang). En ny tilkobling nulstiller `lastSyncedAt`, så hele historikken hentes.
- **Grupper under "Hent fra":** al kropssammensætning hører under `bodyFat` ("Fedtprocent, muskelmasse og hele kropssammensætningen"); blodtryk, karstivhed, EKG, fitnessalder og restitution under `heart`; temperatur, blodsukker m.m. under `body`.
- **Apple Health `leanBodyMass` = fedtfri masse** (`FAT_FREE_MASS_KG`), ikke muskelmasse — retter docs/HEALTHKIT_COMPANION.md fra 2026-09-29. Ingen iOS-app findes endnu, så intet data er gemt forkert.
- **Statistik:** nye kortgrupper "Krop og kropssammensætning" og "Hjerte, blodtryk og målinger". Kropssammensætning, blodtryk o.l. viser seneste måling i perioden (ikke gennemsnit). `/api/health-metrics` returnerer nu alle målinger fra de seneste 120 dage (højst 10.000) + den nyeste ældre måling pr. type.
## 2026-10-03: Synkroniserede vejninger er låst, sletning kræver bekræftelse, og smartvægte sender ALT

- **Låst:** en vejning med `source` ≠ `MANUAL` (fra Withings, Garmin, Apple Health …) kan ikke slettes eller rettes i Hello Cal. API'et (`PATCH`/`DELETE /api/weight-entries/[id]`) svarer 403, og "Vægt over dagen" på kalibreringssiden bruger kun indtastede vejninger.
- **"Synkroniseret" i stedet for "Slet":** på "Seneste vejninger" står "Synkroniseret" ved en synkroniseret vejning. Tryk åbner et bundark (`src/components/hf/EntryDetailsSheet.tsx`) med kilde (logo + "Synkroniseret fra Withings") og alle målinger fra samme vejning (`GET /api/weight-entries/[id]`, målinger fra samme kilde inden for ±2 min; rækkefølge og enheder i `src/lib/body-metrics.ts`).
- **Samme vindue som slette-advarsel:** "Slet" ved en indtastet vejning og sletning af indtag (swipe i "Dagens tilføjelser", gemte varer på stemme- og chat-siden) åbner samme bundark med advarsel og en rød Slet-knap. Intet slettes ved ét tryk. Ikke-gemte forslag fjernes stadig direkte.
- **ALT fra integrationen:** Withings henter alle måletyper (vægt, fedtprocent, fedtmasse, fedtfri masse, muskelmasse, knoglemasse, kropsvæske kg+%, ekstra-/intracellulær væske, visceralt fedt, basalstofskifte, metabolisk alder, blodtryk, puls, pulsbølgehastighed, karalder, nervesundhed, hudledningsevne, iltmætning, temperatur, hudtemperatur, VO2 max, højde). Segmentmålinger pr. kropsdel (Body Comp, typer 173–175) gemmes ikke, da `HealthMetric` ikke har en kropsdel. Garmin sender også knoglemasse; Huawei fedtmasse, knoglemasse, kropsvæske, visceralt fedt, basalstofskifte og kropsalder; Fitbit BMI. 16 nye `HealthMetricType`-værdier (migration `20261003180000_all_scale_metrics`).
- **Historik hentes igen:** `Integration.fetchVersion` + `OAuthProviderAdapter.fetchVersion`. Har adapteren en højere version end integrationen, hentes hele `initialDays`-perioden igen én gang (Withings 365 dage, Huawei/Fitbit 30), så gamle vejninger også får de nye målinger. Dubletter springes over som før.
- **Valg pr. integration:** Withings har nu også "Puls, blodtryk og kondition" og "Højde, BMI og temperatur"; "Fedtprocent" hedder nu "Kropssammensætning" og dækker alle kropssammensætningstyperne.

## 2026-10-02: Hjælpe-chatbot øverst i app og web + admin "Chatbot"

- **Placering:** en hjælpe-knap (chatbot-ikon) står øverst på alle app-sider lige til venstre for profilcirklen (`ScreenHeader` og forsidens `TopBar`). På desktop står "Hjælp" i topbjælken ved siden af profilindstillinger. Knappen åbner ét fuldt bundark (`src/components/help/HelpChat.tsx`, monteret én gang i layoutet). Den eksisterende måltids-chat (`/chat`) er uændret og noget andet.
- **Kontaktveje i toppen af arket:** "Tal med en medarbejder" og "Kontaktformular" (`/settings/support/contact`). **Ingen telefonsupport** (ejerens valg 2026-10-03), så der er ingen "Ring til os"-knap, og chatbotten ved, at der ikke findes en telefon.
- **"Tal med en medarbejder"** opretter en almindelig sag i Support-indbakken (samme flow, kvitteringsmail og 24-timers-frist som "Kontakt os") med hele chat-tråden som første besked, så brugeren ikke skal forklare sig igen. Kategorien oversættes til Supports kategori. Virker også uden forudgående spørgsmål (så er brugerens tekst beskeden). Efter videresendelse er samtalen lukket; næste spørgsmål starter en ny.
- **AI:** OpenAI Responses API med `store: false` og kun beskedtekster (ingen ID'er, navn eller e-mail), som de øvrige AI-kald. Model `OPENAI_CHATBOT_MODEL`, standard `gpt-4o-mini`. Chatbotten svarer kun ud fra `src/lib/chatbot-knowledge.ts` (bygget på Hjælpecentret) og må aldrig gætte; ved tvivl, penge tilbage, kontosletning, kontoadgang og utilfredshed foreslår den en medarbejder. Links i svar vælges kun fra en fast liste (enum i svar-skemaet). Fejler AI-kaldet, får brugeren et fast svar med tilbud om en medarbejder.
- **Data:** `chatbot_conversations` + `chatbot_messages` (migration `20261002120000_chatbot`). Hvert brugerspørgsmål får én kategori (13 faste, `src/lib/chatbot-categories.ts`); samtalens kategori er den hyppigste. Samtalen gemmer et **øjebliksbillede** af brugeren ved start (alder, køn, region, Gratis/Seriøs + plan, app-sprog) — samme snapshot-princip som registreringer. Slettes med brugeren (cascade). En samtale fortsætter, til den har været stille i 12 timer. Højst 30 spørgsmål pr. bruger pr. time.
- **Admin → Brugere → Chatbot** (`/admin/chatbot`): periode (7/30/90 dage/altid), nøgletal, "Oftest spurgt" pr. kategori (klik filtrerer), tabel med alle spørgsmål og svar (søgning, kategori, kun videresendte) og visningen "Hele tråde" med alle spørgsmål og svar inline. `/admin/chatbot/[id]` viser hele tråden, brugeren nu (alder, køn, region, abonnement + status, sprog, bruger siden, antal samtaler/sager), øjebliksbilledet og link til supportsagen.
- **Region** er landet fra profilen (`User.region`, fx Danmark) — ejerens valg 2026-10-03. Ingen danske regioner/postnumre.
- **Kun indloggede** kan bruge chatbotten (ejerens valg 2026-10-03). Udloggede, der åbner den, får en henvisning til Hjælpecentret.

## 2026-10-02: Før/efter-sammenligning i billede-dagbogen

- Valg sker med en hvid afkrydsningsboks på billedkortet; første afkrydsning åbner straks overlayet med billede 1 som "Før" og en tom "Efter"-plads. Rækkefølgen er brugerens valg (ikke dato), og kan byttes om.
- Sammenligningen er kun visning: intet nyt billede gemmes, og intet forlader telefonen. Billedfeltet får før-billedets format; efter-billedet beskæres til samme felt (object-cover), så linjen deler samme udsnit.
- Overlayet følger den eksisterende fuldskærmsvisning (mørk flade) og lukker, når siden låses (adgangskode-låsen).
## 2026-10-03: Adgangsarkets knapper ligger under listen, ikke ovenpå

Ændrer "faste knapper nederst" fra 2026-09-27: knapperne og "Vilkår og
betingelser"-bjælken står stadig fast i bunden af `HfAccessSheet`, men i deres
egen hvide bund under den scrollbare liste i stedet for ovenpå den med
gennemsigtig toning. Brugeren kunne ikke se, hvad der skete i bunden (rækkerne
skinnede igennem bjælken). Kun en 32 px toning over kanten viser, at listen
fortsætter.
## 2026-10-03: Tilføj-menuen — Aktivitet og Menstruation som ikon-felter

Ejerens krav: "Tilføj aktivitetsikon og menstruationscirkel (sidste kun for kvinder!). Så må man bare scrolle."

- Aktivitet er nu et 3D-felt (`/icons/activity-3d.png`) i gitteret i stedet for en række under kortet.
- Nyt felt Menstruation (`/icons/add/period.svg`, cyklusring med blodsdråbe) åbner `/period/create`. Vises kun, når `visibleAddActions()` tillader det (køn = kvinde **og** "Vis menstruationscyklus" slået til, jf. 2026-09-19). Erstatter tidligere note om, at menstruation kun findes i kalenderen.
- Gitteret er 2 kolonner på mobil (5 på brede skærme); bundarket scroller, når felterne ikke kan være der.

## 2026-10-02: Flere integrationer — Garmin, WHOOP, Huawei + mærker via telefonen

Brugerens krav: Garmin, Health Connect, eufy, Renpho, Tuya, Xiaomi, Huawei, WHOOP og Samsung (også ure/ringe, ikke kun vægte). "Vi må ikke videregive nogen informationer om brugeren."

- **Cloud (OAuth):** Garmin (Health + Activity API, OAuth 2.0 med PKCE), WHOOP (API v2) og Huawei Health (Health Kit REST). Samme fælles adapter-mønster som Withings/Polar (`src/lib/integrations/registry.ts`).
- **Kun læsning for alle nye.** Hello Cal sender ingen data om brugeren til Garmin, WHOOP eller Huawei (`write: []` i `sync-settings.ts`). Der bedes ikke om profil-scopes (navn/e-mail). Ved frakobling får appen besked om at stoppe adgangen (`revoke`: Garmin afregistrering, WHOOP `DELETE /user/access`, Huawei token-revoke).
- **Garmin bruger ping-notifikationer** (`POST /api/integrations/garmin/webhook`). Kun Ping/Pull: Hello Cal henter selv data hos `apis.garmin.com` med brugerens token; data i selve notifikationen (Push) bruges ikke, da Garmin ikke signerer dem. Garmins pseudonyme bruger-ID gemmes i `Integration.externalUserId` for at koble ping til bruger. Valgfri `GARMIN_WEBHOOK_KEY` i adressen.
- **Mærker uden åben API = kind "via":** Samsung Health (inkl. Galaxy Watch/Ring/Fit), eufy, Renpho, Xiaomi (Mi Fitness/Zepp Life) og Tuya/Smart Life. Deres app deler til Health Connect/Apple Health, og data kommer ind gennem Hello Cal-appen. Kortet viser vejledning + knap til Health Connect/Apple Health og bliver "Forbundet", når ingest ser data med deres afsender-app (`origin`, `src/lib/integrations/origins.ts`). Ingen forbindelse til mærket selv.
- **Tuya:** direkte forbindelse kræver partneraftale (Tuya IoT-projekt + godkendt app-konto-kobling); vises som "via" med note om det.
- Health Connect-delen af Hello Cal-appen er skrevet som Android-modul `native/android/healthconnect/` (ikke kompileret endnu).
- Nye mærker har intet logo endnu (`icon: null` → forbogstav); brugeren lægger logoer i `public/integrations/`.
## 2026-10-02: Aktivitetskatalog og tid på Tilføj → Aktivitet

- Brugerens ønske: alle aktiviteter, der kan få pulsen op, skal kunne vælges med søgefelt. Kataloget (`ACTIVITY_CATALOG` i `src/lib/activity-met.ts`) er nu den ene kilde til navn, søgeord og MET pr. intensitet (ca. 75 aktiviteter: løb, cykel, vand, bold/ketsjer, holdtræning, dans, kampsport, is/sne, hverdag som havearbejde og snerydning). `SPORT_TYPES` i `sport-icons.ts` bygges af kataloget og tilføjer kun ikoner.
- De ti gamle nøgler (running … other) beholdes uændret; nøgler må aldrig omdøbes, da de står på gamle registreringer. Integrationernes aliaser er uændrede, men en rå type, der præcis er en katalognøgle (fx Strava "Rowing", "Golf"), lander nu på den nøgle i stedet for "cardio"/ukendt.
- Søgningen matcher navnet først og derefter søgeord (fx "judo" → Kampsport, "spinning" → Spinning). Listen er alfabetisk med "Anden aktivitet" sidst.
- Varighed indtastes som timer + minutter med et sluttidspunkt, der følger med begge veje; slut før start betyder over midnat (`src/lib/activity-duration.ts`). API'et får stadig `durationMinutes`.
## 2026-10-03: Hjælpe-chatten kun under Support, kontakt kun nederst

Ændrer placeringen fra 2026-10-02 (ejerens ønske: "skjul det mere").

- Ingen hjælpe-knap i toppen længere — hverken i appbaren (`ScreenHeader`), forsidens `TopBar` eller desktop-skallens topbjælke. Chatten åbnes kun fra knappen "Spørg hjælpe-chatten" på Support-siden (`/settings/support`). `.hf-appbar--help` og `HelpChatButton` er fjernet.
- I chat-arket står "Tal med en medarbejder" og "Kontaktformular" ikke længere som fliser i toppen, men som diskrete tekstlinks nederst i samtalen. Chatbottens eget tilbud om en medarbejder (ved tvivl) er uændret.
- På Support-siden er "Kontakt os" et tekstlink helt nederst (under "Mine henvendelser") i stedet for en primær knap.

## 2026-10-02: Hjælpe-chatbot øverst i app og web + admin "Chatbot"

- **Placering:** en hjælpe-knap (chatbot-ikon) står øverst på alle app-sider lige til venstre for profilcirklen (`ScreenHeader` og forsidens `TopBar`). På desktop står "Hjælp" i topbjælken ved siden af profilindstillinger. Knappen åbner ét fuldt bundark (`src/components/help/HelpChat.tsx`, monteret én gang i layoutet). Den eksisterende måltids-chat (`/chat`) er uændret og noget andet.
- **Kontaktveje i toppen af arket:** "Tal med en medarbejder" og "Kontaktformular" (`/settings/support/contact`). **Ingen telefonsupport** (ejerens valg 2026-10-03), så der er ingen "Ring til os"-knap, og chatbotten ved, at der ikke findes en telefon.
- **"Tal med en medarbejder"** opretter en almindelig sag i Support-indbakken (samme flow, kvitteringsmail og 24-timers-frist som "Kontakt os") med hele chat-tråden som første besked, så brugeren ikke skal forklare sig igen. Kategorien oversættes til Supports kategori. Virker også uden forudgående spørgsmål (så er brugerens tekst beskeden). Efter videresendelse er samtalen lukket; næste spørgsmål starter en ny.
- **AI:** OpenAI Responses API med `store: false` og kun beskedtekster (ingen ID'er, navn eller e-mail), som de øvrige AI-kald. Model `OPENAI_CHATBOT_MODEL`, standard `gpt-4o-mini`. Chatbotten svarer kun ud fra `src/lib/chatbot-knowledge.ts` (bygget på Hjælpecentret) og må aldrig gætte; ved tvivl, penge tilbage, kontosletning, kontoadgang og utilfredshed foreslår den en medarbejder. Links i svar vælges kun fra en fast liste (enum i svar-skemaet). Fejler AI-kaldet, får brugeren et fast svar med tilbud om en medarbejder.
- **Data:** `chatbot_conversations` + `chatbot_messages` (migration `20261002120000_chatbot`). Hvert brugerspørgsmål får én kategori (13 faste, `src/lib/chatbot-categories.ts`); samtalens kategori er den hyppigste. Samtalen gemmer et **øjebliksbillede** af brugeren ved start (alder, køn, region, Gratis/Seriøs + plan, app-sprog) — samme snapshot-princip som registreringer. Slettes med brugeren (cascade). En samtale fortsætter, til den har været stille i 12 timer. Højst 30 spørgsmål pr. bruger pr. time.
- **Admin → Brugere → Chatbot** (`/admin/chatbot`): periode (7/30/90 dage/altid), nøgletal, "Oftest spurgt" pr. kategori (klik filtrerer), tabel med alle spørgsmål og svar (søgning, kategori, kun videresendte) og visningen "Hele tråde" med alle spørgsmål og svar inline. `/admin/chatbot/[id]` viser hele tråden, brugeren nu (alder, køn, region, abonnement + status, sprog, bruger siden, antal samtaler/sager), øjebliksbilledet og link til supportsagen.
- **Region** er landet fra profilen (`User.region`, fx Danmark) — ejerens valg 2026-10-03. Ingen danske regioner/postnumre.
- **Kun indloggede** kan bruge chatbotten (ejerens valg 2026-10-03). Udloggede, der åbner den, får en henvisning til Hjælpecentret.
## 2026-10-02: Kamera — lygte, fokus på ~20 cm og lys/fokus-advarsel

- Kameraflowet (`ProductCaptureFlow`) viser en lygte-knap øverst til højre, når kamerasporet understøtter `torch` (typisk Chrome på Android; Safari på iPhone giver ofte ikke web-apps adgang). Feature-detekteret i `src/lib/camera-controls.ts`.
- Fokus: altid kontinuerlig autofokus. På stregkodetrinnet, hvis billedet bliver ved at være uskarpt og kameraet tillader manuel `focusDistance`, skiftes der hvert 2,5 s mellem fast fokus på 0,2 m og autofokus, til koden læses. Fast fokus hele tiden er fravalgt: holdes telefonen 30 cm væk, ville koden aldrig blive skarp. Produktfotos bruger autofokus (dækker 20–30 cm).
- Lys/fokus-advarsel (`src/lib/frame-quality.ts`): gennemsnitslys under 60/255 = "for mørkt" (med henvisning til lygten, når den findes); Laplace-varians under 40 i et billede med kontrast = "ude af fokus". Vises som hvid tekst nederst på kameraet efter 1,5 s, og logges i admin-loggen.
- Dybdesensor/LiDAR kan ikke bruges fra en web-app; det kræver en native app.
## 2026-10-02: "Se dine indscanninger"

- En indscanning er en vare, brugeren selv har oprettet med en stregkode (`Product.createdByUserId` + mindst én `Barcode`) — altså fotograferet i kameraflowet. Kendte stregkoder, der blot slås op, gemmes ikke og er ikke indscanninger.
- Forsiden viser linket "Se dine indscanninger" (almindelig tekst, understreget) nederst under "Dagens tilføjelser"; er listen tom, står det lige under "Ingen registreringer i dag". Det vises, så længe brugeren har indscanninger i historikken (ændret 2026-10-03, brugerkrav — før kun ved ikke-tilføjede indscanninger fra i dag, hvilket fik linket til at forsvinde).
- Siden `/my-scans` viser de seneste 90 dages indscanninger (højst 200), grupperet under en overskrift med skillelinje pr. dato taget, som almindelige søgerækker (favorit + Tilføj i bundarket). API: `GET /api/my-scans` (`src/lib/user-scans.ts`).
## 2026-10-02: Sprogflag på tale- og chat-siden (ændrer 2026-09-12 for tale)

Brugerens krav: flag/sprogvalg i venstre hjørne på tale-siden (mobil) og chat-siden (web); tale og tekst tolkes KUN på det valgte sprog, med engelsk som fallback, fordi mange varer hedder noget på engelsk.

- Sprogene ligger ét sted (`src/lib/meal-input-language.ts`): dansk, svensk, norsk, tysk, hollandsk, fransk, italiensk, spansk og engelsk. Standard er regionens sprog som før; brugerens flagvalg vinder og huskes på enheden (localStorage, delt mellem de to sider).
- Talegenkendelsen får kun det valgte sprog (Web Speech API tager ét sprog; regionens variant bruges, når sproget er regionens eget, fx de-AT). Den engelske fallback sker derfor i AI-tolkningen: `/api/ai/interpret-meal` får `language` og må kun læse teksten som det sprog eller engelsk. Varenavne skrives på det valgte sprog, engelske varenavne beholdes.
- Flaget sidder i headerens venstre slot (ny `leading`-plads i `ScreenHeader`/`HfScreen`), til højre for tilbagepilen, når den vises. Valget åbner et bundark.
- Et sprogskift mens mikrofonen lytter starter en ny session på det nye sprog. Hændelser fra en afbrudt session ignoreres, så skiftet ikke viser "Talegenkendelsen blev afbrudt".
## 2026-10-02: "Scan varen igen" — 10 points for Open Food Facts-varer og varer uden PNG

- Brugerens krav: når en scannet vare genkendes fra Open Food Facts (eller mangler et ordentligt PNG), glider et banner ned under headeren. Det ligger oven på siden (indholdet rykker ikke), viser "Optjen 10 points" + kamera-ikon og en trækstreg. Træk ned / tryk på stregen åbner det med teksten "Optjen 10 points ved at scanne varen på ny, for at sikre kvaliteten." øverst og samme kamera som ved produktoprettelse med felterne nedenunder. Swipe op gør det til et lille hvidt felt med stregen midt for, så del-ikonet kan nås.
- Hvornår (`src/lib/product-rescan-offer.ts`): på `/add/[id]` — både efter scanning og fra søgningen (brugerens valg 2026-10-02) — når brugeren er logget ind, og varen ikke allerede er scannet igen af nogen ("kun første gang"). Ikke i Tilføj-bundarket. Open Food Facts og USDA (brugerens valg) → forside, energi og indhold. Egne online-varer (REMA 1000/Bilka) uden fritlagt PNG (`.png` eller tag "Cutout") → kun forsiden. Brugeroprettede varer får intet banner.
- Indsendelse: `POST /api/products/[id]/rescan` (atomisk første gang via `Product.rescannedAt`). Open Food Facts-varer læses som "opret straks" (`enrichFront` + `enrichLabel`), men **registreringernes snapshots røres ikke** — varen er ikke ny. Egne varer: kun forsiden analyseres (vareboks + logo til fritlægning); navn, brand og næring fra produktarket bevares. Nyt billede går som altid via `pendingImageUrl` + admin-godkendelse.
- **Overtagelse (brugerens valg 2026-10-02, ændrer 2026-09-28 "Open Food Facts ude af søgningen" for genscannede varer):** når næringen er læst fra brugerens egne fotos, bliver en Open Food Facts-/USDA-vare vores egen: `externalSource`/`externalId`/`sourceCheckedAt` ryddes (intet fremtidigt opslag eller sync kan matche den), og varen bliver dermed søgbar. Originalen vises aldrig igen: billedet erstattes af brugerens forsidefoto, Open Food Facts-billedets ventende fritlægning kasseres, og felter der kun kom fra kilden fjernes (allergener, E-numre, udvidet næring, portion samt mættet fedt/ingredienser, hvis de ikke blev læst igen). Pakningsstørrelse og drikkevare-kategori bevares. Kan næringen ikke læses, forbliver varen ekstern, og banneret tilbydes igen.
- Billedrobotten skriver kun et fritlagt billede, når varen ikke har et ventende. Et bedre forsidebillede (genscanning eller natlig aflæsning) fjerner derfor det ikke-godkendte forslag og de ventende job på det gamle billede (`discardPendingFrontImage`).
- Points: 10 (`PointsReason.PRODUCT_RESCAN`) gives automatisk, når fotos er læst, medmindre AI'en slet ingen vare kunne se på forsidefotoet. Fejler AI'en teknisk, gives points alligevel. Bekræftet af brugeren 2026-10-02 (frem for admin-godkendelse). Samme bruger får kun points én gang pr. vare.
- Del B: første visning gemmer `Product.rescanOfferedAt`. Scanner ingen varen igen, sender det natlige app-job `external-image-ai` (standard 03:30, admin "Cron-jobs") Open Food Facts-/USDA-billedet gennem samme OpenAI-forsideaflæsning (`analyzeFrontPhoto`): brand/subbrand/variant/pakningsstørrelse udfyldes kun, hvis de mangler, og der lægges fritlægning (beskåret til vareboksen) + logo-kandidat i kø. Højst 100 varer pr. nat; `externalImageAnalyzedAt` markerer dem som klaret.
- Migration `20261003050000_product_rescan`.
## 2026-10-02: Tynde Open Food Facts-varer udløser fotoene + mærkninger fra forsiden

- Stregkodeopslaget gemmer ikke længere en OFF-vare, der mangler billede, ingrediensliste eller salt. Svaret er 404 (`source: "incomplete"`), så kameraflowet fortsætter til forside/energi/indhold, og AI'en udfylder varen fra fotoene. Baggrund: "Fire Forskellige Flødeboller" (Premieur) blev oprettet fra OFF med kun navn, brand og kalorier — uden billede, certifikat, ingredienser og salt — og kameraflowet sprang fotoene over.
- En tynd OFF-vare, der allerede ligger i databasen (`externalSource = OPEN_FOOD_FACTS`, PENDING, ingen `createdByUserId`, mangler billede eller ingredienser), behandles som ukendt ved næste scanning, og `/api/products/quick` fylder samme vare op i stedet for at oprette en dublet. Kun registreringer fra opfyldningen og frem får nye snapshots; ældre beholder deres.
- Forside-AI'en (prompt `front-v4-2026-10-02-certifications`) returnerer nu `certifications` (Ø-mærket, EU-blad, Nøglehul, Fuldkorn, Bedre Dyrevelfærd, MSC, ASC, Fairtrade …). De gemmes i `ProductFilters` via `src/lib/label-certifications.ts` + `product-certification-filters.ts`, og OFF's `labels_tags` gør det samme. Eksisterende felter overskrives aldrig.
- "EU-økologisk" giver EU-bladet (ikke Ø-mærket) i `certification-badges.ts`.

## 2026-10-02: Butiksimporten: alt fra arkene med (Bilka + REMA 1000)

Erstatter "Varer uden kcal/protein/kulhydrat/fedt springes over" fra 2026-09-27.

- **Alle rækker importeres** (brugerens valg: "Det er lige meget om de har protein mv. med. Så tager vi det fra Frida senere"). 13.039 varer i stedet for 10.524.
- **Uden kalorietal** (2.364 varer: mest vin/øl/spiritus, krydderier, kaffe/te, frisk frugt/grønt og kød): `Product.nutritionMissing = true`, kcal/protein/kulhydrat/fedt = 0 som pladsholder. Varen er skjult i alle opslag, hvor en bruger kan finde og logge den (søgning, tekst-/foto-/måltidsgenkendelse, næringsmatch, generiske kandidater), og får **ingen stregkode-række** — scanning ender derfor stadig i Open Food Facts eller kameraflowet, hvor brugeren kan oprette varen med rigtig næring. Opretter en bruger den, opdateres brugerens vare ved næste import, og den skjulte kopi slettes. Varesiden viser "Næringsindhold ukendt" og admin "Mangler – skjult i appen". Næring hentes senere fra Frida (egen opgave): udfyld, sæt `nutritionMissing = false`, opret stregkoden.
- **Med kalorietal men uden protein/kulhydrat/fedt** (151, mest spiritus og øl, hvor kun energien er deklareret): synlige; den manglende makro er 0 og markeret `ESTIMATED` i `nutrientSources` (~). En eksisterende vare beholder sine egne makroer.
- **Energi repareres**: Bilka-arkets kJ er tal, så 1105 kJ stod som 1,105 (ca. 4.900 varer). Desuden byttede kolonner, kJ = 0 ved siden af kcal, og 25 kcal-værdier, hvor arkets egen kJ og makroerne (4P + 4C + 9F + 2 fiber) er enige mod kcal (fx Marineret flanksteak 15 → 152, Chiliolie 37 → 392); aldrig på alkohol. Alle rettelser står i tjeklisten. kJ på admin-gennemgåede varer repareres også (en tusind-fejl er intet valg).
- **"Sukkerfri" kun op til 0,5 g sukker pr. 100 g** (EU's grænse; brugerens valg). REMA's "Sukkerfri" på 44 varer med mere sukker var REMA's mærke "Ikke tilsat sukker" → filteret "Uden tilsat sukker" (sukkerpåstandene fra samme dag). Det samme gælder "sukkerfri"/"uden sukker" i titlen på en vare med over 0,5 g sukker. Butikkens eget Sukkerfri-mærke i Bilka-arket (`_is_sugar_free`) står ved magt.
- **Info-arkenes "Labels"** udfylder filtre, arkene lod stå tomme (fuldkorn, vegetarisk, certificeringer, dyrevelfærd, oprindelsesland), og REMA's "Additional Product Information" giver oprindelsesland.
- **Vitaminer/mineraler**: findes ikke i arkene (kolonnerne var tomme) — bilka.py åbnede aldrig panelet "Info om vitaminer og mineraler". Nyt tillægs-script `bilka_vitamins.py` (brugeren kører det selv) skriver `bilka_vitamins.xlsx`; importen gemmer værdierne i `micronutrientsPer100g` med kilde LABEL, så de afløser Frida-skønnene (~) på varesiden.
- **Navne**: varer opkaldt efter brandet alene hed "0"/"1"/"M appelsin" (titlen minus brand og mængde); nu butikkens egen titel ("Coca cola", "Breezer m. appelsin"), og første bogstav er stort.
- Admin-gennemgang i Dubletter nulstilles ikke af kJ-rettelsen eller de afledte sukkerpåstande.
## 2026-10-02: Kalenderens miniature-tal — kyllingelår, flamme og vand i cl

- **Rettet igen 2026-10-03 (brugeren):** kyllingelåret er fjernet fra
  kalenderens dagvisning. Indtagne kalorier står som ren tekst "540 kcal"
  med enheden bagerst. Flamme og glas bliver.
- **Rettet 2026-10-03 (brugeren):** ikonet er et supplement til "kcal",
  aldrig en erstatning, og kyllingelåret bruges kun, hvor der i forvejen stod
  et ikon. "Overalt"-udrulningen fra 2026-10-02 er rullet tilbage: måneds-/
  ugelisten, statistikboksenes værdier, widget-forhåndsvisningerne og
  listerne i chat/tale/kamera viser igen tal + "kcal" uden ikon. Forsidens
  tal-hjul (Kalorier, Kalorier i plus: kyllingelår; Forbrændt: flamme) og
  statistikboksen Kalorier (kyllingelår) beholder ikonskiftet og viser igen
  "kcal".
- Kalenderens dagvisning (timerækken og timens oversigt) viser indtagne
  kalorier som "540 kcal" (uden ikon, se rettelsen ovenfor), forbrændte som flamme +
  "+120 kcal", og vand som det eksisterende glas-ikon + mængde i cl. Fælles
  komponent `EnergyChip` (design.md §6.16).
- Vand vises aldrig som "0 kcal". To kilder tælles sammen pr. time:
  `WaterEntry` fra /water/create (ml), som kalenderen nu også henter, og
  almindelige registreringer af en vare, der er vand: 0 kcal og enten et
  vand-navn ("Vand", "Flaskevand", "Kildevand", "Danskvand", "Water" …)
  eller en drikkevare (`classification.isDrink`); mængden er `amountGrams`
  som ml (1 g ≈ 1 ml). Logik i `src/lib/water-display.ts`.
- `/api/water-entries` returnerer nu de seneste 2.000 poster (før 200), så
  kalenderens historik dækker mere end få uger.
- Nyt farvetoken `--hf-meat` (#8C5A32) kun til kyllingelårets kød.

## 2026-10-02: Kameraflowet tager rigtige stillbilleder + "tag nyt billede af indholdet"

- Årsag: en marmelades ingrediensliste (30. sept.) blev aldrig aflæst. Loggen viste, at OpenAI fik fotoet, men svarede "for sløret til sikker aflæsning" (tom liste, sikkerhed 12 %). Fotoet var et 1080p-videobillede; appen sagde intet og prøvede ikke igen. Der var ingen genstart — PR #151 (genoptagelse efter genstart) byggede på et forkert gæt og er droppet.
- Forside, energi og indhold tages nu som kameraets stillbillede (`ImageCapture.takePhoto`, `src/lib/camera-still.ts`) — stadig automatisk, uden tryk. Har browseren ikke funktionen, bedes videostrømmen om 4K, og det skarpeste af tre videobilleder bruges. Stregkodefotoet er stadig ét videobillede (må ikke forsinke scanningen).
- Energi- og indholdsfotoet beskæres til det kvadrat, brugeren så i søgeren (ændrer "ingen beskæring" fra 2026-09-17 for de to trin; forsiden er stadig hele fotoet). Længste side højst 2048 px.
- Hvert foto logges (`photo_captured`: stillbillede/videobillede, opløsning, skarphed).
- Kunne AI ikke læse ingredienslisten, viser varesiden "Indholdet kunne ikke læses på billedet" med knappen "Tag nyt billede af indholdet" — kun for den, der oprettede varen (`ingredientsUnreadable` i `GET /api/products/[id]`). Knappen åbner `/camera?retake=ingredients&product=<id>` (`IngredientsRetakeFlow`), og `POST /api/products/[id]/ingredients-photo` læser det nye foto med OpenAI. Intet automatisk genforsøg på det samme foto (brugerens valg).

## 2026-10-02: "Til info sendte vi dig …" (mail/sms var ikke spam)

- Hver mail eller sms til en kendt bruger giver (1) en push med det samme: "Vi har netop sendt dig en e-mail om "emne". Dette var ikke spam." og (2) et bundark som det første ved næste besøg (app og web): "Til info sendte vi dig den <dato> en <e-mail/sms> om "<emne>". Dette var ikke spam." med sort knap "Læst".
- "Læst" kvitterer (`OutboundMessage.noticeAckAt`); et træk ned lukker kun til næste besøg. Beskeder ældre end 30 dage vises ikke. Gælder ikke mails til admin, ikke-brugere (invitationer) eller rene push-beskeder.
- Bygger på den eksisterende `OutboundMessage`-log — ingen adresse eller telefonnummer gemmes. Sms sendes via `src/lib/sms.ts` (GatewayAPI-format, no-op uden `SMS_GATEWAY_TOKEN`); brugere har endnu intet telefonnummer-felt, så ingen sms sendes i dag.
## 2026-10-02: B2B-brugere — kun admin kan oprette dem

Brugerens krav: "Kun admin kan oprette B2B-brugere." En B2B-bruger er en
person hos en partner (virksomhed under Admin → Partnere), der logger ind på
Hello Cals partnerportal og ser sin egen partners data.

- **Ingen offentlig tilmelding.** Den eneste vej til en B2B-konto er en
  invitation udstedt i Admin → Partnere → **B2B-brugere**
  (`/admin/partners/users`) af en administrator med **fuld** adgang
  (`requireFullAdminUser`; middleware afviser desuden skrivninger fra
  læseadgang). `/partner/login` har ingen "Opret konto", og `/business`
  skriver eksplicit, at adgangen oprettes af Hello Cal.
- **Datamodel:** `partner_users` (`PartnerUser`) knyttet til én `Partner`
  (slettes med partneren) og til den admin, der inviterede. Samme række er
  invitation og bruger: før accept er `passwordHash` null og kun hashen af
  invitationstokenet gemt; ved accept sættes adgangskoden, og tokenet
  nulstilles (engangsbrug). Migration `20261002120000_partner_users`.
- **Invitation:** navn + e-mail + partner → mail fra `invite@hellocal.io`
  med link `/partner/invite/<token>`, gyldigt **72 timer**. Modtageren vælger
  adgangskode (samme krav som admin-adgangskoder, 12 tegn m.m.) og er logget
  ind. En accepteret bruger kan ikke inviteres igen (så et nyt link ikke kan
  overtage en eksisterende adgang). Kan mailen ikke sendes, vises linket kun
  for den, der inviterede, i 5 minutter (httpOnly-cookie).
- **Login/session:** e-mail + adgangskode på `/partner/login`
  (`/api/partner/login`, generisk fejl + bcrypt-timing som admin, 5 forsøg
  pr. 15 min). Egen cookie `hc_partner_session` (JWT, purpose
  `partner-session`, 12 t, `PARTNER_SESSION_SECRET` ellers
  `ADMIN_SESSION_SECRET`). Middleware gater `/partner/*` og `/api/partner/*`
  (undtagen login og invitationslink); `requirePartnerUser()` tjekker i
  databasen aktiv/accepteret/2-faktor sat og `sessionsValidFrom`.
- **2-faktor (TOTP) er obligatorisk** (brugerens valg 2026-10-03), som hos
  admin-brugerne: ved tilmelding vælges adgangskode, derefter scannes en
  QR-kode og første kode bekræftes — først da oprettes adgangen
  (`PartnerUser.totpSecret`, migration `20261003090000_partner_user_totp`).
  Ved hvert login: adgangskode (`/api/partner/login`, sætter kun en 5-minutters
  `hc_partner_mfa`-cookie) → kode på `/partner/verify` (`/api/partner/verify`),
  som først udsteder sessionen. Mistet telefon: admin sletter brugeren og
  inviterer igen. Godkendelse af nyt udstyr og IP-begrænsning (som admin) er
  ikke indført for B2B.
- **Admin kan:** gensende/trække invitation tilbage, deaktivere/aktivere,
  "log ud overalt" og slette. Deaktivering og log-ud sætter
  `sessionsValidFrom`, så eksisterende sessioner afvises straks.
- **Portalen (`/partner`):** partnerId kommer altid fra sessionen, aldrig fra
  klienten. Viser egne lokationer med visninger/klik/klikrate (7/30/90 dage,
  samme `getPartnerStats` som admin og rapport-mails), seneste sendte
  rapporter og rapportmodtagere. Fuld browserbredde uden app-skal (AppFrame
  undtager `/partner`; AuthGate kræver ikke brugerlogin dér).
- Portalen ligger på det offentlige domæne (hellocal.io), ikke admin-værten,
  da admin-værten omskriver alle stier til `/admin` og er IP-begrænset.
  `PARTNER_BASE_URL` kan overstyre linkets base (standard `APP_BASE_URL`).
## 2026-10-02: Første testperson af en integration (300 points)

- Hver integrations side viser et popup-banner (bundark med det grønne points-kort): "Bliv den første testperson af {app}, og optjen 300 points". Brugeren tilmelder sig via linket nederst i arket; "* Læs betingelser" linker til `/betingelser#pointsystem`.
- Kun den allerførste, der tilmelder sig, får pladsen: én testperson pr. integration (`IntegrationTester`, unik pr. provider). Banneret vises kun, mens pladsen er ledig, og ikke igen på enheden, når brugeren har lukket det.
- Points gives først, når admin godkender under Admin → Brugere → **Test-programmes** — samme regel som produkter og fejlrapporter (2026-09-02). Admin ser, om appen er aktiveret, og hvornår den sidst hentede data. Godkendelse giver 300 points (`INTEGRATION_TESTER`) én gang; afvisning sletter tilmeldingen, så pladsen bliver ledig igen.

## 2026-10-02: Butiksimporten: alt fra arkene med (Bilka + REMA 1000)

Erstatter "Varer uden kcal/protein/kulhydrat/fedt springes over" fra 2026-09-27.

- **Alle rækker importeres** (brugerens valg: "Det er lige meget om de har protein mv. med. Så tager vi det fra Frida senere"). 13.039 varer i stedet for 10.524.
- **Uden kalorietal** (2.364 varer: mest vin/øl/spiritus, krydderier, kaffe/te, frisk frugt/grønt og kød): `Product.nutritionMissing = true`, kcal/protein/kulhydrat/fedt = 0 som pladsholder. Varen er skjult i alle opslag, hvor en bruger kan finde og logge den (søgning, tekst-/foto-/måltidsgenkendelse, næringsmatch, generiske kandidater), og får **ingen stregkode-række** — scanning ender derfor stadig i Open Food Facts eller kameraflowet, hvor brugeren kan oprette varen med rigtig næring. Opretter en bruger den, opdateres brugerens vare ved næste import, og den skjulte kopi slettes. Varesiden viser "Næringsindhold ukendt" og admin "Mangler – skjult i appen". Næring hentes senere fra Frida (egen opgave): udfyld, sæt `nutritionMissing = false`, opret stregkoden.
- **Med kalorietal men uden protein/kulhydrat/fedt** (151, mest spiritus og øl, hvor kun energien er deklareret): synlige; den manglende makro er 0 og markeret `ESTIMATED` i `nutrientSources` (~). En eksisterende vare beholder sine egne makroer.
- **Energi repareres**: Bilka-arkets kJ er tal, så 1105 kJ stod som 1,105 (ca. 4.900 varer). Desuden byttede kolonner, kJ = 0 ved siden af kcal, og 25 kcal-værdier, hvor arkets egen kJ og makroerne (4P + 4C + 9F + 2 fiber) er enige mod kcal (fx Marineret flanksteak 15 → 152, Chiliolie 37 → 392); aldrig på alkohol. Alle rettelser står i tjeklisten. kJ på admin-gennemgåede varer repareres også (en tusind-fejl er intet valg).
- **"Sukkerfri" kun op til 0,5 g sukker pr. 100 g** (EU's grænse; brugerens valg). REMA's "Sukkerfri" på 44 varer med mere sukker var REMA's mærke "Ikke tilsat sukker" → filteret "Uden tilsat sukker" (sukkerpåstandene fra samme dag). Det samme gælder "sukkerfri"/"uden sukker" i titlen på en vare med over 0,5 g sukker. Butikkens eget Sukkerfri-mærke i Bilka-arket (`_is_sugar_free`) står ved magt.
- **Info-arkenes "Labels"** udfylder filtre, arkene lod stå tomme (fuldkorn, vegetarisk, certificeringer, dyrevelfærd, oprindelsesland), og REMA's "Additional Product Information" giver oprindelsesland.
- **Vitaminer/mineraler**: findes ikke i arkene (kolonnerne var tomme) — bilka.py åbnede aldrig panelet "Info om vitaminer og mineraler". Nyt tillægs-script `bilka_vitamins.py` (brugeren kører det selv) skriver `bilka_vitamins.xlsx`; importen gemmer værdierne i `micronutrientsPer100g` med kilde LABEL, så de afløser Frida-skønnene (~) på varesiden.
- **Navne**: varer opkaldt efter brandet alene hed "0"/"1"/"M appelsin" (titlen minus brand og mængde); nu butikkens egen titel ("Coca cola", "Breezer m. appelsin"), og første bogstav er stort.
- Admin-gennemgang i Dubletter nulstilles ikke af kJ-rettelsen eller de afledte sukkerpåstande.
## 2026-10-02: Opret vare — levende scanning på alle trin, trin-overskrift og hvid udfyldning

Brugerens test: efter stregkoden frøs flowet et foto pr. trin, lagde
scanningsstriben over stillbilledet og læste det ene foto — man kunne ikke se,
om varen var "taget", og det føltes ikke som scanning i realtid.

- **Kameraet fryser aldrig.** Forside, energi og indhold tager ikke længere ét
  foto. `useLiveFrames` (afløser `useAutoCapture`) måler skarphed/stilstand
  som før og afleverer løbende billeder af den kørende video, hver gang varen
  er i fokus og forrige analyse er færdig. Forsiden bruger det skarpeste af en
  lille serie (3 billeder/0,8 s; fire stille målinger). Energi og indhold
  læses billede for billede med lokal OCR (to stille målinger pr. billede), og
  aflæsningerne lægges sammen i `src/lib/live-scan.ts`: den bedste vinder
  (sikkerhed + tillæg for fundne felter) og låner næringstal/ingrediensliste/
  tekstfeltets placering fra de andre. Trinnet er klaret, når feltet er læst
  lokalt med ≥ 70 % sikkerhed, når ti billeder med tekst er brugt (bedste
  bruges; serverens AI læser resten som før), eller når brugeren trykker "Tag
  billede" (afslutter med den bedste aflæsning). Tesseract-arbejderen
  genbruges nu mellem billederne (`product-ocr-prioritized.ts`); før kostede
  en ny arbejder ~1 s pr. foto.
- **Samspil med stillbilleder (samme dag):** den levende scanning styrer kun, *hvornår* der tages foto, og hvad telefonen selv læser (videobilleder ≤ 1600 px, energi/indhold beskåret til søgerens kvadrat). Når et trin er klaret, tages fotoet til serverens AI stadig som kameraets stillbillede (`captureStill`, `src/lib/camera-still.ts`), mens den hvide udfyldning vises. `IngredientsRetakeFlow` bruger fortsat `useAutoCapture`.
- **Trin-overskrift** øverst i kamerabilledet i det mørke overlay, fed hvid
  (`.hf-scan-heading`): "Scan stregkode", "Scan billede", "Scan energi",
  "Scan indholdsfortegnelse".
- **Hvid udfyldning, når et trin er klaret** (`.hf-scan-fill`, 1,4 s): på
  forsiden fyldes varens kontur fra det levende omrids (MediaPipe-masken,
  `drawFill`) helt hvid, så fx mælkekartonen står hvid på kameraet; findes
  ingen kontur, fyldes midterrammen. På energi/indhold fyldes det læste
  tekstfelt (OCR-boksene) hvidt oven på videoen (`LabelFillOverlay`, afløser
  `LabelTextHighlight`s grønne ramme på et frosset foto); findes ingen boks,
  bruges konturen. Først derefter går flowet videre. Ved reduceret bevægelse
  vises fladen uden animation (0,6 s).
- **Scanningsstriben** (`.hf-scan-sweep`) fejer nu over den levende video på
  alle fototrin og under oprettelsen; `.hf-scan-lift` bruges ikke længere i
  flowet. Stregkodetrinnet (AR-afkodning) er uændret.
- Beholdt: fluebenene på trin-knapperne, "indhold står på energibilledet",
  stregkodefotoets baggrunds-OCR (viser nu tekstfeltet hvidt, hvis brugeren
  står på det trin), og vælgeren ved flere objekter — den fryser stadig
  billedet, mens brugeren trykker, fordi målene skal stå stille.
- Admin "Log" får en `label_attempt`-linje pr. læst billede (sikkerhed,
  skarphed, fundne felter) og antal billeder i `nutrition_photo`/
  `ingredients_photo`.

## 2026-10-02: Kameraflowet tager rigtige stillbilleder + "tag nyt billede af indholdet"

- Årsag: en marmelades ingrediensliste (30. sept.) blev aldrig aflæst. Loggen viste, at OpenAI fik fotoet, men svarede "for sløret til sikker aflæsning" (tom liste, sikkerhed 12 %). Fotoet var et 1080p-videobillede; appen sagde intet og prøvede ikke igen. Der var ingen genstart — PR #151 (genoptagelse efter genstart) byggede på et forkert gæt og er droppet.
- Forside, energi og indhold tages nu som kameraets stillbillede (`ImageCapture.takePhoto`, `src/lib/camera-still.ts`) — stadig automatisk, uden tryk. Har browseren ikke funktionen, bedes videostrømmen om 4K, og det skarpeste af tre videobilleder bruges. Stregkodefotoet er stadig ét videobillede (må ikke forsinke scanningen).
- Energi- og indholdsfotoet beskæres til det kvadrat, brugeren så i søgeren (ændrer "ingen beskæring" fra 2026-09-17 for de to trin; forsiden er stadig hele fotoet). Længste side højst 2048 px.
- Hvert foto logges (`photo_captured`: stillbillede/videobillede, opløsning, skarphed).
- Kunne AI ikke læse ingredienslisten, viser varesiden "Indholdet kunne ikke læses på billedet" med knappen "Tag nyt billede af indholdet" — kun for den, der oprettede varen (`ingredientsUnreadable` i `GET /api/products/[id]`). Knappen åbner `/camera?retake=ingredients&product=<id>` (`IngredientsRetakeFlow`), og `POST /api/products/[id]/ingredients-photo` læser det nye foto med OpenAI. Intet automatisk genforsøg på det samme foto (brugerens valg).

## 2026-10-02: "Til info sendte vi dig …" (mail/sms var ikke spam)

- Hver mail eller sms til en kendt bruger giver (1) en push med det samme: "Vi har netop sendt dig en e-mail om "emne". Dette var ikke spam." og (2) et bundark som det første ved næste besøg (app og web): "Til info sendte vi dig den <dato> en <e-mail/sms> om "<emne>". Dette var ikke spam." med sort knap "Læst".
- "Læst" kvitterer (`OutboundMessage.noticeAckAt`); et træk ned lukker kun til næste besøg. Beskeder ældre end 30 dage vises ikke. Gælder ikke mails til admin, ikke-brugere (invitationer) eller rene push-beskeder.
- Bygger på den eksisterende `OutboundMessage`-log — ingen adresse eller telefonnummer gemmes. Sms sendes via `src/lib/sms.ts` (GatewayAPI-format, no-op uden `SMS_GATEWAY_TOKEN`); brugere har endnu intet telefonnummer-felt, så ingen sms sendes i dag. (Opdateret 2026-10-02: TeamMessage er nu primær udbyder, og mobilnummer findes på profilen — se "SMS-gendannelse af adgangskode".)

## 2026-10-02: Vægt- og længdeenheder (kg/lb/st, cm/in)

- Brugeren vælger vægtenhed (kg, pund eller stone+pund) og højde-/kropsmål-enhed (cm eller tommer) i startguidens første trin og under Indstillinger → Sprog og region. Valget gemmes pr. enhed i localStorage (som kalendervisning); databasen gemmer stadig altid kg og cm.
- Standard udledes af landet (profilens region, ellers browserens): USA/Canada → pund + tommer, UK/Irland → stone+pund + tommer, resten kg + cm. Stone indtastes som `11 5` (stone pund). Tempo (kg/uge) og statistik-grafen bruger pund i stedet for stone.

## 2026-10-03: Bølge-baggrunden — afdæmpet, skarp top, puls fra kanten

- Erstatter udseendet fra 2026-10-02 (brugeren: "alt for voldsomt", "en ommer"). Baggrunden skal være afdæmpet: få, tynde, svage bånd.
- Kun bunden må være sløret/frostet; toppen er skarp (ingen blur, ingen tåge).
- Puls-linjen (hjerteslaget) ligger længere nede — omkring tal-hjulets midte — og går helt ude fra skærmens venstre kant.
## 2026-10-03: Bølge-baggrunden — tykke frostede bånd, stop ved listen

- Forneden er bølgerne tykke, slørede bånd (frostet glas), ikke tynde linjer som i toppen. Toppen er fortsat skarp.
- Baggrunden stopper ved "Dagens tilføjelser"-stregen og må ikke ses bag tilføjelserne (erstatter "fortsætter ca. 40 px ind i listen" fra 2026-10-01).
- Farver: overvejende grønne; gul kun som et svagt strejf øverst (erstatter "gul-brunlige nuancer øverst").
- Let 3D: perspektiv (fjerne bånd foroven tynde/svage/langsomme, nære forneden tykke/tydelige) og rør-skygge med lys kant på hver streng.

## 2026-10-02: Ingen manuel produktoprettelse — kun scanning

- Nye produkter oprettes udelukkende gennem scanning (stregkode → foto-flowet
  i `/camera?mode=product` og agent-appens `/scan/opret`). Den manuelle
  formular på `/foods/new` er nedlagt; ruten omdirigerer til scanneren, så
  gamle links og bogmærker ikke giver 404. Beslutningerne 2026-09-19 og
  2026-09-23 om den manuelle formular er dermed ophævet.
- `POST /api/products` beholdes (bruges af foto-flowet). Private
  ingredienser (`/ingredients/new`) er ikke produkter og berøres ikke.

## 2026-10-01: Bølge-baggrund på forsiden

- Forsiden får en rolig, tilfældig bølge-animation bag topbar og hero (til ca. halvvejen mellem skillestregen og "Ingen registreringer i dag"), grønne nuancer øverst mod gullig creme nedenfor, så den næsten går i et med baggrunden. Bløde bånd (hverken tynde streger eller brede bølger), ingen prikker/tern/striber, ingen DNA-agtig regelmæssighed; langsom og rolig, ikke pulserende lydbølger.
- Nederste del er sløret som frostet glas (tre lag med stigende blur) og toner ud. Tegnes i canvas; farver læses fra tokens ved kørsel.
- Layout-konsekvens: DailyList-containeren har ikke længere `bg-hf-cream`; tal-hjulets rækker klippes ved hero-bunden i `StatsWheel` i stedet for at blive dækket af listen.
## 2026-10-03: "Den typiske bruger" på Business-siden

- Brugerens krav: annoncør-siden (`/business`) viser medianen/den typiske bruger med statistik over brug, vægttab og mest indtastede produkttyper, og hvordan den typiske bruger adskiller sig i procentpoint fra gennemsnittet af brugere med samme køn og alder.
- **Typisk bruger = median** pr. nøgletal over aktive brugere (mindst én registrering de seneste 30 dage eller vejninger over tid); køn = det hyppigste. Børneprofiler (`FamilyMember.isChild`) tælles aldrig med — de ser ingen reklamer.
- **Hvem tæller som bruger (ejerens beslutning 2026-10-03):** kun børneprofiler udelades. Voksne familieprofiler og betalende (Seriøs) tælles med som alle andre — familieabonnementet er betalt uanset, så at de ikke ser reklamer er ingen grund til at udelade dem af statistikken.
- **Sammenligningsgruppe** = brugere med samme køn og alder ±5 år omkring medianalderen (mangler køn/alder, sammenlignes med alle). Forskel vises i **procentpoint** for andele (dage med registrering, vægtændring i % af startvægt, andel der har tabt sig, andel pr. produkttype) og i relativ **procent** for registreringer pr. uge.
- Perioder: brug 30 dage, produkttyper 90 dage (`Product.productType`; retter = "Retter", råvarer = "Råvarer"), vægtændring = seneste minus første vejning med mindst 14 dages mellemrum.
- **Aldrig opfundne tal og aldrig enkeltpersoner:** under 10 aktive brugere vises kun en forklaring; sammenligningen kræver mindst 5 i gruppen. Fejler databasen, vises sektionen uden tal. Beregnes ved hver sidevisning (ingen cache) — overvej cache, når brugertallet vokser.
## 2026-10-02: Kalenderen husker den åbne dag

- Går brugeren ind på en dag (dagsvisningen) og forlader /calendar (åbner en registrering, en anden side i bundmenuen osv.), genåbnes samme dag, når brugeren kommer tilbage — ikke månedsvisningen. Bruger-feedback 2026-10-02 ("det er irriterende").
- Mekanik (`src/lib/calendar-open-day.ts`): den åbne dag spejles i URL'en som `/calendar?date=YYYY-MM-DD` (replaceState, så Tilbage-knappen lander på dagen) og i sessionStorage (så "Kalender" i bundmenuen, der linker til ren `/calendar`, også genåbner den — højst 6 timer efter, så en gammel dag ikke dukker op dagen efter i app'ens WebView).
- Lukker brugeren selv dagsvisningen (tilbagepil, Escape, skift til anden visning), glemmes dagen igen, og indstillingen Kalendervisning gælder som før. Rækkefølge ved indlæsning: `?date=` → nylig dag i sessionStorage → `?view=day`/indstillingen Kalendervisning.
## 2026-10-02: Håndfrugter og æg i Lille / Normal / Stor

- Frugt og snack-grøntsager, man spiser hele, samt æg får tre størrelser i mængdevælgeren: Lille, Normal, Stor. Normal er startmængden (efter brugerens egen seneste mængde og en rigtig portionsenhed).
- Hver størrelse har hel vægt (køkkenvægt) og spiselig vægt = hel vægt minus USDA's spild-procent (skræl, sten, kernehus, skal). Den spiselige vægt registreres, fordi kalorier pr. 100 g gælder den. Mål er hele varen (Ø for runde, længde × Ø for aflange). Liste og tal: `docs/HAND-SIZES.md`, data i `src/lib/hand-sizes.ts`.
- Kobles på varens navn i kode, ikke en ny databasekolonne, så Frida-varer og butiksvarer ("Økologiske bananer") virker uden migration. Forarbejdede varer udelukkes.
- Fliserne står som vandsidens beholdere med Stor til højre; Stor-billedet er større end normalt, og de to andre skaleres lineært efter hel vægt. Der bruges varens eget billede.
## 2026-10-02: Månedsgitteret viser ÷ på afsluttede dage uden registreringer

Brugerens valg efter skærmbillede: ændringen 2026-09-25, hvor tomme dage i
månedsgitteret blev blanke, var ikke bestilt og er rullet tilbage for
månedsgitteret. Regel for dagfelterne i månedsvisningen:
- Dag med registreringer: ✓ (signaturgrøn `hf-green`, se 2026-10-03) når indtaget er på eller under målet,
  ÷ (rød) når målet er overskredet. Uændret.
- Afsluttet dag (før i dag) uden registreringer: ÷. En dag, der ikke er
  registreret, tæller som ikke nået.
- I dag og fremtidige dage: ingen markering.
Uge- og Liste-visningen beholder "Ingen indtastninger" i gråt på tomme dage.
## 2026-10-02: Smagsvarianten står kun i H2 på varesiden

- Brugerregel: smagsvarianten (fx "Pære & havtorn") må aldrig gentages i H1. Den står kun i den grønne H2 sammen med mængden.
- `splitProductHeading` i `src/lib/product-naming.ts` fjerner `variant` og `flavor` fra varenavnet før visning. Matchet er på hele ord, uafhængigt af store/små bogstaver, og "&", "og", "and" og "+" sidestilles. Løse bindeord ("med", "og") og skilletegn i enderne fjernes også.
- Er navnet kun smagen, bliver produkttypen H1. Mangler produkttypen, står navnet i H1, og smagen udelades af H2, så den aldrig står to gange.
- Det gemte `Product.name` røres ikke. Navnet sammensættes stadig af Sub brand + Produkttype + Variant (2026-09-23), fordi lister og søgning ikke har nogen H2.
- Tests: `src/lib/product-naming.test.mjs`.
## 2026-10-02: Motion lægges oven i dagens mål i kalenderen

- Registreret motion (`Activity.caloriesBurned`, uanset kilde) lægges oven i
  dagens kaloriebudget, når kalenderen afgør "inden for målet": dagvisning,
  månedsstatus, prikker i månedsgitteret, uge-/listevisning (over/under og
  ugebalance), årsvisning og stribe. Brugerens valg 2026-10-02.
- "Mål: X kcal" viser fortsat budgettet uden motion; motionen står som egen
  linje (rød flamme + grøn "+ N kcal") over målet, og "Tilbage"/"Overskredet"
  regnes mod mål + motion. Fælles blok: `GoalStatusSummary` (design.md §6.16).
- Ikke ændret endnu: forsidens "Tilbage"-kort (`frontpage-stats.ts`) og
  widgets (`widget-data.ts`) regner stadig mod budgettet alene — skal følge
  samme regel, når de rettes (andre gruppers filer).
## 2026-10-02: Telefonnummer er obligatorisk (tofaktor-godkendelse)

- Alle brugere, der kan logge ind, **skal** have et telefonnummer (`User.phone`), fordi det skal bruges til tofaktor-godkendelse (brugerens krav). Nummeret er obligatorisk ved tilmelding og kan rettes, men aldrig slettes, på profilsiden.
- Gemmes normaliseret i **E.164** (`src/lib/phone.ts`): nationalt nummer uden landekode får landekoden fra `User.region` (standard +45); ellers kræves `+`/`00` og 8–15 cifre. Ingen opslag hos teleselskab; `phoneVerifiedAt` er reserveret til SMS-bekræftelsen, når tofaktoren bygges, og nulstilles ved nyt nummer.
- Konti uden nummer (oprettet med Google/Apple/Facebook, eller før kravet) spærres ikke ude, men sendes af `AuthGate` til `/account/phone` ved første side efter login og kan ikke bruge appen, før nummeret er udfyldt. Kolonnen er derfor nullable i databasen.
- **Børneprofiler er ikke undtaget** (brugerens valg): de skal også oplyse nummer, når de logger ind — de kan fjerne forældrenes adgang, når de fylder 18. Familieprofiler uden eget login kan først udfylde det, når de får login. Admin-konti (`/admin`, eget login med TOTP) kræver ikke nummer.
- Nummeret er persondata: det slettes sammen med resten ved "glem mig" og vises aldrig til andre brugere.

## 2026-10-02: Grafer på "Tilføj til statistik" og samlede mineral-/vitamingrafer

- Graferne på "Tilføj til statistik" vises i fuld bredde og tegnes af samme kode og data som på statistiksiden, så brugeren ser grafen, som den faktisk vil se ud. Tilføjes med en "+ Tilføj"-knap under grafen, ikke ved tryk på selve grafen.
- Ingen grafer pr. enkelt mineral eller vitamin. Der findes én "Mineraler"- og én "Vitaminer"-graf; brugeren vælger selv linjerne i grafens dropdown. Standard: calcium, jern, kalium og vitamin A, C, D.
- Ældre gemte layouts med de gamle enkelt-grafer omskrives til gruppegraferne.
- Grafernes linjevalg vises inde i kortet (ikke svævende), så det ikke klippes af omgivende bokse.
- Sprogregel fra ejeren: "krydse af", "slå til" o.l. betyder altid til/fra-knapper (`Toggle`), aldrig afkrydsningsfelter.
## 2026-09-30: Kropsmål — køn styrer tegningerne strengt; væske hører under vægt

- Kropsmål-siden viser kun tegninger, der matcher profilens køn: mand → mandlige,
  kvinde → kvindelige. Intet køn (eller profil endnu ikke hentet) → ingen tegning
  og hint om at vælge køn. Der gættes aldrig på et køn (tidligere faldt siden
  tilbage på kvindelige tegninger, hvilket en mandlig bruger fik vist).
- Hvert kort har titlen til venstre og talfeltet på samme linje til højre med
  "cm" efter — aldrig under overskriften. Tomt felt viser "–", ingen forslag
  som "fx 82" (brugerkrav 2026-09-30).
- Væske (kropsvand), fedtprocent og muskelmasse hører under vægten, ikke på
  Kropsmål-siden: de er valgbare serier i statistikgrafen "Kalorier og vægt"
  (efter Vægt/Trendvægt) — og kun når en tilsluttet integration har læsetypen
  "Fedtprocent m.m." (`read.bodyFat`) slået til i sin opsætning. Linket til
  `/statistics/body-water` fra Kropsmål er fjernet; siden findes stadig uden link.

## 2026-10-02: Nøgleord på produktsiden

- Brugerens krav: øvrige nøgleord (smagsretning, økologisk m.fl.), som admin vælger, listes før "Energifordeling" i HelloFresh' sorte, større brødtekst (`.hf-type-body-lg`, samme som velkomstsidens introtekst).
- Admin vælger globalt (én række `product_page_tag_settings`): hele felter fra `products.flavor` / `product_filters` og enkelte frie nøgleord fra `products.keywords`. Ikke pr. vare.
- Rækkefølge = feltkatalogets rækkefølge, derefter frie nøgleord i varens rækkefølge. Dubletter (uden store/små bogstaver) vises én gang. Procent vises som "4,6 % alkohol"/"3,5 % fedt", oprindelsesland som "Fra Danmark".
- Certificeringslogoerne under energifordelingen er uændrede; et felt kan derfor både stå som ord og som logo.

## 2026-09-29: Aktivitetsniveau, PAL og kaloriemål

- Erstatter faktorerne i 2026-09-28 "Aktivitetsniveau i 5 trin" (1,2–1,9). Nye niveauer og PAL-intervaller: se `docs/ACTIVITY-PAL.md` (planen; intet bygget). Ingen aktive brugere, så gamle niveauer erstattes uden overgangslogik.
- Hverdags-PAL beskriver hverdagen uden motion. Motion fra onboarding lægges på som **fast dagstillæg** (brugerens valg), men erstattes på en dag af logget/målt aktivitet, så træning aldrig tælles to gange. MET regnes netto (MET − 1).
- Kalibrering mod vægt over tid er **dynamisk og løbende** (ingen bekræftelse), forklaret for brugeren og begrænset af de eksisterende grænser.
- Guiden dækker også **kaloriemålet** (vedligehold/tabe/tage på med tempo), aldrig under `minimumHealthyKcal`, ingen underskud for børn. Erstatter de faste konstanter i `src/lib/goals.ts`.
- Estimater vises som "ca." med interval; ikke som laboratorietal.

## 2026-09-29: Offentlig forside (udlogget) — hent appen, ingen telefonramme

- Udloggede besøgende på `/` ser en hent-appen-side i fuld browserbredde (`src/components/landing/`): menu med "Log ind" øverst til højre, hero med butiksknapper + QR-koder (App Store og Google Play), bundark-overlay over en vægtgraf, funktioner, tegnede skærmbilleder, nøgletal, Hello Doc-bjælke, planer + FAQ og "I medierne".
- **Aldrig telefonramme eller app-skal på de offentlige sider** (brugerens krav): `MarketingShell` skjuler WebShell-sidebjælke/topbjælke på `/` (samme teknik som den tidligere landingpage), og `/business` + `/presse` vises i fuld viewport af `AppFrame`. AuthGate sender ikke længere udloggede fra `/` til `/welcome`. Afløser "app-først"-landingpagen fra samme dag.
- Nøgletal er rigtige tal fra databasen (godkendte varer, mærker, delte opskrifter, E-numre) — aldrig opfundne. "I medierne" (omtale + bedømmelser) vises først, når der står rigtige citater i `PRESS_MENTIONS` (`src/lib/landing-content.ts`).
- Planer: "Vælg" på Seriøs/Seriøs Familie åbner et bundark med periode og betaling. Uden konto → `/signup?next=/profile/subscription/<plan>?months=<n>`, som lander på købssiden med samme valg.
- Footer: kun Business-partnere (`/business`: muligheder + den eneste kontaktformular, mailes til `BUSINESS_CONTACT_EMAIL` eller support@) og Presse (`/presse`: fakta, logoer, kontakt via business-formularen). Ingen andre kontaktformularer og ingen sociale medier.
- Butikslinks står i `APP_STORE_URL`/`PLAY_STORE_URL` (`src/lib/landing-content.ts`); QR-koderne følger dem automatisk.

## 2026-10-02: Sukkerpåstande til søgning (ikke mærker)

- Nye filterkolonner på `ProductFilters`: `lowSugar` ("Lavt sukkerindhold"), `noAddedSugar` ("Uden tilsat sukker"), `reducedSugar` ("Reduceret sukker") og `lightSugar` ("Light"), ved siden af den eksisterende `sugarFree`. Samme mønster som øvrige filtre: tom = nej/ukendt, udfyldt = ja. Migration `20261002100000_sugar_claim_filters`.
- **De vises ikke som mærker i appen** (brugerens krav) — de findes kun, så man kan søge på dem: `GET /api/products?q=` matcher nu også de fem sukkerkolonner (fx "sukkerfri", "light", "uden tilsat").
- Udledes i `scripts/store-products-import/build_data.py` (`sugar_claims`): først og fremmest af nøgleord, derefter navn, variant, smag og produkttype (påstanden står ofte kun i nøgleordene). `lowSugar` udledes også af sukker pr. 100 g: højst 5 g (drikkevarer 2,5 g), og sukkerfri tæller som lavt.
- Kendt begrænsning: en påstand, der kun står som ikon på emballagen, kan ikke aflæses; den må tilføjes manuelt i admin (Dubletter/Butiksdata). Produkter uden sukkertal får ikke `lowSugar` af næringen.
- Nye kolonner fyldes først ved næste kørsel af `build_data.py` + `store-products-agent`.

## 2026-09-29: Admin-brugere (adgang til admin-panelet)

- Punktet "Admin-brugere" ligger i profil-menuen (avatar øverst til højre) — bevidst uden for sidemenuen. `/admin/admin-users`, kun for fuld administratoradgang.
- To niveauer (`User.adminAccessLevel`): **Læseadgang** (middleware afviser alle POST/PUT/DELETE/server actions med 403, undtagen log ud, sprog og egne passkeys) og **Administrator** (fuld). Den første administrator (`/admin/setup`) er altid fuld og kan ikke ændres af andre.
- Invitation: navn + e-mail + niveau → mail med link `/admin/invite/<token>`, gyldigt **24 timer**, kun én brug (kun tokenets hash gemmes, `admin_invites`). Modtageren vælger adgangskode og scanner TOTP-QR; først ved bekræftet kode oprettes brugeren. En e-mail, der allerede er bruger, kan ikke inviteres.
- **2-faktor er obligatorisk** ved hvert login (adgangskode + TOTP, eller passkey som allerede er to faktorer).
- **Godkendelse af nyt udstyr er obligatorisk for inviterede brugere:** login fra en browser uden godkendt enheds-cookie sender et 15-minutters link til brugerens egen mail (`/admin/login-approval/<token>`, kræver aktivt klik); login-siden venter og fortsætter først, når brugeren har godkendt, og kun i samme browser. Den første administrator er undtaget (ellers kan vedkommende låses ude uden mail). "Log ud overalt og nulstil udstyr" tvinger ny godkendelse.
- **Underretning:** når en invitation accepteres, mailes den, der inviterede, og der vises rød prik/tæller på avataren og banner på Admin-brugere, til siden er set (`AdminInvite.acceptSeenAt`).
- **IP-begrænsning pr. bruger** (`adminAllowedIps`, kommasepareret; IPv4-CIDR understøttes): tjekkes ved login og på hver forespørgsel. Kommer *ud over* den globale `ADMIN_ALLOWED_IPS`-spærre i middleware.
- **Sporing:** `admin_login_events` (tid, sted fra Cloudflare-headers, IP, udstyr, resultat inkl. mislykkede/blokerede forsøg) og `admin_devices` vises pr. bruger. By-oplysning kræver Cloudflares "visitor location headers"; ellers vises kun land.
- Deaktivering, niveauskift, IP-ændring og "log ud overalt" sætter `adminSessionsValidFrom`, så eksisterende sessioner afvises med det samme (`requireAdminUser`). Fortolkning: "godkende" ved login er udstyrs-godkendelse via brugerens egen mail.

## 2026-09-29: Vitaminer og mineraler har egen info-side som E-numre

Vitaminer/mineraler på varesiden er klikbare på samme måde som E-numre: popup
→ `/vitaminer` med ét ankret afsnit pr. næringsstof. Indholdet ligger statisk
i koden (ikke i databasen), da det er ~24 faste poster; referenceindtag er
EU's NRV (forordning 1169/2011 bilag XIII), samme tal som "% RI".

## 2026-10-02: Kamera uden knap, h1/h2 uden gentagelser, 10 %-reglen for udklip

- Tilføj-kameraet har ingen "Tag billede"-knap. Fotoet tages automatisk, når
  varen er skarp og stille; holdes kameraet stille uden at nå skarpheds-
  grænsen, tages det efter 2,4 s, og senest 8 s efter trinnet startede. Et
  tryk på kamerabilledet tager det med det samme. Rammen er 92 % af billedet.
  Fotoet er kameraets stillbillede, ellers det skarpeste af tre
  videobilleder (`camera-still.ts`, samme dato) — ægte HDR-bracketing er
  ikke muligt i browseren (ingen eksponeringsstyring på iPhone);
  tone-udjævning sker i billedrobotten. Telefonens dybdesensor
  (LiDAR) er heller ikke tilgængelig for websider; omridset om varen kommer
  fortsat fra MediaPipe-segmenteringen (2026-09-28).
- Varesidens h1 (sort) og h2 (grøn: pakningsstørrelse · variant) må aldrig
  gentage hinanden. Fedtprocent, laktosefri, smag osv. hører til varianten.
  Reglen håndhæves tre steder: AI-prompten (front-v4), berigelsen
  (`stripHeadingRepeats` fjerner variant/pakningsstørrelse fra navnet) og
  varesiden (`splitProductHeadings`), så også ældre varer vises rigtigt.
  Stregkode-fotoets variant sættes kun i variant-feltet — aldrig ind i navnet
  (erstatter den del af 2026-09-28 "variant i navnet").
- Brand fra databasen vinder: kender databasen ikke AI'ens brand, men står
  et kendt brand ordret i forsidens tekst (mindst 4 tegn, eksakt normaliseret
  match), bruges det, og AI'ens brand bliver subbrand. Hjerter,
  kvalitetsmærker, segl og slogans er ikke logoer.
- Produktcirklen: et fritskrabet billede (PNG under `/product-images/cutouts`)
  lægges oven på cirklen i 110 % størrelse — stående varer med bunden i
  cirklens bund (toppen 10 % over), liggende fra venstre kant (10 % ud over
  højre). Hele varen er altid synlig. Råfotoet (før udklippet) vises
  `object-contain` i cirklen, aldrig zoomet. Brandlogoet er 66 px højt (70 %
  af de tidligere 95). Store æsker (cornflakes) er ikke behandlet særskilt.
- Næringsdetaljerne (salt, sukker, fibre, mættet/umættet fedt m.m.) vises
  altid som dropdown under energifordelingen, når der findes mindst én værdi;
  "udvidet næringsindhold" i Opsætning styrer nu kun, om den står åben.
  Umættet fedt udledes som fedt − mættet − trans (markeret ~), når
  deklarationen ikke oplyser det.
- Billedrobotten afviser et produktudklip, der dækker under 12 % af udsnittet
  eller er under 30 % i bredde/højde (`CUTOUT_PRODUCT_MIN_COVERAGE`/
  `CUTOUT_PRODUCT_MIN_SIDE`), så råfotoet bliver stående i stedet for et tomt
  billede.

## 2026-09-28: Produktcirklen viser kun brandets eget logo

Hello Cal-frugten ligger ikke længere oven på produktcirklen. Har brandet et
logo (`Brand.logoUrl`), ligger det med bunden i cirklens bund og venstre kant
3/4 inde i cirklen (95px, `z-10`). Uden logo står brandnavnet samme sted i fed
grøn tekst. Brandet står ikke længere under produktnavnet, og certificeringer
(Øko m.fl.) vises kun som logoer (nederst til venstre på cirklen). Erstatter logo-afsnittet i
"hængelås på energifordeling"-beslutningen.

## 2026-09-28: Aktivitetsniveau i 5 trin

- Brugerens krav: aktivitetsniveau i 5 trin i profilen. Niveauet beskriver
  hverdagen (arbejde, gang, husarbejde) *uden* logget træning, så træning
  ikke tælles to gange — logget `Activity.caloriesBurned` lægges fortsat oveni.
- BMR-faktorer (`src/lib/activity-level.ts`): Meget lav 1,2 · Lav 1,375 ·
  Moderat 1,55 · Høj 1,725 · Meget høj 1,9. Ikke valgt = 1,2 i kalenderen
  (som før) og 1,4 i opskriftsportioner (som før). Børn bruger stadig EFSA's
  aldersværdier.

## 2026-09-28: Mailformat mod spamfiltre

- Alle mails sendes som fuldt HTML-dokument med fast bundtekst (hvorfor man
  får mailen + support-adresse), med tekstversion og Reply-To
  `support@hellocal.io` (`src/lib/email-format.ts`). Kan overstyres med
  `SMTP_REPLY_TO`.

## 2026-09-28: Levende omrids om varen i Tilføj-kameraet

- Brugerens valg: på trinnene Forside, Energi og Indhold tegnes en hvid streg, der følger konturen af varen midt i kameraet, mens brugeren sigter (live, ikke først på det tagne billede). Stregkode-trinnet har sit eget overlay og er uændret.
- Genkendelsen kører på telefonen med MediaPipe `InteractiveSegmenter` (magic touch, int8) med et positivt punkt midt i billedet. Biblioteket (`@mediapipe/tasks-vision` 1.0.1) og modellen hentes først, når kameraet bruges (jsDelivr + Google's model-storage) — ikke i app-bundlen, ingen npm-afhængighed. Modellen er ca. 30 MB og hentes kun første gang (browser-cache). Analysen kører på hovedtråden, så pausen mellem billeder er mindst dobbelt så lang som selve analysen.
- Masken udglattes over billederne; stregen skjules, hvis objektet fylder under 1 % eller over 80 % af billedet, eller hvis midten ikke rammer noget. Kan genkendelsen ikke indlæses, vises bare den faste ramme som før (log-trin `outline_unavailable`).
- Kode: `src/lib/product-outline.ts` (logik) og `src/components/camera/ProductOutlineOverlay.tsx` (takt/tegning).

## 2026-09-28: Kameraflowet — variant i navnet + logo fra stregkode-fotoet

- Varenavnet fra "opret straks" sammensættes som ved manuel oprettelse:
  produkttype + variant (fx "Vand Uden brus"), medmindre navnet allerede
  indeholder varianten. Før endte varianten kun i variant-feltet.
- Logoet står ikke altid på forsiden. Stregkode-fotoet læses derfor også af
  OpenAI (ét ekstra kald pr. ny vare, `barcode-logo-v1`) for logo og variant.
  Et logo i fotoet bliver altid et BRAND_LOGO-fritskrabningsjob (logo-kandidat).
  Brand og variant fra stregkode-fotoet bruges kun, når forsiden ikke gav dem.
  Resultatet gemmes i BARCODE-rækkens `prediction.logo`.
## 2026-09-28: Flere objekter i kameraet — brugeren vælger fokus

- Forsidefotoet i kameraflowet objektgenkendes (OpenAI vision). Ved to eller flere
  objekter markeres hvert med en grøn cirkel, og brugeren trykker på den vare, der
  skal være fokus. Ét objekt eller fejl: hele fotoet bruges uden spørgsmål.
- Undtagelse fra "ingen beskæring" (2026-09-17): efter et aktivt valg beskæres
  forsidefotoet til objektet med 15 % luft. "Brug hele billedet" bevarer det fulde foto.

## 2026-09-28: Open Food Facts kun som backup ved scanning

- Brugerens krav: Open Food Facts må kun vises ved scanning som backup, aldrig i søgeresultater.
- `GET /api/products` (Madvarer/Søg) søger kun i egen database og udelukker varer med `externalSource = OPEN_FOOD_FACTS` — også via `?source=`. Den live OFF-tekstsøgning (`searchOpenFoodFacts`, der importerede OFF-varer ved få lokale hits) er fjernet. Admin-søgeprøven (`/api/admin/search-ranking/preview`) følger samme regel.
- Stregkodeopslaget (`/api/products/lookup/[barcode]`) er uændret: egen database → Open Food Facts → USDA.

## 2026-09-28: Stregkodefotoet læses for næring og ingredienser + grøn ramme

- Brugerens krav: står ingredienslisten (eller næringstabellen) ved stregkoden, skal trinnet klares automatisk fra samme foto. Ordet "Ingredienser" på regionernes sprog (`INGREDIENTS_HEADING` i `src/lib/product-ocr.ts`) udløser altid Indhold — kan listen ikke læses lokalt, læser OpenAI den fra fotoet.
- Stregkodefotoet OCR-læses i baggrunden (`readBarcodePhoto`), mens brugeren fotograferer forsiden; det blokerer aldrig flowet. Fundne trin får flueben, og trin brugeren allerede selv har fotograferet, røres ikke.
- Tesseract giver linjernes placering (`layout`), og `src/lib/label-text-regions.ts` finder tekstfeltet: ingredienslisten fra overskriften og nedad, næringstabellen ved mindst to forskellige tabelrækker (overskrift, energi, fedt, kulhydrat, protein).
- En grøn ramme (kun kant, `--hf-color-positive`) vises om feltet: stregkodefotoet vises 1,8 s, energi-/indholdsfotoet 1,1 s før flowet går videre (`LabelTextHighlight`).
- Samme regel på energifotoet: "Ingredienser" på fotoet giver også Indhold flueben, selv om listen ikke kan læses lokalt.

## 2026-09-28: Admin "Log" — test-log indtil go-live

- Brugerens krav: log hver gang et produkt scannes, indtil appen går live, så alle trin kan testes; plus andre relevante logs.
- Ny tabel `debug_logs` (`DebugLog`) + `debug_log_settings` (til/fra). Logik: `src/lib/debug-log.ts` (server, sluger alle fejl, må aldrig vælte flowet), `src/lib/scan-debug-log.ts` (klient → `POST /api/debug-log`, kun indloggede brugere).
- Kameraflowet (`ProductCaptureFlow`) får ét flow-id pr. åbning, som sendes i headeren `x-scan-flow` til flowets API-kald. Logges: kamera klar/fejl, stregkode aflæst, opslag (egen DB / Open Food Facts / USDA / ukendt), stregkode-foto, forside-OCR + dublet-tjek, energi- og ingrediens-OCR (tid, sikkerhed, fundne værdier), oprettelse, AI-berigelse (navn/brand, energi/ingredienser og om det kom fra telefonens OCR eller OpenAI), "varen færdig" med ventende felter, samt forladte flows.
- Hvert OpenAI-kald (`callStructuredVision`) logges med tid, model og tokens; under berigelsen arver de scanningens flow-id via AsyncLocalStorage (`withDebugContext`). Hver app-cron-kørsel logges med status og tid.
- `/admin/log` (topniveau i menuen): faner Scanninger (én tidslinje pr. scanning, søgning på stregkode/vare-id), AI-kald, Cron, Fejl, og de eksisterende logs Logins, Mails og push, Admin-handlinger, Søgninger uden resultat. Knapperne "Slå fra/til" og "Ryd log". Rækker ældre end 30 dage ryddes automatisk.
- Ved go-live: slå logningen fra på siden (eller fjern den i en senere opgave).

## 2026-09-28: Produkt-database er en menugruppe (Produkter + Brands)

- Produkt-database i admin-menuen er nu en gruppe med to undersider: "Produkter" (den hidtidige produktliste, flyttet til `/admin/product-database/products`) og "Brands" (`/admin/product-database/brands`).
- `/admin/product-database` og `/admin/search` sender videre til Produkter med filtrene/søgeordet.
- Brands viser alle rækker i `brands` som kort med logo (`Brand.logoUrl`; uden logo vises forbogstavet), navn og antal produkter (talt som Produkter-listen). Søgning på navn, filter med/uden logo, 120 pr. side. Et klik åbner Produkter filtreret på brandet. Logik: `src/lib/admin-brands.ts`.
## 2026-09-28: Hello Cals kategoritræ + emballage

- Hovedkategorier (brugerens, i denne rækkefølge): Drikkevarer (Sodavand, Smoothies), Alkohol, Mejeri og æg, Kød (Rå kød, Tilberedt kød), Fisk og skaldyr (Rå fisk, Tilberedt fisk), Grøntsager og rodfrugter (Rå grøntsager, Tilberedte grøntsager), Frugt, Brød og bagværk, Kolonial og tørvarer, Færdigretter, Forarbejdet, Slik, Chips. Pålæg, plantebaseret, snacks og is får ikke egne kategorier.
- `Category` har nu `parentId` + `sortOrder`; underkategorier har fulde navne ("Rå kød"), fordi `name` er unik. Varen peger på den dybeste kategori.
- Placering sker regelbaseret i `scripts/store-products-import/build_data.py` ud fra titlen først; arkets produkttype og kødtype bruges kun, når titlen ikke siger noget, og en kødtype der modsiger titlen droppes. Årsag: ca. 80 reparerede Bilka-rækker har produkttype/kødtype fra en anden række. De står i `Produkter klar til import/Produktark/Tjekliste - mistænkelige rækker.csv`.
- Mængdeenhed følger kategorien: Drikkevarer, Alkohol og drikkelige mejerivarer (mælk, kakaomælk, kærnemælk – ikke drikkeyoghurt) i ml, alt andet i g.
- `Product.packaging` (Dåse, Flaske, Karton, Bakke, Pose, Glas, Tube, Bæger, Net) er et hint til genkendelse af varen på fotos. Det udfyldes kun ud fra eksplicitte ord i arkene/titlen og gættes aldrig; i dag har ca. 115 af 10.500 varer det.

## 2026-09-28: Admin "Retter" + HelloFresh ud af Produkt-database

- Opskrifter er ikke produkter. Ny hovedgruppe "Retter" i admin-menuen med Brugeroprettede (delte brugerretter, `SharedRecipe`; private retter vises aldrig), HelloFresh (alle HelloFresh-retter) og Valdemarsro (tom, indtil importen bygges).
- Produkt-database udelader kilder i `DISH_SOURCES` (i dag HELLOFRESH), også i overblikstal og mærke-forslag.
- Kolonnen "Kæder" i Produkt-database er de butikskæder, varen findes i (Bilka, Rema 1000).
- Billeder, som agenterne lægger i `/product-images` og `/hellofresh-images` efter app-start, serveres af en fallback-route (`src/lib/public-volume-file.ts`), fordi Next's standalone-server kun kender public-filer fra opstarten.
## 2026-09-27: Butiksvarer i tre tabeller (Bilka + REMA 1000)

- Varer fra butikkernes produktark ligger i tre tabeller:
  1. **Basisinfo** – `products` (+ `barcodes`, `product_stores`, `product_images`). Nye felter: `flavor` (smag, adskilt fra variant), `packCount` ("6-pak" → 6), `keywords` (frie nøgleord).
  2. **Makro/mikro** – `product_nutrition_features` udvidet med én talkolonne pr. værdi: kJ, enkelt-/flerumættet fedt, natrium, alkohol, B2, B12, calcium, fosfor. kcal/protein/kulhydrat/fedt/mættet fedt bliver på `products`, fordi appen læser dem dér.
  3. **Filtre** – ny `product_filters` (1:1), én indekseret kolonne pr. filter. Ikke ja/nej: tom = nej/ukendt, udfyldt = ja, og teksten er det ord/logo der vises ("Økologisk", i Tyskland "Biologisch"). Procenter er tal. Lister (GIN-index) for dyrevelfærd, certificeringer og toxiner.
- "Overfladebehandlet" er et punkt under toxiner (brugerens beslutning).
- Én vare pr. EAN; findes varen i begge kæder, vinder Bilka, og REMA udfylder tomme felter. Eksisterende vare med samme stregkode opdateres.
- Mængdeenhed: alle drikkevarer inkl. alkohol i ml, undtagen drikkeyoghurt; alt andet i gram.
- Billeder: fritlagt > Bilka-original > REMA-original. Ikke-fritlagte bruges nu og erstattes senere. Filer bruges uændret (retina) bag produktcirklens maske; fritlagte får tag "Cutout". Senere må fritlagte PNG'er bryde cirklen: portræt 10 % over toppen, vandrette 10 % ud til højre.
- Kolonne-mapping: `docs/PRODUCT_IMPORT_MAPPING.md`. Import: `scripts/store-products-import` (`build_data.py` lokalt → `data/store_products.json` + billeder; `store-products-agent` i compose skriver til databasen efter `rema1000-agent`).
- Første kørsel er bevidst kun 50 varer (20 i begge kæder, 20 kun Bilka, 10 kun REMA), så strukturen kan ses i admin (`/admin/products/[id]` viser de tre tabeller) før resten importeres.
## 2026-09-27: Admin "Produkt-database"

- Menupunktet "Produkt-database" (tidligere "Produktdatabase" → `/admin/search`) åbner nu `/admin/product-database`: alle produkter (private ingredienser udeladt) med søgning (navn, mærke, sub brand, variant, produkttype, stregkode; hvert ord skal matche), filtre for kæde (`ProductStore`, fx Rema 1000, eller "ikke tilknyttet"), mærke, sub brand (forslag indsnævres til valgt mærke), kategori, varetype, kilde, status, billede med/uden og stregkode med/uden, samt sortering (navn, dato, med/uden billede først, mærke, kcal).
- Liste- eller galleri-visning, 48 pr. side. Alle valg ligger i URL'en, så visninger kan deles og tilbage-knappen virker. Et klik åbner produktets admin-side `/admin/products/[id]`.
- Filtrene er dropdowns (`src/components/admin/FilterDropdown.tsx`, ingen knap-segmenter eller fritekst-felter). Mærke, sub brand, kategori, varetype og kilde er flervalg med afkrydsning og søgefelt; et produkt matcher, hvis det rammer mindst én valgt værdi. Kæde, status, billede, stregkode og sortering er enkeltvalg. Flervalg ligger som gentagne URL-parametre (`?brand=Arla&brand=Lurpak`).
- `/admin/search` sender videre (med søgeord); den gamle hurtig-redigering er fjernet — redigering sker på produktsiden. Logik: `src/lib/admin-product-database.ts` (server) og `src/lib/admin-product-database-query.ts` (URL-kontrakt, klient-sikker).
## 2026-10-02: "Opret straks" kan genoptages efter genstart

- Årsag (marmeladeglas 2026-10-02): baggrundsaflæsningen kører i app-processen (`after()`), og hvert push til master deployer og genstarter appen. Blev processen stoppet midt i aflæsningen, stod navnet som "læses" for evigt, og ingen prøvede ingredienserne igen. Energi- og indholdsfotoene blev kun gemt, hvis OpenAI nåede at svare.
- Nu gemmes alle fotos (forside, energi, indhold) og telefonens OCR-tekst ved oprettelsen i `quick_enrichment_jobs` (migration `20261002070000_quick_enrichment_jobs`).
- Nyt app-job "Ny vare: genoptag aflæsning" (`quick-enrichment-recovery`, hvert 2. minut, `src/lib/quick-enrichment-jobs.ts`):
  - genoptager kun de dele, der stadig står i `pendingFields`, når aflæsningen har stået stille i 10 min,
  - opgiver efter 3 forsøg og rydder de ventende felter, så siden ikke venter for evigt (fejl i admin "Log"),
  - prøver ingredienslisten igen, når den ikke blev fundet: ét foto pr. kørsel, stregkodefotoet først (på glas sidder stregkoden tit ved listen), så energifotoet, så samme foto igen. Højst 3 ekstra OpenAI-kald pr. vare. Overskriver aldrig en liste, som nogen har udfyldt imens,
  - adopterer varer fra de sidste 14 dage uden job ud fra de fotos, AI-analyserne gemte (så varer fra før ændringen også bliver rettet).

## 2026-09-27: Tilføj → kamera med fire knapper og "opret straks"

- Tilføj → Kamera (`/camera?mode=product`, `src/components/camera/ProductCaptureFlow.tsx`) har fire knapper under kameraet: Stregkode, Forside, Energi, Indhold. Kameraet starter altid på stregkoden (live-overlayet). Kendt stregkode → `/add/[id]`. Ukendt → forside → energi → indhold. `/camera/create` omdirigerer hertil.
- Hvert foto får et semitransparent hvidt overlay med forsidens load-cirkel (`HfLoader`), mens den lokale OCR kører; knappen får flueben, når trinnet er klaret. Finder lokal OCR ingredienslisten på energifotoet, får Energi og Indhold begge flueben.
- Så snart OCR er kørt på alle trin, oprettes varen (`POST /api/products/quick`, PENDING, forsidefotoet "as is" som billede), og skærmen går til `/add/[id]`. OpenAI læser forside/næring/ingredienser bagefter på serveren (`after()` → `src/lib/quick-product-enrichment.ts`, genbruger `src/lib/product-photo-analysis.ts`). Felter der stadig læses står i `Product.pendingFields` og vises med en grøn load-cirkel; siden poller indtil de er klar.
- Registreringer lavet mens næringen læses, får et foreløbigt snapshot, som genberegnes når næringen er aflæst (varen er minutter gammel, så alle dens registreringer stammer fra den periode).
- Den fritlagte forside (`pendingImageUrl`) vises med det samme for den, der oprettede varen; for andre stadig først efter admin-godkendelse.
- Søgeresultater: hele linjen åbner varen, ikke kun Tilføj-knappen.

## 2026-09-27: Lokal OCR først, sprogsignaler og lokal billedredigering; én forside-prompt

- Lokal OCR-tekst (tesseract.js) sendes kun med som støtte til AI'en og
  bruges kun som reserve, når den er læsbar (`usableOcrText`: sikkerhed
  ≥ 72 % og mindst 4 tegn). Ulæselig tekst må aldrig ende i et felt.
- `parseNutritionText` accepterer kun tal, der hænger sammen (fedt×9 +
  kulhydrat×4 + protein×4 inden for 20 % af kcal); ellers overtager AI.
  Et "g" læst som ciffer fjernes kun, når tallet ellers bryder EU's
  afrundingsregler (flere end én decimal for makroer, eller over 100 g).
- Forsidens prompt, skema og version ligger ét sted
  (`src/lib/product-ai-tasks.ts`) og bruges af både ruten og den natlige
  genkørsel.
- **Dispensationen fra 2026-09-17 er rullet tilbage for energi og indhold**
  (brugerens valg 2026-09-27: "lokal først + ét samlet kald"). I "opret
  straks"-flowet afgør serveren ud fra telefonens OCR-tekst (aldrig
  klientens egne tal), hvad der kan bruges uden OpenAI. Næring kræver alle
  fire hovedtal + plausibilitetstjek. Ingredienser kræver en tydelig
  "Ingredienser:"-sektion og OCR-sikkerhed ≥ 85 %, fordi der intet tjek er
  for en fejlstavet ingrediens. Resten læser OpenAI, i ét samlet kald når
  begge står på samme foto (`label-v1-2026-09-27`). Forsiden (logo, navn,
  bokse) læses stadig af OpenAI.
- **Sprogsignaler (ændrer 2026-09-12-reglen)**: brugeren besluttede, at
  telefonens sprog og appens sprog nu også bruges — som svage signaler
  EFTER region og stregkode, aldrig alene. Telefonens land tages fra
  tidszonen, så appen aldrig spørger om eller ser en præcis position.
  Talegenkendelsen følger stadig kun regionen.
- **Grænsehandel i Danmark** (brugerens viden 2026-09-27): svenske varer
  (mest Sjælland) og tyske varer (mest Jylland) scannes jævnligt. Svensk og
  tysk er derfor faste sekundære sprog for regionen DK i AI-prompten
  (`CROSS_BORDER_REGIONS` i `src/lib/regions.ts`), med en linje om
  grænsehandlen. Lokal OCR får dem kun, når stregkoden selv peger dertil
  (GS1 73 = svensk, 40-44 = tysk), fordi hvert ekstra tesseract-sprog gør
  den markant langsommere. Landsdelen bruges ikke: appen kender hverken
  postnummer eller præcis position.
- **Produktbilleder redigeres kun lokalt**: udretning af skrå sider og
  lysning sker i image-agent på originalfotoet. OpenAI's billedmodeller
  bruges ikke til det, fordi de ændrer format og kan ændre logoet
  (benchmark 2026-09-18: 3:4-fotos kom tilbage som 2:3, 1:1, 4:3, 16:9 og
  8:3).
## 2026-09-27: Bundark er standard for alle screen-overlays/popups

Brugerens krav (2026-09-27, med skærmbillede af HelloFresh' "Velkommen til
Discover"): "når jeg omtaler screen-overlay eller popup, åbner det i dette type
vindue". Reglen står i KRAV.md "Bundark".

- Ny komponent `BottomSheet` (`src/components/hf/BottomSheet.tsx`) med fast
  klasse `.hf-bottom-sheet`. Portal til body, z-index 200. Træk: touch på hele
  arket (indhold kun når det er scrollet helt op), mus kun på stregen. Lukker
  ved fart > 0,5 px/ms eller træk > 30 % af højden.
- Taget i brug: `WelcomeSheet` (erstatter prototype-spotlighten
  `OnboardingSpotlight`, samme localStorage-nøgle), `OnboardingWizard`,
  admin-guidebyggerens `GuideOverlay`, `EmailVerifySheet` (erstatter bjælken
  `EmailVerifyBanner`), `AddMenuSheet` (kalenderens "Tilføj" og hjulets
  "Se alle" — /add/menu findes kun som direkte link) og `AddProductView` i
  ark fra søgelistens "Tilføj" (/add/[id] er stadig egen side fra andre
  indgange).
- Fuldskærms-overlay (opstartstips) og dialog på scrim er uændrede, men nye
  overlays/popups bygges som bundark.
- Radius 16 px foroven er en bevidst undtagelse fra radiusfamilien (design.md
  §6.13), målt på referencebilledet.

## 2026-09-26: EN fast designregel for skrift, farver og knapper

Brugerens krav (2026-09-26, med skærmbillede af Points-siden): "Du arbejder
altid på lappeløsninger og fragmenteret på side til side … lav EN FAST
designregel med faste klasser", og det samme for knapper, farver og
tekstfarver. Revisionen fandt 21 forskellige skriftstørrelser, 5 vægte, to
parallelle grå/beige paletter, ~400 steder med grå tekst lavet via
`opacity-*` og ~200 knapper uden knapklasse.

- **Skrift**: kun 6 størrelser (32 · 22 · 17 · 15 · 13 · 11 px) og 2 vægte
  (400 · 700), som `.hf-type-*`-roller i `globals.css` (`@layer components`)
  og design.md §4.2. Brødtekst er 15 px (var 17). Klasserne sætter kun skrift,
  aldrig farve/justering. Alle ad-hoc `text-[Npx]`, `text-sm`, `font-semibold`
  osv. er migreret automatisk efter størrelse (≤11 → micro, 12–13 → small,
  14–16 → body, 17–20 → title/body-lg, 22–26 → page-title, ≥28 → hero).
- **Farver**: én palette (design.md §3 "Faste tekst- og fladefarver"). De gamle
  generiske tokens peger nu på HelloFresh-værdierne. Grå tekst via opacity er
  erstattet af `text-text-secondary`/`text-text-muted`; Tailwind-
  standardfarver og hex er erstattet af tokens.
- **Knapper**: seks klasser — `.hf-btn-primary`, `-secondary`, `-danger`,
  `-text`, `-icon` og `.hf-choice` — med indbygget skrift (design.md §6.2).
  Grønne handlingsknapper (bl.a. admin, stemme-siden) er nu sorte primære.
  Rækker, valgkort, fliser, kalenderceller og overlays er bevidst ikke knapper.
- Foreslået `.hf-button`-system i design.md §6.2 er erstattet af ovenstående.
## 2026-09-27: Guide-builder til startup-guide og tooltips

- Startup-guiden og tooltips bygges i admin (`/admin/guide-builder`) og
  gemmes som saniteret JSON i `GuideDesign` (én række pr. slags:
  `startup`, `tooltips`). Serveren accepterer kun faste baggrunde fra
  design.md §3 og tekstroller fra §4.2 — ingen frie farver/fontstørrelser.
- Builder-flow: baggrund trækkes ind først, derefter fonte/elementer.
  Et farvetema er et eksplicit baggrundsvalg for alle skærme.
- Startup-guidens bund er altid Tilbage (outline) + Næste (sort) og "Spørg mig
  senere" (sort tekst, centreret) under knapperne. Tooltips har fast
  billedfelt (280×210, 8 px radius, ikke rundt), prikker + pile med antal,
  Videre + "Spring over". Intet flag/sprogvælger i nogen af dem.
- Billedet har fast højde/dimension (startup 402×226 fuldbredde); et nyt
  billede beskæres (object-cover) og ændrer aldrig layoutet. Uploads
  nedskaleres i browseren til en lille data-URL (< 400 kB).
- Begge vises i det fælles fuldskærms-overlay (samme skal som
  StartupTipOverlay). Kobling til brugerens app-flow er en separat opgave.
## 2026-09-27: Umami-analyse (admin → Analyse)

- Besøgsstatistik laves med selv-hostet Umami (v3, image fastlåst til
  `3.4.0` via `UMAMI_TAG`) — brugerens valg frem for Plausible/PostHog/Matomo.
- Umami kører i `compose.production.yaml` på det interne backend-netværk med
  egen database `umami` i den eksisterende PostgreSQL (oprettes af
  `umami-db-init`). Ingen port, intet Cloudflare-hostnavn.
- Browserne når Umami via appens egne stier: `/umami/script.js` og
  `/umami/api/send` (route handlers, der sender videre). Kun disse to stier
  er udstillet — Umamis login/UI er ikke.
- Websitet har et fast id (`src/lib/umami-config.ts`); appen opretter det selv
  i Umami første gang, så intet skal sættes op i hånden.
- Kun den brugerrettede app spores (hellocal.io + gammel packroff-adresse), ikke
  admin, Oprettelses-appen eller localhost. Forespørgselsstrenge og #-dele
  sendes ikke med (fx nulstillingslinks).
- Admin → Analyse (`/admin/analytics`, øverst i menuen under Oversigt) henter
  tallene server-side via Umamis API med Umamis admin-login
  (`UMAMI_USERNAME`/`UMAMI_PASSWORD`, standard admin/umami).
- Privatlivspolitikken §8 nævner Umami (ingen cookies, ingen tredjepart).

## 2026-09-27: Skelet-loading i stedet for "Henter…"

- Alle brugerrettede sider viser en skitse af indholdet med løbende gradient,
  mens data hentes (HelloFresh "Opdag"-mønster, design.md §6.14). Ingen
  "Henter…"/"Indlæser…"-tekster som loading-tilstand.
- Fælles ur for animationen; gradienten er relativ til boksens bredde.
- Nye sider skal bruge `src/components/hf/Skeleton.tsx` eller `LoadingScope`.
- Admin-sider og forsidens drejehjul er ikke omfattet.
- 2026-09-28: Sider med eget layout tegner skelettet i deres rigtige
  struktur (tom model + flade pr. datafelt), ikke med et generisk mønster —
  så skelettet følger layoutet automatisk (design.md §6.14 "Strategi").
  Produktsiden (`AddProductView`) er første side omlagt.
## 2026-09-27: Admin-menuens grupper + agenter, jobs, roadmap og Claude-MCP

Erstatter gruppelisten i punktet nedenfor (skallen er uændret).

- Brugerens menu: Oversigt · Produktgodkendelse (Kvalitetskontrol,
  Uncertainties, Dobbeltoprettelser, Ønskede ingredienser, Billedforslag +
  Nye produkter, Logoer) · Produktdatabase (`/admin/search`) · Brugere (Alle
  brugere, Fejlrapporter, Beskeder = supportindbakken) · Partnere ·
  Administration (Scan-invites, Jobs, Agenter) · Indstillinger (API-nøgler,
  Cronjobs, Passkeys, Standard-mails = svarskabeloner, Besked automatisering,
  Søgealgoritmer) · Design og opbygning (Designmanual, Sidetræ) · Roadmap og
  udvikling (Roadmap, Claude-integration). Kun det længste sti-match er aktivt.
- "Agenter" = AI-agenter (fx Claude), ikke Oprettelses-appens medarbejdere
  (de ligger under Scan-invites). Hver agent har et token; kun sha256 gemmes
  (`AiAgent`), og adressen vises én gang. "Jobs" = `AgentJob`, som agenter
  registrerer; siden har fanerne Åbne/Afsluttede.
- Roadmap (`RoadmapItem`) er en tavle: Idéer/Planlagt/I gang/Færdig.
- Claude-integration: stateless MCP-server på `/api/mcp/<agent-token>` (JSON,
  ingen SSE). Kan kun læse/oprette roadmap-punkter og jobs. Tilføjes som
  custom connector i Claude.ai eller med `claude mcp add --transport http`.
  Skal nås på den offentlige adresse (`APP_BASE_URL`), fordi admin-
  hostnavnet omskriver alle stier til /admin.
- Partnere: kun menupunkt + tom side; indholdet er ikke specificeret.

## 2026-09-27: Brugerens billeder bruges som PNG — aldrig omtegnet som SVG

- Når brugeren leverer et billede (PNG) til et ikon eller en illustration,
  bruges præcis det billede: skaleret (typisk 256 px for ikoner, beskåret til
  tegningen) og gengivet som CSS-maske, når det skal følge tekstfarven.
- Billedet må ikke spores, omtegnes som SVG eller "forbedres". Brugeren
  afviste SVG-udgaverne fra 25/9 (badevægt, gryde, champagne, taljemål) og
  bad om de originale PNG'er tilbage.
- Ønskes en anden gengivelse (f.eks. vektor), spørges brugeren først.

## 2026-09-27: Admin-sidebjælke i fuld højde og widget-oversigt

- Ændrer punktet "fast topbar" nedenfor: logo + "Admin" og "Gå til…"-søgningen
  ligger øverst i venstre kolonne, som går i ét stykke fra top til bund (ingen
  vandret streg gennem kolonnen). Topbaren ligger kun over indholdet og viser
  brødkrummer (også "Admin / Oversigt") og brugermenuen. Mobil uændret: skuffe
  (nu med søgefelt øverst) + logo i topbaren.
- `/admin` (Oversigt) er widgets: 4 tællerkasser på række (ubesvarede
  supportbeskeder med "over 24 timer", nye produkter, Usikkerheder med
  "haster", fejlrapporter), alle med link til siden, hvor opgaven løses.
  Derunder større bokse: seneste beskeder fra brugere (6 åbne sager med
  uddrag af brugerens seneste besked), seneste produkter til godkendelse,
  seneste fejlrapporter og "Øvrige opgaver" (billedforslag, logoer,
  kvalitetskontrol, dubletter, ønskede ingredienser med tal).
- Udvidet 2026-09-28 (komplet overblik): "Øvrige opgaver" har også
  scan-indsendelser og ulæste scan-beskeder. Nye bokse: "Produkter med lav
  sikkerhed" (antal pr. fane, skjult i søgning under 50 %, de mest usikre),
  "Drift" (fejlede/køede mails og push, cron-jobs med fejl, tjenester uden
  API-nøgle), "Cron-jobs" (status pr. job + mislykkede beskeder seneste 7
  dage) og "Nøgletal" (brugere, nye brugere, registreringer i dag, godkendte
  produkter, sendte beskeder). Rødt tal = haster.

## 2026-09-27: Designmanualens typografi- og knaptabeller beskriver forlægget

- Admin → Designmanual, sektion 4 (Knapper) og 5 (Teksttyper og fonte), viser
  HelloFresh-appen som forlæg, ikke Hello Cals nuværende klasser — brugerens
  valg, fordi de to endnu ikke ligner hinanden. Hver række har en lille
  "Hello Cal i dag"-note, så afvigelsen er synlig.
- Værdierne er egne pixelmålinger på de 28 app-skærmbilleder i
  `Hello Fresh inspiration/` (1206 px = 3×). ChatGPT-analyser er kun brugt som
  hypoteser; flere af deres tal var forkerte (fx "afrundet" skrift, #056B3D,
  #666666, 9–11 px vilkår, rund filterknap).
- Forlægget: display-skrift (tæt, fed grotesk, sandsynligvis Agrandir) til
  overskrifter og Roboto til resten. Prøverne vises med Roboto og Roboto
  Condensed via `next/font` (kun i designmanualen).
- 6-størrelses-typografien fra 2026-09-26 (gren `claude/typography-system`)
  er stadig ikke live og er ikke rørt her.

## 2026-09-27: Admin-skal efter Cloudflare-dashboardets struktur

- Kun struktur/opbygning fra Cloudflare — farverne er fortsat Hello Cals tokens.
- Fast topbar: menuknap (mobil), logo + "Admin", "Gå til…"-søgning (Ctrl/Cmd+K,
  springer til enhver admin-side), brugermenu (e-mail, DA/EN, Log ud).
- Venstre sidebjælke med ikoner og sammenfoldelige grupper: Oversigt ·
  Produkter (nye produkter, billedforslag, logoer, kvalitetskontrol,
  Uncertainties, dobbeltoprettelser, ønskede ingredienser) · Brugere & support
  (brugere, support, fejlrapporter, besked automatisering, scan-invites) ·
  Søgning (søg, søgealgoritmer) · Sikkerhed (passkeys, API-nøgler) ·
  System (cron-jobs, designmanual). Gruppen med den aktive side åbnes automatisk; åbne
  grupper og sammenklappet ikon-skinne huskes i localStorage.
- Brødkrummer (Admin / gruppe / side) over indholdet; indholdsbredde max-w-6xl.
- Under lg: sidebjælken er en skuffe fra venstre bag menuknappen; søgning
  som ikon. Support-tæller og Uncertainties-prik vises i menuen (prik på
  gruppen, når den er lukket).
- Login/opsætning/bekræftelse vises uden skal. Komponent: `src/components/admin/AdminShell.tsx`
  (erstatter AdminNav).

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
- Brugerens valg 2026-09-26: samtalen foregår i appen, ikke på mail.
  `SUPPORT_REPLY` er derfor kun push + indbakke (ingen mail); brugeren får
  en kvitteringsmail med sagsnummer (`SUPPORT_RECEIVED`), når sagen oprettes.
- Startprioritet efter kategori: Abonnement/betaling og Konto/login = Høj,
  Fejl/Mine data/Produkter = Normal, Andet = Lav. Admin kan ændre den.
- Brugeren kan vedhæfte op til 3 skærmbilleder pr. besked. De skaleres til
  maks. 1600 px JPEG i telefonen, typen tjekkes på serveren ud fra filens
  bytes, EXIF fjernes, og de gemmes i databasen (`SupportAttachment`) —
  aldrig under /public. Kun ejeren og admin kan hente dem.
- Svarskabeloner (`SupportReplyTemplate`) på `/admin/support/templates`;
  `{{navn}}` erstattes med brugerens navn ved indsættelse.
- Admin-menuen viser "Support (n)" med antal ubesvarede sager (rød ved
  sager over 24 timer).
- 24-timers-advarslen sendes én gang pr. ubesvaret besked (brugerens valg).

## 2026-09-26: Redigering af målsætninger

- En målsætning kan redigeres (dato og targets) via `PATCH /api/goals/[id]`, kun for Seriøs (samme gating som delmål).
- Uændrede targets beholder startværdi og gennemført-status. Et target med ny værdi regnes som et nyt mål: ny startværdi (seneste måling), ny retning og nulstillet `completedAt`. Fjernede targets slettes.
- `User.targetWeightKg` opdateres kun, hvis den redigerede målsætning er den nyeste med et vægtmål.
- Målsætninger kan indeholde daglige ernæringsmål (target-typerne `kcal`, `proteinG`, `carbsG`, `fatG`; ingen migration, `GoalTarget.type` er fri tekst). De er rettesnore og markeres aldrig som nået; kun vægt og kropsmål afgør, om en målsætning er nået.

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
## 2026-09-26: Redigering af målsætninger

- En målsætning kan redigeres (dato og targets) via `PATCH /api/goals/[id]`, kun for Seriøs (samme gating som delmål).
- Uændrede targets beholder startværdi og gennemført-status. Et target med ny værdi regnes som et nyt mål: ny startværdi (seneste måling), ny retning og nulstillet `completedAt`. Fjernede targets slettes.
- `User.targetWeightKg` opdateres kun, hvis den redigerede målsætning er den nyeste med et vægtmål.
- Målsætninger kan indeholde daglige ernæringsmål (target-typerne `kcal`, `proteinG`, `carbsG`, `fatG`; ingen migration, `GoalTarget.type` er fri tekst). De er rettesnore og markeres aldrig som nået; kun vægt og kropsmål afgør, om en målsætning er nået.

## 2026-09-26: Oplevelse af søvn

- Ny række under Indstillinger → Visning: "Oplevelse af søvn"
  (`/settings/display/sleep-quality`). `User.sleepQualityPromptEnabled`,
  slået TIL som standard (bevidst undtagelse fra "vis aldrig som standard").
- Første app-åbning hver dag (logget ind, samtykke givet, ingen vurdering
  for i dag) viser et cremefarvet fuldskærms-overlay: "Hvordan oplever du at
  din nat har været?" med store, understregede 1–5. Tryk → animeret cirkel →
  overlayet lukker. "Luk" øverst til højre, "Slå fra" nederst til højre,
  info-ikon nederst til venstre med forklaring i gråt felt.
  "Vist i dag" huskes pr. enhed (localStorage), så lukning ikke spørger igen.
- Én vurdering pr. dato (datoen man vågnede) i `SleepQualityEntry`
  (`/api/sleep-quality`). Vises som sort bjælke med hvid tekst øverst i
  kalenderens dagvisning, og som graf "Søvnkvalitet og kalorier" øverst på
  Statistik. Senere: sammenhæng med kalorieindtag/kostomlægning.

## 2026-09-26: Kropsmål med brugerens tegninger + halsmål

Kropsmål vises som ét kort pr. mål (Statistik-kortenes stil): brugerens egne
tegninger (`Icons/Kropsmål`, kopieret uændret til `public/body-measurements`)
til venstre, titel + felt til højre. Tegningen vælges ud fra `User.sex`;
uden valgt køn gættes der ikke (kort uden tegning + hint om at vælge køn).
Brugeren valgte at få Hals med: nyt valgfrit felt `BodyMeasurement.neckCm`
(migration `20260926090000_body_measurement_neck`). Hofte har ingen tegning
og vises uden billede. Listen i `src/lib/body-measurements.ts` er fortsat
eneste kilde, så Hals også kan bruges som målsætning.

## 2026-09-25: Familieabonnement og børneprofiler

Brugerens valg efter research (detaljer, kilder og åbne spørgsmål i
`docs/FAMILY.md`). **Omstøder** `docs/SPECIFICATION.md` §3 "Én profil pr.
konto. Ingen husstands-/familieprofiler … ingen forældrekontrol".

- Familieabonnement er altid betalt; familieprofiler ser aldrig reklamer eller
  partnertilbud.
- Betaleren opsætter familien og bestemmer, hvem der må se og taste ind for et
  bestemt medlem. Betaleren har adgang til alle familiens profiler.
- Under 15 år kan man ikke selv oprette en konto; en forælder opretter
  profilen. Barnet kan få eget login via en engangskode.
- Barnet kan melde sig ud og låse de andre ude (fortolket: fra 15 år).
- Barnet ser samme visning som voksne.
- Alt, hvad andre gør på en profil (åbner, ser, tilføjer, ændrer, sletter),
  logges og vises for profilens ejer, både som liste og i et panel, der glider
  ned fra toppen ved nye hændelser.
- Kun dagbogsdata følger den valgte profil. Login, adgangskode, abonnement,
  integrationer og familieopsætning hører altid til den, der er logget ind.
- (2026-09-26) "Skift profil" øverst på Profil med overlappende
  initialcirkler; "Kopier til konto" ved swipe fra venstre på egne
  indtastninger, når man styrer en anden profil; blåt telefonikon med
  initialer til venstre for profilcirklen og 1 px blå ramme rundt om skærmen,
  mens en anden er på kontoen (ny token `--hf-color-watch: #2f80ed`);
  "Kontrol-log" under Indstillinger på den kontrollerede konto.
- (2026-09-26, senere) Børneberegning under 18 år (Schofield + EFSA-PAL,
  intet voksengulv), 179 kr./md. for op til 5 profiler, sletteret pr. profil
  styret af profilens opretter (børn starter med nej), og fælles måltid med
  portion pr. person. Detaljer i `docs/FAMILY.md` "Afklaret 2026-09-26".
- (2026-09-26) Betaleren kan slette en profil uden login ("slet alt"). Slettes
  betalerens konto, opløses familien, og alle beholder deres egne data. Alder
  ved tilmelding løses i et kommende oprettelsesflow.

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
## 2026-09-25: Mængde-robot — slideren starter på den mest sandsynlige mængde

Brugerens krav: robotten skal regne ud, hvilken mængde folk typisk vælger af
en vare (fx agurk spist rå eller lagt i en opskrift), så mængde-slideren på
`/add/[id]` ikke starter på 100 g, og det må ikke være et råt gennemsnit.
Robotten skal kunne styres fra admins robotpanel.

- Ny container `amount-suggestion-agent` (`scripts/amount-suggestion-agent`,
  ren Python + SQL, ingen AI, ingen netværk ud). Den skriver
  `amount_suggestions` og læser/skriver `robot_configs` (key
  `amount-suggestion`). Den tabel er fælles for fremtidige robotter.
- To kontekster regnes hver for sig: `EATEN` (registreringer) og `RECIPE`
  (`dish_ingredients`). `/add/[id]?for=ret` bruger `RECIPE`.
- Metoden: tidsvægt (halveringstid), loft pr. bruger, trimning af
  yderpunkter, typetal via vægtet KDE på log-skala (kandidater = faktisk
  valgte mængder), trukket mod kategoriens median ved få data og en
  confidence ud fra effektivt antal valg og hvor samlet valgene ligger.
- App'en (`src/lib/amount-suggestion.ts`) blander robottens tal med
  brugerens egne seneste valg (vægtet median, log-skala, egen vægt
  n/(n+personalWeight)), afrunder til pæne tal (1/5/10/50 g) eller hele
  portioner og bruger kategoriens tal, når varen ikke har sit eget.
  Uden data starter slideren som før. Robottens svar overskriver aldrig en
  mængde, brugeren allerede har ændret.
- Anonymitet: et fælles forslag gemmes kun, når mindst `minUsers` (standard 3)
  forskellige brugere står bag. Der gemmes kun aggregater, og private
  ingredienser er udeladt.
- `/admin/robots` ("Robotter"): til/fra, "Brug forslagene i app'en", alle
  parametre med grænser (`src/lib/amount-suggestion-config.ts`, samme tal
  i agentens `LIMITS`), "Kør nu" (virker også når robotten er slået fra),
  status/heartbeat, test af forslag for vare + bruger og top-40-liste.
- Deploy-trinnet for robotten kører med `if: !cancelled()`, så det ikke
  blokeres af de andre agent-trin.

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

## 2026-09-26: Målsætning-oversigt som liste af delmål med egen side

`/profile/goals` viser nu hver målsætning som en blok (som kalenderens
dagsliste): kalender-firkant til venstre med måldatoen (dag + måned, grøn når
alle targets er nået), i midten hvad målet indebærer, pil til højre. Klik
åbner den unikke side `/profile/goals/[id]` (API `GET /api/goals/[id]`, kun
egne mål). Øverst en omridsknap "+ Opret nyt delmål" (`hf-btn-secondary`, ingen
fyldfarve); formularen har dato-vælgeren øverst.

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

## 2026-09-26: Tooltips og start-up tips (Indstillinger → Visning)

- To vippekontakter under Visning: "Vis tooltips" (små hjælpetekster via `HelpTip`, `src/components/hf/HelpTip.tsx`) og "Vis start-up tips". Begge er slået til som standard og gemmes pr. enhed i localStorage (`src/lib/help-prefs.ts`), samme mønster som Kalendervisning.
- Start-up tips er 1-sides overlays med én fast standard (`StartupTipOverlay`): "Luk" øverst til højre, ikon + titel + tekst, evt. én stor knap, og "Slå fra" nederst til højre (slår alle start-up tips fra). Højst ét tip pr. besøg, kun for indloggede brugere med samtykke, aldrig på login-, samtykke-, juridiske eller admin-sider (`StartupTipsGate` i root layout).
- Tips står i `STARTUP_TIPS` (`src/lib/startup-tips.ts`) og vises i rækkefølge. Et tip er færdigt, når det lukkes, eller når funktionen bruges (`markStartupTipSeen(id)` kaldes fra funktionens egen kode). Første tip er altid "Dine data er dine" med "Læs mere" til `/privatlivspolitik`.

## 2026-09-26: Gratis vs. Seriøs — hvad er låst, og egne abonnementssider

- Gratis viser nu rullende 3 måneders historik (`FREE_TIER_RETENTION_DAYS = 90`, før 30). Stadig kun en forespørgselsgrænse — intet slettes.
- Kun for Seriøs: hele statistikmodulet (`/statistics/**`, inkl. omarrangering af kort), fotodagbogen, omarrangering af ikonerne i bundmenuen (langt tryk åbner ikke redigering for Gratis), visningsindstillingerne under `/settings/display/**`, allergen-/resultatvisning (`/profile/settings/results`; `GET /api/profile` returnerer `showAllergens: false` for Gratis), sortering/filtre og HelloFresh under Opskrifter → delte retter, og alle integrationer (`/settings/integrations` + `connect` afviser Gratis med 403).
- Målsætning: Gratis har én målsætning i alt (målvægten) og ingen delmål — `/profile/goals/new` er låst, og `POST /api/goals` afviser Gratis med 403 (`PREMIUM_REQUIRED`).
- Låste sider låses via en route-`layout.tsx` med `PremiumGate` (`src/components/PremiumGate.tsx`), så selve siden ikke renderes; klienten læser niveau via `useSubscriptionTier()` (`src/lib/use-subscription-tier.ts`). Serveren håndhæver, hvor data ellers kunne hentes/skrives udenom.
- Seriøs og Seriøs Familie har hver deres side, `/profile/subscription/serious` og `/profile/subscription/family`, med tre vandrette periodebokse: 1 måned, 3 måneder, 1 år. Priser (samlet pr. periode) i `SUBSCRIPTION_PRICES_DKK` (`src/lib/subscription-plans.ts`, Prisma-fri så klienten kan bruge den): Seriøs 119/299/1071 kr., Familie 179/449/1611 kr.; et helt år giver 25 % rabat mod 12 enkeltmåneder (ejerens valg). Seriøs Familie dækker op til 5 personer (familiemodellen: docs/FAMILY.md). Købsknappen kalder MobilePay-aftalen (`POST /api/payments/mobilepay/agreement`, bygget af MobilePay-sessionen) og er lukket, indtil `mobilePayAvailable` er sand.
- Familien (profiler, børn, adgang og invitation) er bygget efter docs/FAMILY.md; købet af Seriøs Familie sætter `Subscription.plan = FAMILY`.
- Seriøs og Seriøs Familie har hver deres side, `/profile/subscription/serious` og `/profile/subscription/family`, med tre vandrette periodebokse: 1 måned, 3 måneder, 1 år. Priser (samlet pr. periode) i `SUBSCRIPTION_PRICES_DKK` (`src/lib/subscription-plans.ts`, Prisma-fri så klienten kan bruge den): Seriøs 119/299/1071 kr., Familie 179/449/1611 kr.; et helt år giver 25 % rabat mod 12 enkeltmåneder (ejerens valg). Seriøs Familie dækker op til 5 personer, hver med egen konto. Købsknappen kalder MobilePay-aftalen (`POST /api/payments/mobilepay/agreement`, bygget af MobilePay-sessionen) og er lukket, indtil `mobilePayAvailable` er sand.
- Åbent: invitation/kobling af familiemedlemmer til Seriøs Familie er ikke bygget endnu; SPECIFICATION siger stadig "ingen husstandsprofiler" — hver person har egen konto.

## 2026-09-26: Opret vare — rækkefølge, samme-foto-flueben, logo-genkendelse og fritskrabning

- Kamera-flowet (`/camera/create`) er nu: stregkode → forside → energi (næring) → indhold (ingredienser). En række med fire bokse øverst viser trinnene; et trin, der er taget og aflæst korrekt, får flueben-overlay (`CaptureCheckOverlay`).
- Næring og ingredienser står ofte side om side. Energifotoet sendes derfor parallelt til både næring- og ingrediens-aflæsningen. Findes ingredienslisten (confidence ≥ 0,6), får begge bokse flueben, ingrediens-trinnet springes over, og begge AiProductAnalysis-rækker kobles til produktet. Opret-sidens 2×2-grid viser samme flueben (draftens `verified`); vælges et næringsfoto manuelt dér, finder lokal OCR (`findIngredientsSection`) også ingredienslisten.
- Logoets navn læses af OpenAI (logoer er ofte for kreative til almindelig OCR): forside-analysen returnerer `logoText`, `logoConfidence`, `logoBox` og `productBox` (prompt `front-v2-2026-09-26`). Navnet holdes op mod Brand-tabellen (`src/lib/brand-match.ts`: normaliseret navn + Levenshtein, match ≥ 0,85); et match giver databasens stavemåde, så der ikke opstår næsten-dubletter.
- Fritskrabning: forsidefotoet gemmes (`AiProductAnalysis.imageUrl`, nu også for FRONT), og der oprettes `ImageCutoutJob`s (BRAND_LOGO + PRODUCT_FRONT). Den eksisterende `scripts/image-agent` (rembg) beskærer efter boksen, fjerner baggrunden og gemmer PNG under `/product-images/cutouts` (hvert 15. sek.). Ingen ny container. OpenAI's billedredigering blev fravalgt: den kan ændre selve logoet.
- Produktets fritskrabede forside bliver `Product.pendingImageUrl` og venter på den eksisterende admin-godkendelse. Logoet bliver kun selv `Brand.logoUrl`, når brandet intet logo har, og både AI-sikkerhed og brand-match er ≥ 0,9. Ellers ligger det som logo-kandidat på brandet (til G5's admin-kø).

## 2026-09-26: MobilePay-betaling (Vipps MobilePay Recurring) + Opsætning delt op

- **Betaling kører via Vipps MobilePay Recurring API v3** (`src/lib/payments/`). Brugeren godkender en aftale i MobilePay-appen; Hello Cal gemmer kun aftale- og træk-id'er, aldrig kortdata. Aftalen oprettes med planens samlede pris og interval (1/3/12 mdr., `SUBSCRIPTION_PRICES_DKK`) — prisen slås altid op på serveren.
- Første periode trækkes straks (initialCharge). Kører der allerede en Seriøs-periode (gavekode/points/opsagt), trækkes først ved udløb.
- Fornyelse: den indbyggede scheduler (`runMobilePayTick`, hvert 15. min.) opretter næste træk 5 dage før udløb med forfald på udløbsdatoen (5 genforsøgsdage). Beløb/interval læses fra aftalen hos MobilePay. En gratis måned fra points bruges i stedet for et træk. Et træk, der endeligt fejler, stopper aftalen; Seriøs udløber med den betalte periode.
- `ACTIVE` har 6 dages henstand efter `currentPeriodEnd` (mens MobilePay trækker/genforsøger). `CANCELED` = opsagt, men Seriøs løber perioden ud.
- Status hentes altid fra MobilePay. Webhooks (registreres automatisk af serveren, hemmelighed krypteret i `payment_webhooks`) er kun et signal om at hente; scheduleren synker også uden webhooks.
- Nøgler: admin → API-nøgler → Betaling → MobilePay (`MOBILEPAY_CLIENT_ID`, `MOBILEPAY_CLIENT_SECRET`, `MOBILEPAY_SUBSCRIPTION_KEY`, `MOBILEPAY_MERCHANT_SERIAL_NUMBER`, valgfri `MOBILEPAY_ENV=test`). Uden nøgler er købsknappen lukket (`mobilePayAvailable`).
- Betalingssiden viser ingen "kommer snart"-tekster (ejerens krav). Visa/Apple Pay/Google Pay-logoer er fra simple-icons (CC0), MobilePay-ikonet fra Vipps MobilePays udviklerside (`public/payment/`).
- Opsætning (`/profile/settings`) er nu en oversigt med trin-baren og to undersider: "Sprog og region" (`/profile/settings/language-region`, også linket fra Indstillinger) og "Resultatvisning" (`/profile/settings/results`: allergener + udvidet næringsindhold).


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

## 2026-09-27: Admin "Page tree" — kort over alle sider

- `/admin/page-tree` viser samtlige sider i appen som et træ med pile fra side til underside, grupperet efter indgang (velkomst/login, forside/bundmenu, profil, indstillinger, links, oprettelses-app, admin).
- Træet er håndholdt i `src/lib/page-tree.ts` (danske navne + hvor man kommer ind). `src/lib/page-tree.test.mjs` fejler, hvis en `page.tsx` mangler eller står der to gange — ny side ⇒ tilføj den i træet.
- Statiske sider åbnes i ny fane; dynamiske (`[id]`, `[token]`) markeres "kræver id". Flueben "testet" gemmes kun i admins egen browser (localStorage), ikke i databasen.
## 2026-09-26: Hjemmeskærm-widgets — forberedt før den native app

Brugerens krav: seks widgets (plus-knap, hurtig-tilføj-række, swipebar
statistik-graf, 2×2 statistik-boks, tryk åbner Statistik, seneste
registreringer). Afklaret med brugeren:
- Appen bliver **helt native** på sigt (Swift/WidgetKit + Kotlin/Glance) —
  ikke en web-app i en app-skal.
- iPhone-widgets kan ikke swipes internt → statistik-grafen er **én widget pr.
  graf i en Smart Stack** på iPhone; Android swiper mellem graferne i én widget.
- iPhone har kun faste størrelser → "seneste registreringer" findes som
  **mellem (3) + stor (8)**; Android er frit justerbar i højden.
- Designet godkendes på en web-forhåndsvisning (`/widgets`) med rigtige data,
  før der lejes en Mac.
- Al widget-data kommer fra ét endpoint, `GET /api/widgets/snapshot`
  (enhedstoken eller login-cookie); widgetvalg (knapper, boks) gemmes lokalt
  på telefonen i widgettens egne indstillinger, ikke på serveren.
Se `docs/WIDGETS.md`.

## 2026-09-27: Domæne hellocal.io

- App: `hellocal.io`, admin: `admin.hellocal.io`, oprettelses-app: `scan.hellocal.io`. Kodens standardværdier og `.env.production.example` peger nu dertil.
- Gamle `*.packroff.dk`-hostnavne virker under overgangen (tunnel-ruter bevares, `middleware.ts` kender begge admin-hostnavne).
- Afsender: `no-reply@hellocal.io` (Mailjet). Kontakt i betingelser/privatlivspolitik: `support@hellocal.io`. Admin-notifikationer går fortsat til `ADMIN_NOTIFICATION_EMAIL`.

## 2026-09-27: Integrationssiden er iOS' Apple Health-adgangsark

Brugerens krav: hver integrations egen side skal være 100 % identisk med
Apple Health-adgangsarket (som HelloFresh viser), med alle Hello Cals punkter.
- `/settings/integrations/<app>` vises nu som `HfAccessSheet`
  (`src/components/hf/HfAccessSheet.tsx` + CSS Module): mørk baggrund, hvidt
  ark, titlen "Adgang til <app>", app-ikon, "“Hello Cal” vil gerne have adgang
  til og opdatere dine <app>-data", "Slå alle til/fra", grupperne "Tillad
  “Hello Cal” at skrive" (sendes fra Hello Cal) og "… at læse" (hentes) med
  Health-kategoriikoner og iOS 26-kontakter, "Appens forklaring", og faste
  knapper "Tillad"/"Tillad ikke" nederst.
- iOS-farverne (#007AFF, #34C759, #F2F2F7 m.fl.) er en bevidst undtagelse fra
  paletten og gælder kun dette ark.
- "Tillad" forbinder (eller forbinder igen), når adgangen mangler; en
  companion-app uden enhedskode får en; ellers lukker arket. Grå, når intet er
  slået til. "Tillad ikke" frakobler en forbundet cloud-app, ellers lukker
  arket. Tryk på den mørke kant øverst lukker.
- Status, "Synkroniser nu", "Frakobl" og enhedskoder ligger som ekstra grupper
  i samme stil. Valgene gemmes stadig med det samme; datatyperne er uændrede.
- Designmanualen har afsnit 9 "Adgangsark (integrationer)" med live eksempel.
## 2026-09-26: Fælles 48 px-højde på felter, dropdowns, knapper og rækker

- Brugerens beslutning: alle enkeltlinje-felter, dropdowns, madindtastninger,
  fuldbredde-knapper, listerækker og statistik-sektionsoverskrifter er 48 px
  (`--hf-control-height`), også på admin-siderne.
- Højden ejes af tre klasser i `globals.css` (uden for `@layer`, så de vinder
  over Tailwind): `.hf-field` (input/select/felt-wrapper), `.hf-control`
  (knap/link, fast højde) og `.hf-control-row` (række, min. 48 px, 8 px
  lodret padding). Sider må ikke sætte `h-*`/`py-*`/`min-h-*` ved siden af.
- Bevidst undtaget: footer, fliser, statistik-kort, ikonknapper (44 px), små
  filter-/periodeknapper og textarea. Hello Docs notched felt følger nu også
  48 px (før 60 px).


## 2026-09-27: HelloFresh-opskrifter vises som i HelloFresh-appen

- Brugerens krav: når man åbner en HelloFresh-opskrift for inspiration, skal den se præcis ud som i HelloFresh-appen (skærmbilleder i chatten 2026-09-27), bygget med fælles klasser. Det gælder KUN HelloFresh-opskrifter — brugerens egne og delte retter beholder deres eget design (`/profile/recipes/[id]`).
- Side: `/profile/recipes/hellofresh/[id]` (tidligere gik HelloFresh-rækker direkte til registrering `/add/[id]`). Klasser `.rv-*` i `src/components/recipe-view/recipe-view.css` + komponenterne i samme mappe.
- Data: ny kolonne `Product.recipeDetails` (JSON) fyldt af hellofresh-agenten med HelloFreshs egne værdier uændret (undertitel, beskrivelse, tid, sværhedsgrad, tags, allergen-navne, ingredienser med mængde/enhed i rækkefølge, trin, næringsværdier pr. portion). Tal vises som HelloFresh (punktum som decimaltegn). Rækker uden recipeDetails genhentes én gang; indtil da vises fallback fra de gamle kolonner.
- Knapper: "Gem" = favorit (samme tabel som delte retters favoritter, snapshot); kurv = del indkøbsliste via telefonens del-menu; printer = udskriv; "Markér som tilberedt" og "Tilføj i sundhedsapp" = registrér retten (`/add/[id]`), som også sender til tilkoblede sundhedsapps; "Lad os lave mad" folder Fremgangsmåde ud og scroller dertil; "Mine kogebogsbilleder" = egne fotos (ny tabel `recipe_cookbook_photos`, maks 12).
- Ingen bundnavigation på siden (som HelloFresh). Fuldbredde-knapper følger 48 px-reglen.

## 2026-09-27: Telefon-editor i admin og "Flows"

- Indhold der vises på telefonen (mails, notifikationer, svarskabeloner, flow-sider) redigeres i ét fælles vindue: `src/components/admin/PhonePreviewEditor.tsx`. Venstre halvdel: sort iPhone 17 i præcis 402 × 874 CSS-px (1206 × 2622 @3x), placeret i højre side af halvdelen; højre halvdel: redigering. HTML vises i en sandboxed iframe (ingen scripts), og `{{variabler}}` får eksempelværdier.
- Notifikationer vises som en låseskærm-notifikation med emnet som titel og teksten uden HTML.
- "Flows" er et hovedmenupunkt (gruppe) i admin. "Flow-sider" (`/admin/flows`) gemmer flows i `flows`/`flow_pages`; et flow gemmes altid samlet (`PUT /api/admin/flows/[id]`). Tooltip-popups (Guide-builderen, `/admin/guide-builder`) ligger i samme gruppe.


## 2026-09-27: "Vilkår og betingelser"-bjælke på startguide, abonnementer og integrationer

- Forbillede: HelloFreshs bestillingsflow. Nederst på skærmen står en bjælke med dokumentikon, fed "Vilkår og betingelser" og en 32 × 32 cirkulær pil-op-knap (design.md §6.7).
- Tryk åbner bundarket (KRAV.md "Bundark", ny størrelse `size="half"` = 50 % af skærmen) med scrollbar tekst og et fedt, sort, højrestillet link "Gå til vilkår og betingelser" nederst, som går til det relevante afsnit i `/betingelser#<anker>`.
- Samme komponent overalt: `src/components/hf/TermsSheet.tsx`. Teksterne ligger ét sted, `src/lib/terms-hints.ts`: unik tekst pr. startguide-trin, abonnementsoversigt, hvert abonnement (Seriøs, Seriøs Familie), points-indløsning og hver integration.
- Guide-builderen (`/admin/guide-builder`): hvert startup-trin har sin egen vilkårstekst (da/en) og sit eget afsnit i betingelserne (`GuideScreen.terms`), redigeres i kortet "Vilkår og betingelser" og vises som bjælke over Tilbage/Næste. Ældre opsætninger får en standardtekst. Tooltips har ingen bjælke.
- Integrationssiderne (iOS-adgangsarket) viser bjælken over "Tillad"/"Tillad ikke" via `HfAccessSheet`s `terms`-slot.
- Ligger bundark oven på hinanden (vilkårsarket over startguiden), lukker Escape kun det øverste.
- Betingelserne har fået ankre på alle afsnit og et nyt afsnit 7 "Forbindelser til andre apps og enheder" (`#integrationer`); de følgende afsnit er rykket ét nummer.

## 2026-09-27 Admin IP-spærre og glemt adgangskode

- `middleware.ts` tillader /admin og /api/admin kun fra LAN og `ADMIN_ALLOWED_IPS` (standard: hjemme-IP 213.80.120.167). Tom liste = ingen spærre. Login + 2-trins kræves stadig overalt.
- Admin har "Glemt adgangskode": mail-link (1 time) → ny adgangskode + ny authenticator-kode → logget ind.

## 2026-09-26: Fælles 48 px-højde på felter, dropdowns, knapper og rækker

- Brugerens beslutning: alle enkeltlinje-felter, dropdowns, madindtastninger,
  fuldbredde-knapper, listerækker og statistik-sektionsoverskrifter er 48 px
  (`--hf-control-height`), også på admin-siderne.
- Højden ejes af tre klasser i `globals.css` (uden for `@layer`, så de vinder
  over Tailwind): `.hf-field` (input/select/felt-wrapper), `.hf-control`
  (knap/link, fast højde) og `.hf-control-row` (række, min. 48 px, 8 px
  lodret padding). Sider må ikke sætte `h-*`/`py-*`/`min-h-*` ved siden af.
- Bevidst undtaget: footer, fliser, statistik-kort, ikonknapper (44 px), små
  filter-/periodeknapper og textarea. Hello Docs notched felt følger nu også
  48 px (før 60 px).
## 2026-09-27: Admin: Statistik

- Nyt hovedpunkt "Statistik" i admin (`/admin/statistics`): periode (i dag,
  denne uge, 7 dage, denne/sidste måned, 3/6/12 måneder, for evigt eller
  valgfri fra/til), land/region (lande + regioner som Skandinavien, DACH …)
  og abonnementstype (Alle/Gratis/Seriøs/Seriøs Familie) i URL'en. Alle
  ændringer sammenlignes med en lige så lang periode lige før. Dansk tid.
- Abonnementstype og land er brugerens *nuværende* værdi (`User.region`).
  "Betalende" = Seriøs med en betalingsudbyder (ACTIVE/CANCELED); gave-,
  points-, prøve- og familiemedlemsperioder vises separat.
- Nye tabeller: `login_events` (én række pr. gennemført login via
  `completeLogin`) og `search_misses` (produktsøgninger ≥ 3 tegn uden hit;
  kun søgetekst + region, intet bruger-id). Data findes kun fra 2026-09-27.
- "Aktiv" = har logget mindst ét produkt. Fastholdelse = nye brugere i
  perioden, der har logget ≥ 7/30 dage efter oprettelse.
- Trends beregnes gratis; "Analysér med AI" sender kun aggregater (ingen
  navne/e-mails/id'er, `store: false`) til OpenAI (`OPENAI_STATS_MODEL`,
  ellers produktmodellen). Kode: `src/lib/admin-stats*.ts`.

## 2026-09-28: Admin "Dubletter" — Produktbilleder og Produkter

- `/admin/duplicate-products` har to faner, der håndteres hver for sig:
  **Produktbilleder** og **Produkter**. Logik: `src/lib/duplicate-review.ts`,
  felter: `src/lib/duplicate-fields.ts`.
- Produktbilleder: varer med to eller flere billeder tagget `Import`
  (butiksimportens varianter EAN.png, EAN_2.png, .jpg + .png …) eller
  `Flettet` (flyttet over ved en fletning) vises på én linje. Admin vælger
  hovedbillede og fravælger resten; fravalgte billed-rækker slettes (filerne
  bliver liggende), og `products.imagesReviewedAt` sættes.
- Produkter: op til 6 kolonner side om side. Kildekolonner har grå ramme; den
  endelige er lysegrå med grøn ramme. Ud for hvert felt, hvor en kolonne har
  en værdi, der ikke står i den endelige, peger en grøn pil mod den endelige
  (→ eller ←); klik tager værdien over, "Fortryd" sætter den tilbage.
  Grupperne kommer fra: (1) Bilka + REMA 1000 med samme stregkode og
  forskellige felter — hver butiks egne data gemmes i den nye tabel
  `product_source_records`; (2) samtidige dobbeltoprettelser
  (`product_duplicate_links`); (3) samme navn + brand + mængde.
- Gem: butiks-konflikter skriver de valgte felter på produktet og markerer
  butiksdataene som gennemgået. Produkt-grupper fletter de øvrige ind i den
  endelige (registreringer beholder deres snapshot; stregkoder, butikker,
  favoritter og billeder flyttes med) og sletter dem. "Ikke dubletter" gemmes
  som `DISMISSED`-par, så gruppen ikke vender tilbage.
- Importen (`scripts/store-products-import`) overskriver ikke det, admin har
  gennemgået: produkter med gennemgåede butiksdata får ikke felter, næring og
  filtre overskrevet, og gennemgåede billeder røres ikke. Ændrer en butiks
  data sig, vises konflikten igen.
- Erstatter det tidligere par-kort (`DuplicateProductCard`) og ruterne
  `/api/admin/duplicate-products/[id]/merge|dismiss`.

## 2026-09-28 — Administratorer er altid Seriøs

Brugere med `role = ADMIN` behandles som Seriøs i `getUserSubscriptionTier` og `/api/subscription`, uden en Subscription-række, så alle Seriøs-funktioner kan testes. Ingen databaseændring.

## 2026-10-02 — Familie kun synlig for familieabonnenter; admin har familieabonnement

- `hasActiveFamilyPlan` (src/lib/family.ts) og `/api/subscription` (`plan`) giver `role = ADMIN` altid familieabonnement, uden Subscription-række, så alle familiefelter kan testes. Ingen databaseændring. Familien oprettes stadig med knappen "Opret familie".
- Indstillinger viser kun "Familie"-kortet, når brugeren har familieabonnement eller er med i en familie. Uden familieabonnement ligger indgangen til at indtaste en familiekode på Abonnement-siden ("Har du fået en kode?"). Købstilbuddet på Familieabonnement står uændret på Abonnement-siden.

## 2026-09-28: Samtykke på tilmeldingssiden i stedet for separat side

Brugerens opgave 35: det separate samtykke-step (`/samtykke`) fjernes. Samtykket
til helbredsoplysninger + accept af betingelserne gives på tilmeldingssiden
under e-mailfeltet med Hello Cals eget on/off-design (Toggle, jf. 2026-09-02:
ingen native checkboxe) og et klikbart link til Betingelser. Det kræves før
både e-mail- og social-tilmelding. Konsekvens: brugere, der logger ind via
Google/Apple/Facebook fra login-siden uden at have været forbi tilmeldingen,
eller ældre konti uden samtykke, bliver ikke længere stoppet af en gate.
## 2026-09-28 — Søvnspørgsmålets adfærd (punkt 34)

"Hvordan oplever du, at din nat har været?": ingen slider ved "Slå fra" — kun understreget tekst, der åbner Indstillinger → Visning → Oplevelse af søvn (`?focus=toggle`, grøn ring + fokus på kontakten). Grå infotekst under spørgsmålet følger "Vis tooltips". Store, ikke-understregede tal; valgt tal får grøn fyldt cirkel og hvidt tal, og Luk skjules. Efter 0,5 s glider popup'en ned til et lille bundark med håndtag (kan trækkes/trykkes op igen) og forsvinder kort efter.


## 2026-09-28 — Automatisk fotografering (punkt 15)

Foto-trinnene i kamera-flowet (forside, næring, ingredienser) udløser automatisk, når varen er i fokus: skarphed (Laplace-varians) i midterrammen skal være over et minimum og tæt på den bedste målte, og billedet skal være stillestående i 4 målinger i træk (200 ms interval, 1,2 s opstart pr. trin). Beregnes lokalt på et 160×160-udsnit (`src/lib/focus-detection.ts`, `useAutoCapture`). "Tag billede"-knappen bevares som manuel reserve. Stregkodetrinnet er uændret.
- 2026-09-28 (#34): Hvert E-nummer har en egen side `/e-numre/[code]`. Alternative
  troværdige kilder genereres ud fra E-nummeret (ingen ny DB-kolonne); den
  primære kilde forbliver `Additive.link`/`source`. Modalen er fortsat hurtigvisning.

## 2026-09-28 — Kamera: scanningsstribe i stedet for load-cirkel

Mens et foto arbejder i kameraflowet under Tilføj, vises en bred hvid/lys gradientstribe (`.hf-scan-sweep`), der fejer hen over billedet, i stedet for det hvide overlay med load-cirklen. Billedet forbliver synligt, så varen ser ud til at blive scannet.
## 2026-09-28 – Varesidens titel, certificeringer og "Branded"

- Varetitlen er venstrestillet, stor, fed og sort (`h1`); brand og pakningsstørrelse står under den med mindre grøn tekst.
- Certificeringer (Øko, Nøglehul, Fairtrade, MSC) udledes af varenavnet (`src/lib/product-certifications.ts`), fjernes fra titlen og vises som logoer på produktcirklen. Limefrugt-ikonet er fjernet; uden certificering står "Branded" i grønt, når varen har et brand.
- "Detaljer" hedder nu "Produktdetaljer" og ligger mellem mængdevalget og Tilføj-knappen.

## 2026-09-28: Samlet E-nummer-side

- `/e-numre` er den fælles side for alle E-numre, læst fra `additives`-tabellen.
  Hvert E-nummer har ankeret `eNumberAnchor()` (`src/lib/e-number-links.ts`):
  små bogstaver uden tegn, fx `#e330`, `#e101i`.
- Klik på et E-nummer fra en vare eller en indholdsfortegnelse går til siden i
  stedet for at åbne `AdditiveInfoModal` (komponenten står ubrugt tilbage).
- Forsknings- og alternative kildelinks er faste søge-/opslagslinks bygget ud
  fra nummer og navn; kun `link`/`source` kommer fra databasen.
## 2026-09-28: Redigering af en tilføjet registrering

- Et tryk på en tilføjet vare (`/registration/[id]`) åbner samme visning som
  "Tilføj produkt", så mængde, tidspunkt og energifordeling kan ændres og gemmes.
- Snapshot-semantik bevares: kcal og makroer pr. 100 g regnes ud fra
  registreringens egne snapshot-værdier, aldrig fra varens nuværende data.
  Øvrige snapshots (sukker, fibre, vitaminer, `nutrientSnapshot` osv.) skaleres
  forholdsmæssigt med den nye mængde. Varen selv ændres aldrig, og der oprettes
  ingen kontrolsag til admin ved redigering.
- Egne retter uden vare vises med en vare bygget af snapshottet.


## 2026-09-28: Billedrobotten kører løbende + admin "Robotter"

- Brugerregel: robotten der fritlægger og retter billeder til skal ikke kun
  køre om natten, men hele tiden vente på nye produkter. Fritlægningen
  (`scripts/image-agent/cutout.py`) er nu sit eget job `image-cutout` med
  planen "Løbende" (`intervalMinutes = 0`), tjekket hvert
  `CUTOUT_POLL_INTERVAL_SECONDS` (standard 15 s).
- "Løbende" er en ny plantype i `scheduled_jobs` (ingen migration): 0
  minutter = kør ved hvert tjek. Samme regel i `job_control.py` (alle kopier)
  og `src/lib/jobs/schedule.ts`.
- Logo-robotten (`scripts/logo-agent`) styres nu også af `job_control.py`
  (job `logo-agent`, standard 03:00), så den kan slås til/fra og køres fra admin.
- Ny admin-side `/admin/robots` ("Administration → Robotter"): tabel med alle
  robot-containere (runtime "agent") og kolonnerne Robot, On/Off, Kør,
  Cron-job (Løbende / dagligt kl. / interval / kun manuelt) og Sidst kørt.
  Samme rækker og API som "Cron-jobs".


## 2026-09-28 — Fælles selected state (punkt 46)

Valgte bokse, åbne accordions og andre selection-komponenter bruger HelloFresh-stilen:
lysegrøn baggrund, grøn stroke og mørkegrøn tekst via `.hf-selected` og tokens
`--hf-color-selected-*` i `globals.css`. Kraftigt grønne/sorte valgte flader er udfaset.
Admin-flader er ikke omfattet.



## 2026-09-28: Flere objekter i kameraet — brugeren vælger

- Ved flere mulige objekter i et taget foto markeres de med grønne cirkler,
  og brugeren trykker på det, der skal være fokus. Fotoet beskæres til det
  valgte objekt (15 % luft), før genkendelse/OCR kører. Gælder forsidefotoet
  (ikke stregkode, energi, indhold) og Måltid/HelloFresh. Detektionen er et
  AI-kald; fejler det, fortsættes med hele billedet.

## 2026-09-28: Mail-handlinger er sorte knapper, ikke links

Handlingen i en mail (nulstil adgangskode, bekræft e-mail, ændr startvægt)
vises som appens primære knap: sort `#232323`, hvid fed tekst, radius 8 px.
Skabeloner skriver `<a class="hc-button" href="…">Tekst</a>`, og
`wrapEmailHtml()` (src/lib/email-format.ts) gør den til en tabel-knap med
inline styles. Linjen "kopiér dette link" er fjernet; tekstversionen af
mailen har stadig linket. Uredigerede gamle standardtekster i databasen
erstattes automatisk (LEGACY_DEFAULT_BODIES i src/lib/messaging.ts).
## 2026-09-28 — Flaskevand i stedet for "Vand" (punkt 7)

Et produkt, hvis produkttype/navn starter med ordet "Vand" alene, hedder "Flaskevand" (`normalizeProductType`/`normalizeProductName` i `src/lib/product-naming.ts`, AI-forsideprompten og migration `20260928170000_flaskevand_product_names`). "Kildevand", "Danskvand" m.fl. er urørte, og søgning på "vand" finder stadig varerne. Registreringers snapshots ændres ikke.
## 2026-09-28 — Forsidens varebokse: brunlig flade frem for hvidt
Produktfotos i `FoodRow` blandes med `mix-blend-multiply` (+4 px luft) ind i
`--hf-color-card` (#EEE9DF), så fotoets hvide baggrund bliver let brunlig som
hos HelloFresh. Ingen ny farvetoken; mørkere/off-white blev fravalgt.
## 2026-09-28: "Største syndere" og "Månedens synder" slået fra

- Begge vises ikke, før der findes en volumengrænse (for lidt data kan gøre
  fx broccoli til "synder"). Styres af `SINNERS_ENABLED = false` i
  `src/lib/food-classification.ts`; koden er bevaret. Siden
  `/statistics/month-sinners` findes stadig, men linkes ikke.
## 2026-09-28: Eksternt hentede varer — samme design

Varer fra Open Food Facts/USDA vises i præcis samme design som varer scannet i
Hello Cal; datakilden må ikke ændre UI'et. Produktsiden har ingen
kilde-afhængig visning, men eksterne varers billede var et råt foto med
baggrund. Ved oprettelsen i `/api/products/lookup/[barcode]` lægges nu et
PRODUCT_FRONT-fritskrabningsjob for det eksterne billede (https), som
`scripts/image-agent/cutout.py` henter, fritskraber og skriver til
`pendingImageUrl` via samme admin-godkendelse som kamerafotos.

## 2026-09-28 — Kamera: scanningsstribe i stedet for load-cirkel

Mens et foto arbejder i kameraflowet under Tilføj, vises en bred hvid/lys gradientstribe (`.hf-scan-sweep`), der fejer hen over billedet, i stedet for det hvide overlay med load-cirklen. Billedet forbliver synligt, så varen ser ud til at blive scannet.

## 2026-09-28 — Kamera: 3D-scanningseffekt

Når scanningsstriben passerer midten af fotoet (objektet i fokus), bliver striben bredere og lysere, og fotoet løfter/zoomer sig let (`.hf-scan-lift`, skala 1,06). Stribe og løft deler varighed (1,8 s) og starter samtidig, så de er i takt. Ved reduceret bevægelse løfter billedet sig ikke.
## 2026-09-28 — Terminologi: "vare" i stedet for "produkt"

Synlige tekster i app og admin kalder madvarer "vare/varer", og "Produktdatabase" hedder "Varedatabase". Kode-identifikatorer, URL'er, databasefelter og AI-prompts under `src/app/api/ai/` er uændrede.


## 2026-09-28: Ingen "Branded"-mærkat

Produktsiden viser aldrig teksten "Branded". Brandet vises kun som brandnavn/logo.

## 2026-09-28 — Startmængde i mængdevælgeren

- Producentens portion (fx Open Food Facts' `serving_quantity`, gemt i
  `Product.servingSizeGrams`) er ikke længere startmængde: den er ofte
  urealistisk (musli 30 g, sodavand 10 cl, hamburgerryg 14 g). 100 g er heller
  ikke standard (brugerens beslutning).
- Rækkefølge (`src/lib/default-amount.ts`): brugerens seneste mængde for varen →
  rigtig portionsenhed (servingSizeGrams + enhedsnavne, fx HelloFresh) → typisk
  mængde for kategorien (nøgleordstabel på produkttype/navn, DRINK → 250 ml) →
  producentens portion → 100 g.
- `/api/products/:id` returnerer `lastAmountGrams` for den indloggede bruger.
- Open Food Facts-varer med `en:beverages` i `categories_tags` oprettes med
  `productCategory = DRINK`.

### Tilføjelse 2026-09-28 — skiver og pakkestørrelse

- Skivevarer (pålæg, skiveost): producentens portion er én skive og bruges som
  startmængde, i enheden "skive/skiver". OFF-opslag sætter enheden, når
  `serving_size` nævner skive/slice.
- Drikkevarer: pakke ≤ 50 cl (juicebrik, dåse) = hele pakken; vin = 150 ml pr.
  glas; større flasker = 250 ml pr. glas.
- Vores REMA-data har ingen skivevægt. `scripts/off-slice-weights/` henter den
  fra Open Food Facts (kræver netadgang; dry run som standard).
- Senere: AI-beregnet median pr. produkttype (fx smørrist) kan erstatte den
  håndskrevne tabel i `src/lib/default-amount.ts`.
- Enhedsstørrelse = `Product.servingSizeGrams` + `servingSizeUnitSingular/Plural`
  (fx 18 g, "skive"/"skiver"). Ingen ny kolonne.
- `scripts/store-products-import/build_data.py` læser skivevægt fra butikkernes
  originale tekster: "x g pr. skive" direkte, eller "N skiver" + pakkevægt
  (vægt ÷ N). Aldrig gættet; 2-80 g. Agenten skriver den kun, når varen ikke
  har en portionsstørrelse.

### Tilføjelse 2026-10-02 — drikkevarer og alkohol starter på pakkestørrelsen

- Brugerens regel: står der 33 cl, 25 cl eller 50 cl ved en drikkevare eller
  alkohol, er det tallet i mængdefeltet. Størrelsen læses fra
  `packageSizeText`, ellers fra navnet ("Tuborg Classic 33 cl"); multipak
  ("6 x 33 cl") giver én enhed.
- Varer uden kategorien DRINK tæller som drikkevare, når både navnet har et
  drikke-ord (øl, vin, cola …) og en størrelse i ml/cl/dl/l. Fløde, olie,
  eddike, sirup, saucer o.l. tages aldrig som hel pakke.
- Vin: flaske ≤ 25 cl = hele flasken, ellers 150 ml. Spiritus (≥ 20 % eller
  spiritus-ord uden mixer): ≤ 10 cl = hele flasken, ellers 4 cl.
  Færdigblandede drinks (gin & tonic, rom og cola) = hele dåsen. Øvrige
  drikkevarer: ≤ 50 cl = hele pakken, ellers 250 ml.
- Visningsenheden er cl, når pakningsstørrelsen eller navnet angiver cl (også
  "33 cl dåse"). Kategorien afgør stadig g mod ml.
- Tabellen med typiske mængder er udvidet (kød 150 g, fisk 125 g, frugt,
  suppe, pizza, færdigretter, fløde, æg m.m.), så færre varer ender på 100 g.
- Videresendte varer (`/forward/[token]`) tilføjes med samme startmængde.

## 2026-09-28: Produktsidens lodrette rytme + beskårne brand-logoer

- Produktsiden (`AddProductView`): 32 px fra produktcirklen til titlen (som
  HelloFresh-heroen, design.md §6 Velkomst), titel + grøn linje er én
  tekstblok uden mellemrum, begge i `.hf-type-hero` (32/38) som "Spis Bedre /
  hver dag!" (målt på skærmbilledet), 16 px til "Produktdetaljer", 16 px til
  mængdevælgeren, 8 px fra mængdeboksen til kcal/100 g.
- Brand-logoer beskæres til deres synlige pixels (logo-robotten,
  `trim_transparent`), så logoets bund flugter med cirklens bund. Allerede
  valgte logoer beskæres ved robottens næste kørsel.
- `.hf-type-hero` er nu 32/40 (før 32/38). Målt i 3×-skærmbilledet af
  HelloFresh-appen: 40 px mellem h1 og h2. Kontrolleret med skærmbillede af
  produktsiden: cirkel→h1 40 (HF 41), h1→h2 40 (HF 40), h2→næste 23 (HF 20).
- Resterende forskel: HelloFresh-appens overskrift er i en smal skrift
  (Agrandir Tight-lignende); Hello Cal bruger systemfonten (design.md §2).
- Produktsiden målt 1:1 mod HelloFresh-velkomsten (3×): cirkel 180 px (før
  190) og 62 px under appbaren, 41 px cirkel→h1-tekst, 40 px h1→h2, 20 px
  h2→næste tekst. Uden h2 bevares linjens 40 px luft, så resten ikke rykker op.
## 2026-09-28: E-nummer-opslagsværk ligger i repoet, ikke i databasen

E-numrenes beskrivelser er referenceindhold (ikke brugerdata) og versioneres som
`src/data/e-numbers.json` (genereret af `scripts/e-numre/build_catalog.py`), så
alle miljøer får samme indhold uden import på Synology. Hvert E-nummer har sin
egen side `/e-numre/[kode]`, og kilderne skal være specifikke for netop det stof
(EFSA-udtalelsens DOI og søgninger på stoffets præcise navn) — aldrig kun
generelle forsider. DB-tabellen `additives` bruges kun som fallback.

## 2026-09-28: "Mad på latin"-ordbog

Ikke-danske ingrediensnavne i ingredienslister linkes til `/mad-paa-latin#<ord>` som almindelig tekst (ingen understregning eller fed). Ordlisten er statisk kode i `src/lib/food-latin.ts`; E-numre håndteres fortsat af `/e-numre`.

Kilder på "Mad på latin" skal altid være officielle (Fødevarestyrelsen, Sundhedsstyrelsen, EFSA) når de findes; Wikipedia kun som sidste udvej (brugerkrav 2026-09-29).
## 2026-09-29: Face ID-login i Oprettelses-appen

- En verificeret passkey med brugerbekræftelse giver fuld medarbejdersession
  (som admin-passkey): den erstatter adgangskode + TOTP, ikke kun TOTP.
- Medarbejder-passkeys ligger i egen tabel `scan_worker_passkeys`, da
  medarbejdere ikke er `User`.
- `SCAN_PII_KEY` indføres uden datatab: dekryptering prøver `SCAN_PII_KEY`
  og derefter `ADMIN_SESSION_SECRET`; nye værdier krypteres med `SCAN_PII_KEY`.
## 2026-09-29: Mærkbart pulsudsving og brugertilføjede aktiviteter

- Udsving: puls ≥ max(100, hvilepuls + 35) i mindst 10 min (huller ≤ 10 min
  tæller med). Hvilepuls = seneste RESTING_HEART_RATE_BPM, ellers 10.-percentilen
  af 7 dages puls, ellers 65. Mærkbart = mindst 150 ekstra kcal: urets
  ACTIVE_ENERGY_KCAL i perioden, ellers Keytel-formlen minus samme ved hvilepuls.
- Udsving, der overlapper en registreret aktivitet eller allerede er besvaret/
  sprunget over (`HeartRateSpikeReview`), vises ikke.
- Egne aktiviteter kan bruges straks af den, der tilføjede dem; andre ser dem
  først efter godkendelse i Kvalitetskontrol → Aktiviteter.
## 2026-09-29: Søvnstatistik sammenholder natten med dagen før

- En søvnvurdering gælder datoen man vågnede; kalorier, sidste indtag, koffein og sport tages fra dagen FØR (aftenen op til natten). Målt søvn (HealthMetric `SLEEP_MINUTES`) tælles på vågne-datoen.
- "Kaffe" genkendes med koffein-ordlisten fra `src/lib/toxins.ts` (kaffe, te, cola, energidrik) mod registreringens titel; mængde = antal registreringer.
- Tidspunkter er registreringens `createdAt`; tidsbjælker skaleres fra kl. 12.

## 2026-09-29 — Oplevelse af søvn som bundark, aldrig "Luk"

- "Oplevelse af søvn" vises som bundark (popup, lukkes ved træk ned) i stedet for fuldskærmsside.
- Der må aldrig bruges "Luk" på overlays/sider i HELLO CAL, selvom HelloFresh gør det — lukning sker ved træk ned.
- Tallene 1–5 står i skærmens lodrette midte; "Slå fra" står nederst til venstre uden understregning.

## 2026-09-29 — Admin-menuens rækkefølge, Analyse+Statistik samlet, Reklamer

- Menu top→bund: Oversigt, Varegodkendelse, Produkt-database, Retter, Flows, Design, Statistik, Brugere, Indstillinger, Administration, Partnere, Roadmap, Log (Log altid nederst).
- Sammenfold-ikonet sidder på sidebjælkens kant i hovedsiden (altid synligt), ikke som "Skjul sidebjælke" nederst.
- Analyse er slået sammen med Statistik: `/admin/statistics` har faner (Brugere og indtjening / Trafik / Reklamer). `/admin/analytics` omdirigerer til Trafik-fanen. Indtjening og betalingsmetoder ligger i fanen Brugere og indtjening.
- Reklamer: fanen læser fra partner-reklamernes tabeller (`ad_locations`, `ad_events`, `partners`, ejet af Partnere-arbejdet) via rå SQL med try/catch, så den er tom, indtil tabellerne findes og der er hændelser.

## 2026-10-02: Abonnement og betalingsmetode hører til under Indstillinger; betalingsmetode kun for betalende

- **Ændret igen 2026-10-03 (PR #202, nyeste ønske):** Abonnement og Betaling er fjernet fra Profil og findes kun under Indstillinger. Punktet herunder om at de bliver på Profil gælder ikke længere.
- **Ændret 2026-10-03 (ejerens valg):** de to første punkter herunder gælder ikke længere. Abonnement og Betalingsmetoder bliver på både Profil og Indstillinger og vises for alle (også uden kort, så "Vælg abonnement" kan findes). Resten (aktivt kort fra Stripe, kortskift i kundeportalen) gælder.

- **Abonnement og Betaling ligger kun under Indstillinger** (ejerens krav 2026-10-02; menupunktet hedder "Betaling", jf. e8ad1b3 samme dag). Profilsidens to rækker er fjernet; `/profile/subscription` og `/settings/payment` er uændrede adresser.
- **Menupunktet "Betaling" (betalingsmetode-siden) vises kun for betalende.** Betalende = en rigtig udbyder-aftale (Stripe eller MobilePay Recurring) med status ACTIVE eller CANCELED med betalt restperiode — samme definition som admin → Statistik. Gavekode-, points-, prøve- og familiemedlems-Seriøs har intet kort og ser ikke rækken. En MobilePay-aftale, der venter på godkendelse, ser den også (så "Afventer godkendelse" kan findes). Felt: `paying` i `GET /api/subscription`.
- **Siden viser det, der faktisk trækkes på** — det abonnementets `default_payment_method` hos Stripe (ellers kundens `invoice_settings.default_payment_method`): kortmærke, sidste 4 cifre og udløb; Apple Pay/Google Pay vises som wallet med kortet bagved (`PaymentMethod.wallet`, enum `PaymentWallet`, migration `20261002090000_payment_method_wallet`); MobilePay som MobilePay. Siden kalder `GET /api/subscription?refresh=1`, som synker fra Stripe først, så et kortskift ses med det samme. Kortet slettes ikke længere ved opsigelse — først når aftalen er helt afsluttet hos Stripe.
- **Kortskift sker i Stripes kundeportal** (`POST /api/payments/stripe/portal` → Billing Portal med `flow_data.type = payment_method_update`, retur til `/settings/payment`). Hello Cal ser aldrig kortdata. Portalen kræver en konfiguration pr. Stripe-konto (test/live): findes ingen aktiv, opretter serveren én med kun kortskift + kvitteringshistorik (opsigelse/planskift slået fra — det styres i appen; privatlivs-/betingelseslinks peger på appens sider). MobilePay Recurring (Vipps) har intet kortskift; der kan kun aftalen stoppes.
- Kortmærket vises med Stripes brand-værdi (`card.brand`) som lille logo i en fast kortramme: Visa og Mastercard (`public/payment/mastercard.svg`, officiel cirkelgeometri) med sidste 4 cifre; EC-kort/Amex/ukendt får et neutralt kort-ikon. Alle betalingsikoner er små (20 px høje) — også logoerne for understøttede metoder, der nu er chips som på købssiden.

## 2026-09-29: Stripe-betaling — MobilePay i Danmark, kort/EC i Tyskland

- **Startlande: Danmark og Tyskland** (`src/lib/payments/stripe-markets.ts`). Land = brugerens `region`. DK betaler med **MobilePay** (DKK), DE med **kort inkl. EC-kort/girocard** (EUR). Andre lande får ingen Stripe-betaling (faldback: MobilePay Recurring, hvis den er sat op).
- Stripe Checkout i abonnementstilstand med dynamisk pris (`price_data`, interval måned × 1/3/12). Pris og betalingsmetode slås op på serveren ud fra land + plan + periode. Ingen Stripe-SDK (REST via fetch), ingen kortdata hos Hello Cal.
- EC-kort kører som kort-metoden i Stripe (der findes ikke en separat girocard-metode i Checkout); girocard kræver, at kortet er co-brandet eller at girocard er slået til på Stripe-kontoen. SEPA-lastskrift er bevidst ikke med.
- Euro-priser (foreløbige, `SUBSCRIPTION_PRICES_EUR`): Seriøs 15,99 / 39,99 / 143,99 €, Familie 23,99 / 59,99 / 215,99 €. Skal godkendes af ejeren (moms/OSS i Tyskland er ikke afklaret).
- Status hentes altid fra Stripe. Webhook (`/api/payments/stripe/webhook`, registreres automatisk af scheduleren, hemmelighed krypteret i `payment_webhooks`, eller manuelt via `STRIPE_WEBHOOK_SECRET`) er kun et signal. Retursiden `/settings/payment/stripe` kobler sessionen med det samme.
- Opsigelse = `cancel_at_period_end`; Seriøs løber perioden ud. Kører der allerede en gavekode/points-periode ≥ 48 t, bruges den som `trial_end`, så første træk først sker bagefter. **Gratis måneder fra points (freeMonthsRemaining) bruges endnu ikke mod Stripe-fornyelser.**
- Nøgler: admin → API-nøgler → Betaling → Stripe (`STRIPE_SECRET_KEY`, valgfri `STRIPE_WEBHOOK_SECRET`). Migration `20260929150000_stripe_payments` (brand CARD/GIROCARD).

## 2026-09-29: Partnere — Reklamer, Kontakter og Rapporter

- Menu: **Partnere** er en gruppe med **Reklamer** (`/admin/partners/ads`) og **Kontakter** (`/admin/partners/contacts`); ny side **Rapporter** (`/admin/partners/reports`) som tredje punkt i gruppen Partnere.
- Tabeller: `partners`, `partner_contacts`, `ad_locations`, `ad_events` (IMPRESSION/CLICK), `partner_report_schedules`, `partner_report_sends` (log). Reklamer viser visninger, klik og klikrate pr. lokation (7/30/90 dage). Statistik → Reklamer læser samme tabeller.
- `POST /api/ads/track` ({locationId, type}) registrerer visning/klik; der findes endnu ingen reklamevisning i appen, der kalder det.
- Rapporter afsendes fra `report@hellocal.io` (`REPORT_SMTP_FROM`, samme Mailjet-SMTP som øvrige mails). Kan sendes straks ("Send nu", seneste 7/30/90 dage) eller sættes op til interval (ugentligt/månedligt; kører i scheduler-ticket).
- **Sikkerhed mod forkerte modtagere:** klienten sender kun et partnerId; modtagere er altid den partners egne aktive kontakter (server-side), data hentes kun for den partners lokationer, og begge dele kontrolleres igen før afsendelse. Én mail pr. modtager, hver logget. Bekræftelsesdialog viser partner → adresser, og serveren afviser afsendelsen (409), hvis modtagerlisten er ændret siden dialogen. Intervalplaner kan kun oprettes, hvis partneren har aktive kontakter.

- Afsendere pr. formål (`src/lib/mail-senders.ts`): `signup@hellocal.io` (konto/e-mailbekræftelse), `invite@hellocal.io` (invitationer, deling, scan-invites), `noreply@hellocal.io` (alt andet), `report@hellocal.io` (partnerrapporter). Alle på det verificerede Mailjet-domæne.

## 2026-09-29: Hello Doc-indsigten bygger på adminfladens design (fælles klasser)

- Lægevisningen `/hello-doc/[token]`, admins Hello Doc og "Sådan ser det ud" bruger nu de samme `.hf-insight*`-, `.hf-panel`-, `.hf-kpi`- og `.hf-avatar-initials`-klasser (`globals.css`, design.md §6.15) og de fælles komponenter i `HelloDocInsight.tsx`. Tidligere havde hver side sine egne Tailwind-kæder (admin brugte `text-xl`/`font-semibold`, som ikke findes i designreglen).
- Udseende følger admin: hvid topbjælke med logo, sidefarve #FAF8F3, hvide paneler med tynd #DFD9CC kant; lægevisningens grønne topbjælke er droppet. Tokens er appens egne — ingen nye farver, størrelser eller afstande.
- Delekategorier styrer stadig, hvad lægen ser (`show.food`/`show.vitamins`, udeladte felter skjules).

## 2026-09-29 — Daglig kaloriegrænse pr. bruger + popup med forslag

- Grænsen er ikke længere den faste konstant 3299 for alle: den ligger på `User.dailyKcalGoal` (null = `DAILY_KCAL_GOAL` som standard, `resolveDailyKcalGoal` i `src/lib/goals.ts`). Kalender, forside-hjul, statistik, statistikkort og widgets bruger brugerens værdi (klient: `useDailyKcalGoal`).
- Popuppen (`KcalGoalPrompt`) kommer dynamisk ved uoverensstemmelse: når de seneste 4 uger har registreringer på mindst 25 af 28 dage, mindst 3 vejninger over 14+ dage, og den lærte vedligeholdelse (`estimateAdaptiveMaintenance`) flytter grænsen ≥ 100 kcal. Forslag = nuværende grænse + (lært − formel-vedligeholdelse), rundet til 50 kcal, så brugerens eget underskud/overskud bevares.
- "Opdater" gemmer, "Senere" udsætter 3 dage, "Spørg ikke igen" slår popuppen fra (`kcalGoalPromptDisabled`). Ingen tidsplan for genvisning ud over uoverensstemmelsen selv.
## 2026-09-29: Desktop-version bygget på admin-skallen; ingen telefonramme

- Telefonrammen (bezel) er fjernet overalt. Appen fylder altid browserens
  viewport; `PhoneFrame` hedder nu `AppFrame`.
- Bredde ≥ 1024 px viser appen i `WebShell` (`src/components/web/`), der
  følger `AdminShell` 1:1 i struktur og farver: sidebjælke i fuld højde med
  logo, søgefelt, genveje øverst og indstillinger nedenunder (sammenfoldelig,
  husket i localStorage); hvid topbjælke med appens bundmenu uden kamera og
  stemme, med Chat i stedet; "Profilindstillinger" yderst til højre.
- Desktop starter i kalenderens dagsvisning (`/calendar?view=day`); roden `/`
  sender videre dertil. Forsidens drejehjul og tilføj-cirkel findes ikke på
  desktop — deres handlinger er genveje i sidebjælken.
- Appens grønne app-bjælke bliver i skallen en lys sideoverskrift med mørk
  tekst (som admin). Profilcirklen i bjælken skjules (den sidder i topbjælken).
  Sider, sidebjælken linker til, er topniveau og får ingen tilbagepil.
- `/chat` afløser mikrofonen: fritekst → `/api/ai/interpret-meal` → "Tilføj
  til dagen" gemmer registreringer.
- Landingpagen (`/` uden login) fylder hele skærmen; "Log ind" er et diskret
  tekstlink øverst til højre til `/welcome`. Login/opret vises uden ramme.
- Menuerne ligger i `src/lib/web-nav.ts`; tekster under `web` i da/en.
## 2026-09-28: Emballeret vand hedder "Flaskevand"

- En fotograferet/emballeret vare er aldrig postevand. Forsideaflæsningen beder
  AI'en bruge "Flaskevand" (eller "Kildevand"/"Mineralvand" når emballagen siger
  det), og et bart "Vand" normaliseres til "Flaskevand" (`normalizeProductType`
  i `src/lib/product-naming.ts`), så søgning på "vand" viser en præcis betegnelse.
- Eksisterende produkter, der allerede hedder "Vand", omdøbes ikke automatisk.

## 2026-10-02: SMS-kode via TeamMessage ved tilmelding og glemt adgangskode

- Tilmelding (e-mail + adgangskode) kraever mobilnummer + 6-cifret SMS-kode (gyldig 10 min, 5 forsoeg, engangs). Kontoen oprettes foerst efter korrekt kode (/api/auth/sms/signup -> /api/auth/register).
- Glemt adgangskode: har kontoen et bekraeftet nummer, kraeves baade e-mail-linket og en SMS-kode (/api/auth/reset-password/sms). Konti uden nummer (fx Google/Apple/Facebook, gamle konti) nulstilles kun med e-mail-link.
- Koder gemmes som HMAC-hash i sms_verifications; klient: src/lib/teammessage.ts (env TEAMMESSAGE_*). Uden opsaetning i produktion afvises tilmelding (fail-closed).
- Ikke bygget: godkendelse af online-login i den installerede app (kraver push/native app).
## 2026-10-02: Mærkater på vareforsiden (laktosefri, Haltungsform, QMilch …) — natligt job

- Brugerens krav: alle mærkater/badges på forsiden (fx "-L Laktosefrei", QMilch, Haltungsform 3) skal analyseres og findes ligesom logoet — men med lavere prioritet: om natten/i baggrunden, aldrig i selve scan-flowet.
- Nyt app-job `label-scan` (admin → Cron-jobs, standard dagligt kl. 04:00, `src/lib/product-label-scan.ts`): varer uden `labelsScannedAt` læses af OpenAI med egen prompt (`src/lib/product-label-ai.ts`, `labels-v1-2026-10-02`): nøgle, dansk navn, tekst på mærket, kategori (DIET/ORGANIC/ANIMAL_WELFARE/QUALITY/SUSTAINABILITY/HEALTH/ORIGIN/OTHER), boks og sikkerhed. Kilde: originalfotoet fra kamera-flowet (FRONT-analysens `imageUrl`), ellers varens billede. Højst 150 varer pr. kørsel. Varer uden læsbart foto markeres som scannet, så de ikke blokerer køen.
- Faste nøgler for kendte mærker (`KNOWN_LABEL_KEYS`: lactose-free, haltungsform-1…5, qmilch, organic-eu/-dk/-de, keyhole, msc …), så samme mærke hedder det samme på alle varer; ukendte mærker får en nøgle AI'en danner.
- Lagring i ny tabel `product_labels` (én række pr. vare + nøgle, fund ≥ 0,5). Hvert mærke med boks får et `ImageCutoutJob` af ny slags `PRODUCT_LABEL`; image-agent fritskraber det som et logo (ingen opretning) og skriver PNG'en til `ProductLabel.imageUrl`.
- Filtre: fund ≥ 0,8 udfylder **kun tomme** felter i `product_filters` (`src/lib/product-label-filters.ts`): laktose-/gluten-/sukkerfri, vegansk, vegetarisk, nøglehul, fuldkorn, økologisk, oprindelsesland; dyrevelfærd og certificeringer (QMilch, QS, MSC, Fairtrade …) tilføjes til listerne. Butiksimport/admin-rettelser overskrives aldrig.
- Varesiden: `certificationBadges(filters, labels)` viser fund ≥ 0,8 som badges; mærker uden egen logofil i `public/certifications` vises med det fritskrabede mærke fra emballagen.
- Migration `20261002090000_product_labels`.

## 2026-10-02: SMS-gendannelse af adgangskode via TeamMessage

- Udbyder: TeamMessage (teammessage.eu), REST `POST /api/v1/sms/send/` med Bearer-token. Uden token er SMS slået fra.
- Mobilnummer er valgfrit på profilen og gemmes normaliseret (`+45XXXXXXXX`; 8 cifre antages danske). Slettes ved "ret til at blive glemt".
- Flow: e-mail → 6-cifret kode på SMS (10 min, højst 5 forsøg, kun nyeste kode gælder, HMAC-hash) → almindeligt `PasswordResetToken` → `/reset-password`. Svaret afslører aldrig, om konto eller nummer findes. Højst 5 SMS pr. konto pr. 15 min.
- Mail-linket er stadig standard; SMS er et tekstlink-alternativ på samme side.
## 2026-10-02: Userback feedback-widget

- Scriptet indlæses globalt fra src/components/UserbackWidget.tsx (rodlayoutet) med det offentlige widget-token. Der sendes bevidst ingen Userback.user_data (ingen navn/e-mail), så feedback er anonym i tråd med anonymitetsreglerne.


## 2026-10-02 – Rigtige certifikat-logoer (public/certifications)

- Mærker på varesiden vises med brugerens rigtige logofiler (`public/certifications/*.png`, kind → fil i `CERTIFICATION_LOGO_FILES` i `src/lib/certification-badges.ts`), ikke tegnede SVG-erstatninger. Originalerne ligger i mappen `Certifikater/` (ikke i git).
- Kobling sker på tekstværdien i `ProductFilters` (økologisk, nøglehul, fuldkorn, dyrevelfærd-liste, certificeringer-liste); ukendte mærker vises som tekst-pille.
- "Bedre Dyrevelfærd 2" er afledt af 1- og 3-hjerte-filerne, fordi den leverede 2-stjerner-fil var identisk med 3-stjerner. Erstat med original, når den findes.
## 2026-10-02 Kontoindstillinger: Luk konto og Ret til at blive glemt

- Ny side /settings/account (Indstillinger -> Kontoindstillinger) med to knapper, begge i bundark med bekraeftelse (skriv SLET).
- Begge kalder POST /api/account/close, som koerer anonymizeUser() (src/lib/gdpr.ts) paa brugeren selv, rydder session-cookies og logger ud. Forskellen er kun ordlyd; GDPR-sletning er fortsat anonymisering (se 2026-09-02).
- Ikke gjort: aktivt abonnement hos betalingsudbyder opsiges ikke automatisk.
- Afløst for "Luk konto" af 2026-10-03 nedenfor.
## 2026-10-03: "Luk konto" kan fortrydes i 3 måneder

Brugerens krav: "Luk konto kan reverses inde. For 3 måneder, med mindre man vælger rtbf. Luk skal være sort understreget tekst kun. Ikke stor knap."

- **Luk konto** sætter `User.closedAt` (migration `20261003120000_account_closed_at`) — intet slettes. Brugeren logges ud på alle enheder (`getSessionUser`, widget-token og familieprofiler afviser lukkede konti), og der sendes ingen mail/push (`queueMessage` gemmer dem som SKIPPED). Stripe opsiges til periodens udløb, en MobilePay-aftale stoppes.
- **Genåbning:** ethvert login (adgangskode, Face ID, Google/Apple/Facebook, nulstillet adgangskode) inden for 90 dage rydder `closedAt` (`completeLogin` → `reopenClosedAccount`). Data er urørt; et opsagt abonnement skal tegnes igen.
- **Efter 90 dage** anonymiserer vedligeholdelsesjobbet (hvert 15. min.) kontoen med `anonymizeUser` — samme resultat som "Ret til at blive glemt". Logik i `src/lib/account-closure.ts`.
- **Ret til at blive glemt** er uændret: anonymiserer med det samme og kræver, at brugeren skriver SLET.
- **UI:** "Luk konto" er kun et sort, understreget tekstlink nederst på /settings/account (ingen overskrift, ingen stor knap). Bundarket forklarer 3-måneders-fristen og har også kun et tekstlink som bekræftelse (ingen SLET-indtastning, da det kan fortrydes).
- Admin → Brugere viser "Lukket <dato>" på lukkede konti. Audit: `USER_CLOSE_ACCOUNT` / `USER_REOPEN_ACCOUNT` i `admin_audit_logs`.
## 2026-10-02 — Admin: Economy

- Ny side /admin/economy: årsabonnementer (årlig sikker indkomst, sikret løbetid), månedsabonnementer (+ 3 mdr.) og næste måneds forventede indtjening. Kun betalende (provider sat); pris/periode fra MobilePay-træk og Stripe live (skønnet 1 md. ved mangel).
- Afmelding: observeret 30-dages rate blandet med prior 7 %/md.; AI-knap lader OpenAI vurdere % pr. type (kun aggregater, store:false), forventningen regnes i koden. Grov model, ikke regnskab.


## 2026-10-02: Partnersider (virksomhed, sponsoraftale, performance, fakturering)

- **Side pr. partner** på `/admin/partners/[id]` (åbnes fra Partnere → Kontakter). Venstre bjælke øverst: virksomhed (navn, CVR, adresse, virksomhedens telefon), **kontaktperson** (navn, e-mail, telefon) og **leder** (navn, funktion, e-mail; ingen telefon for lederen). Under dem menuen **Sponsoraftale** (standard), **Performance**, **Faktureringsdetaljer** og **Betalingsmetode**. Adminskallen skjuler "Gå til…"-søgningen på disse sider (`isPartnerDetailPath`).
- Når kontaktpersonens eller lederens e-mail gemmes, oprettes de automatisk som aktive `PartnerContact` på samme partner (hvis adressen ikke findes), fordi rapporter kun sendes til partnerens egne kontakter (sikkerhedsreglen fra 2026-09-29 er uændret).
- **Sponsoraftale:** øverst aktive aftaler (`SponsorAgreement`: periode, budget, CPM, CPC) med budget og forbrug. Forbrug = visninger/1000 × CPM + klik × CPC siden aftalens start for aftalens spots. Derunder alle reklamemuligheder fra det statiske katalog `src/lib/ad-inventory.ts`; hver mulighed viser partnerens spots og kan få nye. Et spot (`AdLocation`) har banner, link, aftalte visninger/klik, aftale og evt. trigger.
- **Triggere:** pladser markeret `triggerable` (produktside, sponsoreret søgeresultat, efter scanning) kan begrænses til en `ProductCategory` og/eller en produkttype (`Product.productType`, sammenlignes uden forskel på store/små bogstaver). Et spot med trigger vises aldrig uden passende kontekst (`src/lib/ad-serving.ts`, `GET /api/ads/serve`). Aftaler uden for perioden, inaktive eller med opbrugt budget serveres ikke. Performance kan filtreres til "kun udløst af kategori/type".
- **Performance** har to faner: **Overview** (standard: visninger, klik, CTR, eksponeringstid, gennemsnit, opfyldelse af aftalte visninger, visninger pr. dag) og **Data mining** (ét kort pr. spot i to kolonner: banner, kliks og visninger "af" aftalt). "Vis mere" åbner et overlay med tabel over alle sider reklamen er vist på (visning, kliks, sekunder eksponeret). Periode: 7/30/90 dage eller fra–til (hele danske kalenderdage, `Europe/Copenhagen`).
- **Rapport:** hent som PDF eller CSV (`GET /api/admin/partners/[id]/performance?format=pdf|csv`) eller send til en indtastet modtager (navn + e-mail) som vedhæftet PDF og/eller CSV (afsender `report@hellocal.io`, logges i `partner_report_sends` med trigger `MANUAL_ADDRESS`). PDF'en laves uden afhængigheder af `src/lib/simple-pdf.ts`.
- **Måling:** `POST /api/ads/track` tager nu også `path` (siden reklamen vistes på) og returnerer `eventId`; `{eventId, seconds}` opdaterer eksponeringstiden. Komponenten `AdBanner` (`src/components/AdBanner.tsx`) henter en reklame, tæller visning først når mindst halvdelen er synlig, måler synlig tid og tæller klik. **AdBanner er endnu ikke sat ind på nogen side i appen** (produktsiden, kalenderen m.fl. ejes af andre grupper).
- **Banner uploades som billedfil** (brugerens valg 2026-10-03): `POST /api/admin/partners/[id]/banner` (PNG/JPG/WebP, højst 4 MB, typen afgøres af filens bytes, metadata fjernes) gemmer i `/product-images/ad-banners/` i den eksisterende volumen og serveres af fallback-ruten. Spottets `bannerUrl` må kun være en sådan gemt sti.
- **Reklamemulighederne i `src/lib/ad-inventory.ts` er et forslag**, ikke en afklaret liste: ejeren har ikke angivet, hvilke pladser i appen der findes. Ret kataloget, når pladserne er besluttet. Reklamerne vises ikke i appen, før ejeren siger hvor; `AdBanner` er derfor ikke sat ind nogen steder.
- Spot-boksene i to kolonner vises kun i fanen Data mining (brugerens valg 2026-10-03); Overview viser totaler og KPI'er.
- Migration `20261002090000_partner_pages` (idempotent): nye felter på `partners` og `ad_locations`, `ad_events.path/seconds`, tabellen `sponsor_agreements`, enum `PartnerPaymentMethod`.

## 2026-10-03: Login-godkendelse med push (brugerens valg: byg det)

- Valgfri funktion (`User.loginApprovalEnabled`, slås til på /profile/login-approval): et login med adgangskode fra en NY enhed (ukendt hc_device) skal godkendes med Web Push på en anden enhed, hvor brugeren allerede er logget ind. Siden /approve-login viser Godkend/Afvis; den ventende browser får først session, når status er godkendt (src/lib/login-approval.ts, 5 min.).
- Bruger Web Push (VAPID) via PWA + public/sw.js — ikke en native app. Kræver VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY på serveren; uden dem, uden abonnement eller hvis ingen enhed kan nås, springes kravet over (ingen låses ude). Social login, Face ID og nulstilling af adgangskode er upåvirket.
- Native app (APNs/FCM) er fortsat ikke bygget; når den findes, skal den bruge samme endpoints.
- SMS: login-koder bruger src/lib/teammessage.ts; src/lib/sms.ts (GatewayAPI) fra en anden session er et separat spor til notifikationer.
## 2026-10-03 Opdater-varen-banner: 20 points

- Mangler en vare indhold, energi (kun butiksvarer med `nutritionMissing`), logo eller produktbillede, vises et hvidt banner øverst på varesiden: "Optjen 20 points ved at opdatere varen". Det kan trækkes ned/skubbes op, så kun den smalle bar med grebet vises (`src/components/hf/UpdatePointsBanner.tsx`).
- Banneret fører til `/add/[id]/update`: et kort pr. manglende ting (forside = billede + logo, energi, indhold). Fotoet læses af AI via `POST /api/products/[id]/update`; kun tomme felter udfyldes, eksisterende data overskrives aldrig. Forsiden bruger den eksisterende fritskrabning (logo → Brand.logoUrl, billede → `pendingImageUrl` til admin-godkendelse).
- Points: ny `PointsReason.PRODUCT_UPDATED` (migration `20261003100000_points_product_updated`), 20 points højst én gang pr. bruger og vare, udbetales når fotoet faktisk udfyldte noget. Gælder også admin (brugerens krav, så det kan testes). Banneret skjules for den bruger, når point er optjent på varen.
- Logik: `src/lib/product-update.ts`; `GET /api/products/[id]` returnerer `updateOffer` (null når intet mangler eller varen er privat).
## 2026-10-02: Admin "Billeder i kø til frilæggelse"

- Brugerkrav: under godkendelser skal der være en fane "Billeder i kø til
  frilæggelse" med besked nedenunder om, at billederne scannes i nat.
- Bygget som nyt punkt i gruppen Varegodkendelse (`/admin/images/cutout-queue`)
  og som fane på Billedforslag (`ImagesTabs`). Siden læser kun:
  `image_cutout_jobs` med status PENDING (listen) og FAILED (egen sektion;
  de prøves ikke igen af sig selv). Udsnittet tegnes med CSS fra jobbets
  `cropBox`, så admin ser det område, robotten fritlægger.
- Beskeden under listen er brugerens tekst. Har jobbet `image-cutout` en fast
  tid i `scheduled_jobs`, skrives klokkeslættet med; derudover vises
  robottens faktiske plan (`describeNextRun`) og sidste kørsel, så teksten
  aldrig lyver om, hvad der sker. Planen selv er ikke ændret (stadig
  "Løbende", 2026-09-28) — det er ejerens valg.

## 2026-10-02: Admin → Brugere → Personas

- Nyt menupunkt "Personas" under gruppen Brugere (`/admin/users/personas`). Formål: finde mønstre og parametre for brugergrupper — lokation (land, by), sprog, alder, køn, anvendelse af appen og antal logins — og lade en AI-model udlede personas (ejerens ønske 2026-10-02).
- **Privatliv:** AI'en (OpenAI, `store: false`, samme regel som Statistik 2026-09-27) får KUN aggregerede gruppetal — aldrig navne, e-mails, bruger-id'er eller enkeltpersoners rækker. Grupper under 5 brugere (`MIN_GROUP_SIZE`) slås sammen i "Øvrige" både i tabellerne og i det, AI'en får, så ingen kan genkendes. Glemte brugere (`forgottenAt`) og admin-konti indgår ikke.
- **Definitioner:** Land = seneste login-land (Cloudflare), ellers profilens `region`. By = seneste login-by (`login_events.city`, ny kolonne fra `cf-ipcity`; null uden Cloudflares "visitor location headers"). Sprog = `appLocale`. Alder i grupper (under 18, 18–24 … 65+, ukendt) fra `birthDate`. Abonnement som i Statistik (gratis/seriøs/familie, inkl. familiemedlemmer). Enhed = OS fra seneste kendte enhed. Logins tælles over 90 dage, brug (registreringer, aktive dage, HelloFresh, motion, vejninger) over 30 dage. Adfærdssegmenter: nye (< 14 dage), storbrugere (≥ 20 aktive dage/md.), faste (8–19), lejlighedsvise (1–7), kigger (logger ind uden mad), inaktive (ingen login og ingen registrering i 30 dage). Typisk tidspunkt = den del af døgnet (morgen 05–10, dag 10–16, aften 16–22, nat 22–05) med ≥ 50 % af gruppens logins, ellers "blandet".
- **Kørsel (ejerens valg 2026-10-03):** Gruppetallene beregnes live ved hvert sidekald (gratis). AI-personas beregnes kun ved deploy og manuelt — ingen natlig plan for nu. Ved opstart af en ny build (`.next/BUILD_ID`) bestilles én kørsel af cronjobbet "personas", hvis der ikke allerede findes et snapshot for den build (genstart af samme build giver ingen ny kørsel; kun i produktion og med OpenAI-nøgle). Derudover "Kør nu" under Cronjobs og knappen "Beregn personas med AI" (kun fuld administratoradgang). En fast plan kan sættes senere under Cronjobs uden kodeændring. Hvert resultat gemmes i `persona_snapshots` med aggregater, AI-svar (struktureret JSON: navn, andel, beskrivelse, demografi, adfærd, mønstre, behov, handlinger + vigtigste fund og forbehold), model og evt. fejl. Model: `OPENAI_PERSONA_MODEL`, ellers `OPENAI_STATS_MODEL`, ellers produktmodellen.

## 2026-10-02: Før/efter-sammenligning i billede-dagbogen

- Billede-dagbogen får en før/efter-slider (`PhotoCompare`) med to tilstande:
  "Glid" (skillelinje; før til venstre, efter til højre — samme retning som
  karrusellen, ældst til venstre) og "Ton" (efter tones ind over før).
- Begge billeder fylder én boks formet efter før-billedet (`object-cover`), så
  kroppen står samme sted; billeder med andet format beskæres let i stedet for
  at få sorte kanter, der flytter skillelinjen væk fra billedet.
- Brugeren vælger frit begge billeder; der tvinges ikke kronologisk rækkefølge.
- Alt sker på enheden ud fra billederne i IndexedDB; intet nyt sendes til
  serveren, og visningslåsen gælder også sammenligningen.

## 2026-10-02: Robotternes kørselshistorik og "Nattens kørsler"

- Brugerønske: under robotterne i admin skal det stå, hvornår de sidst kørte og hvor meget de udførte; det samme skal stå på oversigten under overskriften "Nattens kørsler".
- Ny tabel `scheduled_job_runs` (én række pr. kørsel: start, slut, status, besked, `itemCount` = udført, `runCount`, varighed). `scheduled_jobs` beholdes som "seneste status"; historikken er kun til visning og ryddes efter 30 dage.
- Tomme OK-kørsler (0 udført) lægges sammen med forrige række, hvis den også var tom (`runCount` tæller tjekkene). Ellers ville "Løbende" robotter (tjek hvert 15. sekund) fylde tabellen.
- Natten er kl. 20–08 dansk tid (`src/lib/jobs/night.ts`). Fra kl. 20 vises natten, der er i gang; ellers den seneste afsluttede.
- Kontrakt: et job returnerer en besked eller `(besked, antal)` (Python) / `{ message, count }` (app-job). Samme regler i `job_control.py` (alle kopier) og `src/lib/jobs/runs.ts` — hold dem ens. Historikfejl vælter aldrig selve jobbet.
## 2026-10-03: Admin, webvisning og Hello Doc bygger på samme skal-klasser

- Admin (`AdminShell`), Hello Cal i webvisning (`WebShell`) og Hello Doc bruger ét sæt klasser i `globals.css` (design.md §6.17): `.hf-shell*` (sidebjælke, topbjælke, indholdsbredde, skuffe, hurtigsøgning), `.hf-navrow` (alle menurækker), `.hf-crumbs`, `.hf-menu` (dropdowns), `.hf-surface` (hvid flade med tynd kant, uden padding) og `.hf-table-scroll`. Tidligere havde hver skal sin egen kopi af de samme Tailwind-kæder.
- `.hf-insight__topbar` er afløst af `.hf-shell__topbar`; `.hf-insight__main` deler bredde/gutter med `.hf-shell__content` (16 px, 32 px fra 1024 px — afstandsskalaens værdier i stedet for admins tidligere 24 px).
- Webvisningen beholder sin højere top (80 px, `.hf-shell--tall`). Menuens tekst skjules under 1280 px, så topmenu, plus-cirkel og profil ikke støder sammen ved 1024 px.
- Admin-statistikken og admin-login-siderne bruger `.hf-type-*`, `.hf-kpi`, `.hf-panel` og `.hf-choice` i stedet for `text-xs`/`text-2xl`/`font-semibold`. Telefon- og e-mail-mockups (Designmanual, beskedredigering) er bevidst undtaget, fordi de tegner en iPhone.

## 2026-10-03: Startbonus på 35 points (teaser)

- Ejerens beslutning: hver bruger starter registreringen med 35 points som teaser, så pointsystemet er synligt fra dag ét (300 points = 1 gratis måned).
- Ny `PointsReason.SIGNUP_BONUS` i ledgeren (ingen cachet saldo, jf. 2026-09-02). Beløbet ligger i `SIGNUP_BONUS_POINTS` (`src/lib/points-constants.ts`).
- Gives ved oprettelse af en almindelig konto: e-mail-tilmelding (`/api/auth/register`) og ny konto via Google/Apple/Facebook. Ikke til familieprofiler (oprettes af ejeren, kan ikke logge ind selv) eller admin-konti. `awardSignupBonus()` giver højst én bonus pr. bruger.
- Eksisterende brugere får også bonussen (ejerens valg 2026-10-03): engangs-migrationen `20261003120100_points_signup_bonus_backfill` giver alle nuværende almindelige brugere 35 points — ikke admin-konti, glemte brugere eller familieprofiler oprettet af betaleren. Migrationen springer brugere over, der allerede har en `SIGNUP_BONUS`.

## 2026-10-03: Hjælpecenterets guide-knap er grøn

- Øverst i Hjælpecenter (`public/hjaelp.html`) står guiden "Lær appen at kende" med knappen "Start guiden" på grøn baggrund (`#067A46`, hvid tekst) — ejerens udtrykkelige ønske og en bevidst undtagelse fra design.md's regel om, at grønne handlingsknapper er udfaset.
- Den statiske side kan ikke selv åbne guiden, så den linker til `/settings?guide=1`, som starter `OnboardingWizard` forfra (samme handling som "Lær appen at kende" i Indstillinger).
## 2026-10-02: Fold-ud-boks (accordion) som element i statistik-layoutet

- Statistiksidens kort-gitter har et nyt opbygningselement ud over Overskrift
  og Skillelinje: en **fold-ud-boks**, der ser ud som grupperne på
  `/statistics/unused-cards` (`AccordionSection`: hoved med titel, antal og
  chevron; grønt hoved når den er åben). Kort, overskrifter og skillelinjer
  kan ligge inde i den.
- Datamodel: boksen gemmes **fladt** i samme layout-liste som alt andet som
  to markører — `{ type: "accordion", id, title, open }` og
  `{ type: "accordionEnd", id }` — og alt imellem dem er indholdet. Ingen
  indlejring (en ny boks lukker den forrige). `normalizeStatLayout`
  reparerer manglende/løse markører og fjerner tomme rækker lige før
  slut-markøren. Åben/lukket gemmes i layoutet (localStorage), så valget
  huskes.
- Betjening: tryk på hovedet folder ud/sammen; langt tryk løfter **hele
  boksen** (også når den er lukket) og den lander kun mellem rækker på
  øverste niveau. Kort slippes ind i boksen i et frit felt (åben) eller på
  hovedet (lukket — kortet lægges sidst i boksen). I redigering: tryk på
  titlen omdøber, slette-cirklen fjerner kun rammen — kortene bliver i
  gitteret, hvor boksen stod.
- Tilføj-siden: Overskrift, Skillelinje og Fold-ud-boks står samlet øverst
  under søgefeltet i en mørkere boks (`bg-hf-tan-dark`), så
  opbygningselementer tydeligt adskiller sig fra data-kort og grafer.
- Kode: layout-logikken ligger nu i `src/lib/stat-layout.ts` (uden
  UI-imports, så den kan testes med `npm test`); `stat-cards.ts`
  re-eksporterer den, så eksisterende imports virker uændret.
## 2026-10-02: Admin → Integrationer og hændelseslog

- Nyt menupunkt "Integrationer" i admin (`/admin/integrations`) med dashboard over alle integrationer og en side pr. integration (`/admin/integrations/[slug]`): aktive installationer, installeret/afinstalleret i alt, nye tilkoblinger og frakoblinger (graf op/ned), aktive installationer over tid, synkroniseringer, datapunkter hentet/sendt, fejlrate, til/fra-valg blandt forbundne, data gemt pr. type, seneste tilmeldinger/frakoblinger (med hvor længe brugeren havde den), median tid før frakobling og forbindelser i fejl.
- `Integration` holder kun nuværende status, så historikken gemmes i en ny tabel `IntegrationEvent` (CONNECTED, DISCONNECTED, SYNC, SYNC_ERROR, PUSH, SETTINGS_CHANGED, evt. antal datapunkter). Den skrives kun fra serverens egne integrationsruter (`src/lib/integrations/events.ts`), og en fejl i loggen vælter aldrig brugerens handling. Slettes med brugeren (cascade).
- Fornyet adgang på en allerede forbundet integration tæller ikke som ny installation. Telefon-integrationer (Apple Health/Health Connect) tæller som tilkoblet første gang appen melder sig.
- Migrationen giver nuværende forbindelser en CONNECTED-hændelse på deres tilkoblingsdato; allerede frakoblede får ingen (frakoblingsdato ukendt). "Afinstalleret i alt" tæller derfor rækker med status DISCONNECTED og en tilkoblingsdato.
- Admin ser brugerens e-mail i tabellerne (som på Brugere-siden); siden er kun for admins.
## 2026-10-02: Statistiksiden flytter sig aldrig under indlæsning

- Brugerens gemte rækkefølge (sektioner, kort, grafer) læses fra localStorage **før første billede males**: kort- og grafgitteret bruger den gemte rækkefølge som startværdi, når de tegnes i browseren (`useIsClientRender()` i `src/lib/use-client-render.ts`), og statistiksiden tegner sine sektioner først efter en layout-effekt har læst sektionsrækkefølgen. Det tidligere mønster "tegn standarden, skift efter mount" må ikke bruges på sider, hvor rækkefølgen er brugerens egen.
- `useSubscriptionTier()` husker det hentede niveau i modulet, så Seriøs-låste sider vises straks ved fanebytte i stedet for at starte tomme.
- `PremiumGate` har `renderWhilePending`: mens niveauet hentes, tegnes siden selv som skelet (design.md §6.14), og siden venter med datahentning via `usePremiumPending()`. Bruges kun af `/statistics` (undersiderne venter ikke på niveauet og vises derfor først, når det er kendt), så gratisbrugeres data stadig ikke hentes til låste sider.
- Kort, der først findes, når data er hentet (fx sportskort), tegnes som skitser i fuld højde i stedet for "ingen data" under hentning.
## 2026-10-03: Status og "Mål" står altid på samme linje i kalenderen

- Brugerkrav (gentaget, fordi det gik i stykker igen): statusbjælken
  ("Inden for målet" / "Målet ikke opnået" / "Intet registreret") står på
  samme linje som "Mål: X kcal" — status til venstre, mål til højre.
- `GoalStatusSummary` lægger derfor de to i én fælles flex-række. De må
  aldrig deles i separate blokke under hinanden; flammen ("+ N kcal") står
  over rækken og "Tilbage"/"Overskredet" under den, begge højrestillet.

## 2026-10-03: Forsidens puls fjernes bagfra, ikke med alpha-udtoning

Brugerens ord: pulsen skal begynde at forsvinde bagfra og frem, ligesom den kom frem fra venstre, og den må ikke nå at forsvinde helt, før et nyt pulsslag kommer. Det forrige fejs spor toner derfor ikke ud (ingen fælles alpha), men fjernes af det nye fejs spids med en blød bagkant. Pulsen slår fortsat i urets bpm med flere slag pr. fej (`pulseTrace`); et slag pr. fej med pause (PR #198) droppes.

## 2026-10-03: "Inviter familiemedlem" pr. mail med valg af indsigt

- Ejerens valg: invitationen sendes som **mail med link** (og koden). Betaleren vælger i et bundark, **hvilke profiler** personen får indsigt i (samme adgang som `FamilyAccessGrant`: se og taste ind). Ingen opdeling pr. dataområde.
- "Tilføj barn under 18" ligger som knap i arket og opretter en børneprofil (altid `isChild`), der derefter er valgt i invitationen.
- Invitationen genbruger de e-mail-bundne familiekoder (samme dag, ovenfor): `createFamilyInvitation` laver en kode til e-mailen og gemmer `inviteeName` og `grantSubjectIds` på den. `joinFamily` opretter tildelingerne til de valgte profiler, der stadig er med i familien. Kontoen skal stadig have præcis invitationens e-mail.
- Ejerens egen app-konto får Seriøs Familie (status ACTIVE, intet udløb, ingen udbyder) via migration; har kontoen en rigtig betalingsaftale, sættes kun planen. Administratorers familier dækker nu også medlemmerne.


## 2026-10-03: Slet/luk konto ligger nederst på Profil

Ejerens krav: "Mulighed for slet profil skal ned nederst under Profil-siden."

- "Ret til at blive glemt" og "Luk konto" vises nederst på `/profile/edit` (under Face ID), med samme bundark, SLET-bekræftelse og tekstlink-stil som før.
- Siden `/settings/account` (Indstillinger → Kontoindstillinger) er fjernet, så der kun er ét sted at slette/lukke kontoen. Afløser placeringen i beslutningerne 2026-10-02 og 2026-10-03 ovenfor.

## 2026-10-03: "Skift profil" er en række med buet op/ned-pil

Ejerens krav: "Hvis man er familiekontoejer skal 'skift profil' stå øverst og med punkt for sig selv under Profil. Og så en frem og tilbagepil som ikon — buet pil op/ned hvis muligt."

- `ProfileSwitcher` viser "Skift profil" som en række (samme mål som `ChevronRow`, chevron ned/op) i sit eget kort øverst på `/profile`; listen folder ud i samme kort.
- Ikonet er tegnet selv (`IconSwitchProfile`): to buede pile, op i venstre side og ned i højre. Tablers `IconRefresh` blev fravalgt, fordi den betyder "genindlæs" og allerede bruges til "Lær appen at kende".
- Den valgte profils store cirkel med navn og "Din egen profil"/"Du taster ind for denne profil" står under rækken og er ikke længere selv en knap.


## 2026-10-03: Fluebenene i kalenderen er signaturgrønne

- Brugerregel (gentaget): alle flueben for "inden for målet" i kalenderen
  (månedsgitter, uge-, liste- og dagvisning) bruger signaturgrøn
  `text-hf-green` (`--hf-color-brand`, #067A46) — aldrig `hf-lime`.
- `hf-lime` er ikke til flueben på lyse flader; det har for lav kontrast og
  er ikke projektets signaturfarve.
