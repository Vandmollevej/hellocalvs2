## 2026-10-17: Delte retter: "Alle retter" med endeløs scroll

- Trender og favoritter er valg under filtrenes Visning (til som standard), favoritter står på én linje, og under dem vises alle retter efter popularitet, tre rækker ad gangen med endeløs scroll. Web + native; ikke prøvet i browser eller kompileret native herfra (ingen lokal database, Android-plugin kan ikke hentes) — lint, typecheck, build og paritetsvagt er grønne.

## 2026-10-17: Trender netop nu er aldrig tom

- Aktive næringsfiltre tømte rækken for retter uden kendt næring; nu frasorterer kun allergener og kostretning dér. Rækken rangeres efter klik, derefter kildens popularitet (HelloFresh/Valdemarsro, gemt af importrobotterne) eller et fiktivt dagstal. Server-ændring, så web og native følger med. Se DECISIONS 2026-10-17.

## 2026-10-17: Forsiden læses igen af AI, når den aldrig blev læst

- Genåbningen læste kun forsiden igen, når varen helt manglede navn. Har den lokale tekstlæsning (eller den gamle reserve) givet et navn som "Letmælk", fik varen aldrig brand eller fritlægning. Nu genåbnes forsiden også, når der ingen FRONT-analyse findes (`repairRound` 3). Kreditten er bekræftet i orden (Uptime 17/10 06:01). Ikke prøvet mod rigtig database herfra.

## 2026-10-17: Forsidens grafer: Kalorier fordelt, pulskurve med zone-linje, ens stregtykkelse

- "Kalorier" og "Kaloriestatus" er slået sammen til én graf, "Kalorier fordelt": eget indtag pr. time som blå pinde, anbefalet energifordeling over dagen som grå streg (morgenmad ~20 %, frokost ~25 %, aftensmad ~30 %, mellemmåltider ~25 %).
- Puls er en blå kurve med en stiplet grå linje, hvor moderat intensitet begynder (64 % af maxpuls efter alder; 190 uden alder).
- Alle linjer og pinde har samme tykkelse (2 px). Nye vidensartikler: `energifordeling-over-dagen` og `anbefalet-puls` med kilder. Web + native; native er ikke kompileret lokalt.

## 2026-10-17: Google-nøglen skjules i robotternes logs

- image-agent skrev hele Google-nøglen i sin fejllog (requests' fejl indeholder adressen med `?key=`). Nu skjules `key=...` i alle log-linjer og i API-kaldslogningen; logo-agent har samme filter. Nøglen bør skiftes i Google Cloud, da den har stået i logs.
- Nøglen afvises af Google med `API_KEY_SERVICE_BLOCKED` (API-begrænsningerne tillader ikke Custom Search/Vision). Billed-robotten har derfor aldrig fundet billeder. Rettes i Google Cloud → API-nøgler.

## 2026-10-17: Stregkode-reserve

- Varer, hvor billederne hverken gav energi eller navn, får dem nu fra stregkodeopslaget (Open Food Facts), men kun når tallene passer med etikettens energital og navnet står på forsiden. Se DECISIONS 2026-10-17.
- Google Custom Search er blokeret for appens Google-nøgle (billed-robotten finder derfor 0 billeder). Skal tillades i Google Cloud → API-nøgler.

## 2026-10-17: Appens planlagte job kørte aldrig i produktion

- Rodårsag: `instrumentation.ts` lå i projektroden, men appen bruger `src/app`, så Next leder kun i `src/`. Standalone-imaget fik ingen instrumentation-fil, og `startScheduler()` kørte aldrig — ingen af appens job (`quick-enrichment-recovery`, `maintenance`, `back-photo-scan`, `frida-estimates`, `search-index`, `product-translations`, `api-alerts` …) havde `lastStartedAt` i produktion. Kun Python-agenterne kørte. Derfor blev fx Änglamark-letmælken aldrig repareret.
- Rettet: flyttet til `src/instrumentation.ts`; vagt-test `src/lib/instrumentation-location.test.mjs`. Første kørsel: 48-timers-eskaleringen mailer kun sager i vinduet 48–72 t (ellers 53 mails om gamle ventende varer).
- Bekræftet i produktion 05:47: alle app-job kører nu; letmælken blev læst færdig af recovery-jobbet (Änglamark — Letmælk Økologisk, 1,5 % fedt, 46 kcal/100). 2 eskaleringsmails sendt (vinduet virker).
- Søgemotoren: ét vare-id med "%c3%b8" fik hele Meilisearch-indekseringen til at fejle; ugyldige id'er kodes nu (`toDocId`/`fromDocId` i `src/lib/search-engine/meili.ts`, test `src/lib/meili-doc-id.test.mjs`).
- Scan-appen kørte også jobbene (samme image, færre nøgler); nu kører kun hoved-appen dem (`src/instrumentation.ts`).
- Også rettet fra et direkte push på master: manglende `}` i `prisma/schema.prisma` (buildet fejlede), genveje for `/admin/guides` og `/admin/warning-emails`, sidetræet og lint i advarselsmail-siden.

## 2026-10-16: Lokal genlæsning af gemte billeder

- Nye varer uden navn eller med 0 kcal rettes nu af serverens egen tekstlæsning af de gemte billeder — også mens OpenAI-kreditten er tom (fx Änglamark-letmælken). Ikke prøvet mod rigtig database herfra; afhænger af, at tesseract kan læse tabellen. Se DECISIONS 2026-10-16.

## 2026-10-16: Originalbilleder af alle trin

- Stregkode, forside, energi og indhold: hver optagelse gemmes ubeskåret (op til 4096 px) og kobles til varen (web; native alle undtagen stregkoden). Ikke prøvet på telefon herfra. Se DECISIONS 2026-10-16.

## 2026-10-16: Ingen tekst under forsidens grafer

- Brugeren vil ikke have teksten "For at kunne holde dig inden for dagens mål anbefaler vi at du …" eller forslagsarket under graferne. Fjernet i web (`FrontCharts.tsx`) og native (`HomeFrontCharts.kt`); graferne fylder pladsen. Gentag den ikke.

## 2026-10-16: Scannede fotos læses igen, når OpenAI-kreditten er tilbage

- Fotoene fra scanningen var gemt, men genlæsningen (`quick-enrichment-recovery`) brugte sine 3 forsøg og engangsreparationen, mens kreditten var tom, og opgav så varen (fx Änglamark-letmælken: intet navn, 0 kcal, råfoto). Nu står jobbet stille, så længe OpenAI melder tom kredit/afvist nøgle, og varer, hvis reparation blev brændt af, genåbnes én gang til (`repairRound` 2) og læses fra de gemte fotos, så snart kreditten er fyldt op. Ikke prøvet mod rigtig database herfra.
## 2026-10-16: Analyse → Søgning → Tale

- Ny fane "Tale" på Admin → Analyse → Søgning: hver brug af mikrofonen på Madvarer som en tidslinje. Hvert trin (hver søgning, mens der tales) viser det hørte, det der blev søgt på (efter fyldord/stavning) og de 5 øverste varer med billede og begrundelse i point (tekstmatch + populær i landet, tidspunkt, stregkode fra landet osv., samme point som Søgealgoritmer). Øverst: sådan læses og påvirkes det (Synonymordbog, Søgealgoritmer, Stavekontrol). AI-forslagene for hele sætningen vises i samme tidslinje med AI'ens egen begrundelse pr. vare (`reason` i `/api/ai/interpret-meal`) og om varen blev fundet i databasen eller er et skøn. Anonymt, gemmes 30 dage.
- Web + native sender `&voice=<session>` til `/api/products`, så længe søgefeltet står med det sagte. `src/lib/voice-search-log.ts`, `src/lib/search-explain.ts` (+ test), `VoiceSessions.tsx`. Visningen er prøvet med eksempeldata (skærmbillede); ikke prøvet mod rigtig database eller på telefon. Se DECISIONS 2026-10-16.
## 2026-10-16: Screeninger på det globale design

- Profil → Screeninger bruger nu `AccordionCard`/`ChevronRow` (web) og `HcAccordionCard`/`HcChevronRow` (native) i stedet for hardcodede rækker; `ChevronRow` har fået `value` (status før pilen). `ActionButton`/`ActionLink` er altid 48 px (Screeningrapporter-knappen var klemt).

## 2026-10-16: Energi-trinnet kræver aflæst energi

- Rodårsagen til de tomme varer: OpenAI-kontoen har ingen kredit (429 `insufficient_quota`) — skal fyldes op af brugeren. Energi-trinnet klares nu først, når energien er læst (telefonen, ellers AI mens man venter); ellers tages billedet om. Intet energiskøn på scannede varer. Web + native. Ikke prøvet på telefon herfra. Se DECISIONS 2026-10-16.

## 2026-10-16: Beløbsgrænse for API-varsler

- Under "Ret budget og varsler" på hvert kort i admin → API-forbrug: beløbet, hvor du vil advares om forbruget, og for OpenAI saldoen, du vil advares under. **Migration `20261016180000_api_alert_amount` skal med deployet.** Prøvet mod lokal Postgres (varsel sendes én gang). Se DECISIONS 2026-10-16.

## 2026-10-16: Admin → API-forbrug (alle betalte API'er, forside-widget og varsler)

- `/admin/openai` er blevet til `/admin/api-usage` ("API-forbrug", Alt+Shift+3): ét kort pr. betalt tjeneste — OpenAI, Google Places, Google Vision (logo-robotten), Google Custom Search (billedrobotten), Bria, Passio, SMS og Mailjet — med status, månedens forbrug og budget (rettes på kortet). OpenAI-detaljerne og kreditsaldoen står som før nedenunder.
- Forsiden i admin har en "API-forbrug"-widget. Varsler: til/fra, modtagerliste og testmail på siden; jobbet `api-alerts` (hvert kvarter) mailer ved fejl, lav OpenAI-kredit og 80 %/100 % af budgettet, hvert varsel én gang.
- **Migration `20261016170000_api_usage` skal med deployet**; image-agent og logo-agent genbygges af deployet. Prøvet mod lokal Postgres (tælling, budget, varsel sendes én gang, Python-tællingen). Ikke prøvet mod rigtige udbydere. Se DECISIONS 2026-10-16.

## 2026-10-16: Admin → OpenAI-forbrug

- Ny side `/admin/openai` (menu "OpenAI-forbrug", Alt+Shift+3): status på nøglen (et lille testkald hvert minut afslører "kredit brugt op" = `insufficient_quota`), forbrug i dag/7 dage/måned og fordelt på modeller, de sidste 30 dage og anslået resterende kredit. Forbruget kræver en OpenAI **admin-nøgle** (`OPENAI_ADMIN_KEY`, sættes på admin → API-nøgler). OpenAI har intet API til saldoen, så den skrives ind på siden, og forbruget derefter trækkes fra. Ikke prøvet mod rigtig OpenAI-konto her. Se DECISIONS 2026-10-16.
- Rettet på master: sidetræet manglede `/admin/quality-control/incomplete-images`, og knappen på siden brugte hjemmelavet stil (lint-fejl).

## 2026-10-16: Forsidens grafer uden tal i venstre side

- Ingen min/maks/0 i venstre side; kun det højeste tal står oven på den højeste pind/top (puls: dagens maks, kalorier: største pind, kaloriestatus: slutværdien, mål: højeste dagsindtag eller målet). Timetal og titel er 12 px (før 9 px). Kalorier: blå pinde (3 px) og den anbefalede fordeling som blå kurve. Graferne bruger nu hele bredden. Web + native; native kompileres kun i CI.

## 2026-10-16: Forsidens grafer smallere, målgrafen altid med

- Graferne slutter 36 px før skærmens midte (før 12 px), så de holder sig fri af tal-hjulets tekst. Målgrafen (kalorier pr. dag med den grå tværbar for målet og anbefalet min–maks) vises nu altid: uden et vægtmål med dato viser den de seneste 30 dage. Den tredje graf hedder "Kaloriestatus" (brugerens ord: anbefalet kalorieforbrug i grå mod den faktiske kaloriestatus i blå), og målgrafen hedder "Mål · dage/uger". Web + native; native kompileres kun i CI. Skærmbilledet fra brugerens iPhone så ud som om siden var zoomet ind (ca. 110 %), hvilket ikke kunne genskabes i Chromium.

## 2026-10-16: Mængdetallet trækkes vandret på produktsiden
- Det store tal i mængdefeltet (`/add/[id]`) er nu selv slideren: træk til siderne, nabotallene vises mindre/utydeligere på samme grundlinje, "g" skjules under trækket og kommer igen, når nabotallene er faldet ud. `DragNumberStrip` (web + native); den separate slider under feltet er fjernet. Testet i Chromium; ikke testet på telefon.

## 2026-10-16: Forsidens grafer i infoboksens plads

## 2026-10-16: Nye scannede varer står aldrig tomme

- Fejler OpenAI-aflæsningen af forside/energi, prøves den igen (straks og efter 10 min), med reservemodel; navn og brand udledes imens af telefonens tekst ("LETMÆLK" → Letmælk); ukendt energi vises som ukendt i stedet for "∼ 0" (skønnet er fjernet igen, se næste punkt); råfotoet fylder hele cirklen (web + native). Varer fra de sidste 14 dage uden navn/med 0 kcal repareres én gang. Ikke prøvet mod OpenAI/rigtig database eller telefon herfra — produktionens log viser den præcise OpenAI-fejl. Se DECISIONS 2026-10-16.

## 2026-10-16: Madvarer — favoritter øverst, lydbølgen tilbage, kamera i søgefeltet

- Favoritter står øverst i listen (server + web + native), lydbølgen under mikrofonen er tilbage, søgefeltet vokser med teksten, og kameraet i søgefeltet afløser "Scan nyt produkt"-knappen.
## 2026-10-16: Forsidens grafer i infoboksens plads
## 2026-10-16: Google Health synkroniserer af sig selv + kun én synk-popup

- Cloud-integrationer uden webhook (Google Health m.fl.) hentes nu ved hver åbning af appen (`api/integrations/app-open`, højst hvert 15. min.) og i eget baggrundsjob `integration-sync` (hvert 15. min., 2 min. tidsgrænse pr. integration). Før lå hentningen sidst i Vedligehold, hvor en fejl/et langt trin tidligere i kørslen kunne stoppe den i dagevis.
- "Ikke synkroniseret"-popuppen i layoutet bruger nu samme bundark som vægt-popuppen og springer integrationer med vægt over (vægt-popuppen tager dem), så samme spørgsmål ikke kommer to gange. Web + native. Native kompileres kun i CI. Se DECISIONS 2026-10-16.

## 2026-10-16: Forsidens grafer i den hvide boks' plads

- Graferne (puls, kalorier, anbefalet mod indtag, målsætning) står uden baggrund, hvor den hvide infoboks stod, modsat tal-hjulet: fra kanten ind til boksens gamle højre/venstre side og fra boksens top til dens bund (højden deles ligeligt mellem graferne). Heroens højde (top til skillelinjen) er uændret.
- Graferne står i boksens plads med luft imellem, titel i midten på alle og "kl." foran venstre timetal. Under graferne brugerens originaltekst ("For at kunne holde dig inden for dagens mål anbefaler vi at du forbrænder X kalorier", tallet stort på egen linje, "eller reducerer kalorieindtag med … og forbrænder …"); tryk åbner forslagsarket (gåture, mad, Hello Fresh). Kalorie-grafen samler pr. time, så den anbefalede kurve ses ved siden af måltiderne.


## 2026-10-16: Lidl/Aldi-berigelse (lokalt script på brugerens pc)

- `scripts/lidl-aldi-enrich/`: stregkode → titel (Open Food Facts) → Google Vision kun ved 0 resultater; nye fakta i et Excel-ark ved siden af vores titel. Natlig kørsel via Windows-opgave (`install-task.ps1`, `git pull` hver nat), ingen admin. Står under Robotter/Cron-jobs som `lidl-aldi-enrich`, slået fra. Enhedstests (8), tsc, eslint og `npm test` grønne. Ikke kørt mod brugerens rigtige filer: kolonnenavne og stier skal prøves med `--inspect` og `--limit 20`. Se `docs/LIDL-ALDI-ENRICH.md`.

## 2026-10-16: Cirklen bagt ind i produktbilledet på hjemmesiden

- Fritskrabede varebilleder på varesiden (kun web) leveres med cirklen bagt ind (`/product-circle`), så billedet ikke kan hentes uden cirklen. Cirklens proportioner er uændrede; billedet vokser i højde/bredde ved overlap. Native uændret. Ikke prøvet i browser/mod rigtig database her (kun renderingen testet med syntetiske billeder). Se DECISIONS 2026-10-16.
## 2026-10-16: Tale forstår hele sætninger

- Madvarer: Tale-sidens funktion er tilbage uændret — det sagte tolkes af AI'en til forslag med mængde ("to skiver franskbrød med smør og marmelade" → tre forslag), Foreslået/Tilføjet, swipe, dagens liste huskes. Web + native. Native kompileres kun i CI; ikke prøvet på telefon. Se DECISIONS 2026-10-16.

## 2026-10-16: Tale finder varen

- "Jeg har spist en bakke pomfritter" via mikrofonen søges nu som "pomfritter" (web + native, ændret i søge-API'et). Se DECISIONS 2026-10-16. Desuden rettet: admin-siden Ufuldstændige billeder manglede i sidetræet, og dens knap brugte egen stil (rød `npm test`/lint på master).

## 2026-10-16: Tale-siden flettet ind i Madvarer

- Madvarer har nu den store mikrofon (samme størrelse og udseende som før på Tale-siden) over søgefeltet. Mens man taler, skrives det sagte løbende i søgefeltet, så listen søges og raffineres i realtid; ingen ventetid på en transskription bagefter. Sprogflaget ligger i venstre hjørne. `/voice` sender videre til `/foods?mic=1` (mikrofonen starter), og "Mikrofon" i Tilføj-menuen åbner Madvarer. Web: `src/lib/use-live-speech.ts`, `LiveMicButton`; native: `FoodsScreens.kt`. Native kompileres kun i CI; ikke prøvet på telefon. Se DECISIONS 2026-10-16.

## 2026-10-16: Forsidens grafer rullet tilbage

- PR #463 (grafer over infoboksen) er rullet tilbage efter brugerens melding om, at forsiden var ødelagt: graferne skubbede tal-hjul og dagens liste ud af skærmen, puls-linjen lå hen over graferne, og siden fik rulning og en handlingsboks, brugeren ikke havde bedt om. Infoboksen og den gamle forside er tilbage (web + native).

## 2026-10-16: Screening af ufuldstændige Lidl/Aldi-billeder

- Kun pc-scriptet `scripts/image-screen` (CSV-rapport, intet på NAS'en). NAS-jobbet, admin-fanen og tabellen er fjernet igen. Se DECISIONS 2026-10-16.

## 2026-10-16: Frida-skøn straks på varesiden

- Varer uden energimærkning får Fridas tal, så snart varesiden åbnes (ikke først om natten). Se DECISIONS 2026-10-16. Ikke typetjekket/kørt lokalt (node_modules mangler).

## 2026-10-15: Kameraet direkte i opdater-banneret

- Trækkes "Optjen X points …" ned, står kamerasøgeren nu i selve dropdownen (web: `UpdateCameraPanel`, automatisk udløsning + udløser), og fotoet læses på stedet; varen hentes igen bagefter. Ingen ny side og ingen gammel "Tag billede"-side længere. Native åbner telefonens kamera direkte fra boksen. Favoritikonet ligger ikke længere oven på dropdownen. På hjemmesiden (desktop) vises banneret ikke, da den ikke tager billeder. Ikke prøvet på telefon her; native-koden kompileres kun i CI. Se REGLER.md.

## 2026-10-15: Billeder loader hurtigere

- Billeder vises som nedskalerede WebP-udgaver via `/_next/image` (`imageThumb`, web + native) i stedet for originalerne (logoer op til 15 MB), og originalerne caches i browseren (1 time + ETag/304). Ikke målt mod produktionen herfra (ingen adgang til hellocal.io). Se DECISIONS 2026-10-15.

## 2026-10-15: Varetypen spørges direkte + banneret glider

- Ingen varetype på forsiden → OpenAI spørges "Hvilken produkttype er <brand subbrand variant>?", før varen hedder brand + subbrand. Vedligeholdet spørger én gang for scannede varer, der allerede hedder brand + subbrand (fx Verpoorten → Eierlikör, vist som Æggelikør via oversættelsen). Migration `20261015190000_product_type_asked`. Ikke prøvet mod OpenAI/rigtig database her.
- Opdater-banneret glider op og ned (300 ms) i stedet for at smække (web + native). Ikke prøvet på telefon her. Se DECISIONS 2026-10-15.
- Ny robot "Varer: alkoholnæring" (`alcohol-nutrition`, admin → Robotter, hvert kvarter): scannede alkoholiske drikke med 0 kcal (fx Verpoorten) får alkoholprocent og næring skønnet efter type — ingen ny scanning; registreringer med 0 kcal følger med.

## 2026-10-15: Udrulningerne — kun den nyeste

- Ud over concurrency-gruppen (#444) springer deploy-jobbet over, når serveren allerede kører en nyere commit ("Skip stale release"), så en ældre commit aldrig rulles ud oven på en nyere. Se DEPLOYMENT.md.

## 2026-10-15: Alkoholprocent og kalorieskøn for spiritus

- "20 % vol" læses nu (lokal OCR først, ellers AI på for- og bagside) og gemmes på varen. En ny alkoholisk drik uden næringstabel får sit kalorietal regnet ud: alkoholen præcist, resten skønnet ud fra varetypen (∼). Varer fra før rettelsen får det af robotten `alcohol-nutrition` (se ovenfor). Ikke prøvet mod OpenAI/rigtig database her. Se DECISIONS 2026-10-15.

## 2026-10-15: Opdater-banneret uden fotoknap i striben

- Den lukkede stribe øverst på varesiden viser kun teksten ("… ved at opdatere med et flot nyt billede" på Open Food Facts-varer, ellers "… ved at opdatere varen"); fotoboksene kommer først, når den trækkes ned. Web + native. Ikke prøvet på telefon her. Se DECISIONS 2026-10-15.

## 2026-10-15: "Har du fundet en fejl?" på alle varer

- Knappen nederst på varesiden vises nu altid (web + native), også på generiske varer, varer uden stregkode og egne varer. Fejlrapporter på generiske varer knyttes via `bug_reports.genericIngredientId` (migration `20261015180000_bug_report_generic_ingredient` skal med deployet). Se DECISIONS 2026-10-15.

## 2026-10-15: Oversat-linjen over ingredienslisten

- Ændrer oversættelsen kun ingredienslisten (titel, variant, mængde m.m. er ens), står "Oversat til dansk fra svensk. Vis original" over ingredienslisten i stedet for over titlen; ændrer den intet, vises ingen linje. Web + native. Se DECISIONS 2026-10-15.

## 2026-10-15: Aldrig "Vare <stregkode>" som titel

- "Vare" + nummer vises aldrig, heller ikke under oprettelsen: en ny vare har tomt navn (skeleton), til forsiden er læst; står varetypen ikke på forsiden, navngives den (Eierlikör), ellers brand + subbrand; varianten står på den grønne linje. Eksisterende varer med reservenavnet omdøbes efter deploy og hver nat. Ikke prøvet mod rigtig database her. Se DECISIONS 2026-10-15.
- Opfølgning: Verpoorten (40157818) hed stadig "Vare 40157818" efter deploy — engangsoprydningen sprang varer over, hvis navn hang som ventende, og AI-kaldet havde ingen tidsgrænse. Nu: oprydning hvert kvarter (også ventende navne efter 30 min, som så ryddes), 60 s tidsgrænse på tekstkaldet, og varesidens API viser aldrig reservenavnet (brand + subbrand i stedet).
- Opfølgning 2: Verpoorten fik stadig ikke varetypen. Varer, der kun hedder brand (+ subbrand), springes ikke længere over, når forsideaflæsningen gav et navn eller mangler; et fejlet AI-kald markerer ikke varen som spurgt; alle varer spurgt før 2026-10-15 17:30 UTC spørges én gang til, og varesiden starter spørgsmålet i baggrunden, når varen vises.
- Opdater-banneret ("Optjen X points …") foldes sammen, når varesiden scrolles nedad, og ud igen ved toppen (web + native). Se REGLER.md.

## 2026-10-15: Lange brand-/subbrandnavne brydes ved produktcirklen

- Varesiden (web + native): brand- og subbrandnavne i tekst brydes i flere linjer i stedet for at gå ud over sidens kant (fx "Barbeque Buddies" over Johnny's). Se REGLER.md.

## 2026-10-15: AI'en kan ikke længere opfinde brands

- Et ukendt brandnavn fra AI'en oprettes kun ud fra et sikkert, helt synligt logo (`newBrandAllowed`); ellers intet brand og `brand_unknown_skipped` i loggen. Forsiden, stregkode-logoet og eksterne billeder. Se DECISIONS/REGLER 2026-10-15.

## 2026-10-15: Tilføj-kameraets forsidefoto = søgerens kvadrat

- Forsidefotoet blev gemt som hele 9:16-kamerabilledet, mens søgeren kun viste midterkvadratet, så varen så langt væk ud bagefter og fik færre pixels til OCR. Nu er alle fotos præcis det, søgeren viste (kun web; native bruger telefonens kamera). Ikke prøvet på telefon her. Se DECISIONS 2026-10-15.

## 2026-10-15: Import fra anden app — indgang, side pr. app og startguide

- Indstillinger → Import (web, app og webmenu) med tekst, "Kontakt os" (kontaktformularen udfyldt) og knapper til MyFitnessPal og Lifesum; hver knap åbner optage-/uploadsiden for netop den app (`/settings/import/[provider]`). Startguiden slutter med "Har du allerede en konto hos en anden udbyder?" Importér nu / Senere. Se DECISIONS 2026-10-15.

## 2026-10-15: HelloFresh fra alle 17 lande

- Importen henter fra alle HelloFresh-lande og gemmer land (`products.market`) og sprog på hver ret; brugeren ser sit eget lands retter. Migration `20261015170000_product_market`. Ikke prøvet mod de udenlandske HelloFresh-sider (ikke tilgængelige herfra): se admin → Robotter efter første kørsler. Se DECISIONS 2026-10-15.

## 2026-10-15: Varens sprog — trin 3

- Søgeforslag viser kun varer på brugerens sprog/engelsk/landets stregkoder; andre sprog kun når der ellers intet er. Natligt job `product-translations` oversætter på forhånd; sprogrobotten `language-local` (lingua) retter sproget på scannede/OFF-varer. Migration `20261015160000_product_language_checked`. Ikke prøvet mod rigtig database her. Se DECISIONS 2026-10-15.

## 2026-10-15: Varens sprog — trin 2

- Dagbog, favoritter og mest brugte viser varens navn på brugerens sprog (`localizedProductNames`); Open Food Facts gemmes på originalsproget (valg A, `translate-da.ts` fjernet); importerede kilder (ark, Frida, butikker, HelloFresh) oversættes ikke endnu (`TRANSLATE_IMPORTED_SOURCES`). Regel i AGENTS.md/REGLER, så nye skærme følger med. Trin 3 (søgefilter, natligt job, sprogrobot) står tilbage. Se DECISIONS 2026-10-15.

## 2026-10-15: Bagsidebilleder — OCR først, ordbog før AI

- Ny robot `back-photo-local` læser bagsidebillederne lokalt (tesseract + mærkesøgning); nattens `back-photo-scan` spørger kun OpenAI, når intet mærke blev fundet lokalt. Ordbogen retter sikre stavefejl; tvivlsomme ord vurderes af AI og bliver forslag. Se DECISIONS 2026-10-15.

## 2026-10-15: Varens sprog og oversættelser — trin 1

- `products.language` + tabellen `product_translations` + `users.translateForeignText` (migration `20261015130000_product_language`). Kolonnerne er originalen og overskrives aldrig. Sproget fra kilden (`src/lib/product-language.ts`, 8 tests), oversættelse ved behov (`src/lib/product-translations.ts`), vedligeholdet udfylder sprog for eksisterende varer.
- Varesiden (web + native): oversat til brugerens app-sprog med "Oversat til dansk fra kinesisk. Vis original" over titlen; Indstillinger → Visning → Oversættelse (slået til som standard, web + native + webmenu).
- Ikke prøvet mod rigtig database/OpenAI her: åbn chiliglasset (bør vise dansk + linjen), en dansk Bilka-ost (ingen linje) og tryk "Vis original". Trin 2–3 og OFF-spørgsmålet: se DECISIONS 2026-10-15.

## 2026-10-15: Admin → Varer → Generiske produkter

- Ny adminside til generiske produkter: opret manuelt med hjælpetekst, importér CSV/Excel (arkets kolonner) med fejl pr. række før bekræftelse, søg/filtrér, ret og slet. Brugte produkter skjules i stedet for at slettes, så registreringer bevares. Migration `20261015140000_generic_ingredient_admin` skal med deployet. Prøvet mod lokal Postgres med det rigtige ark: 1.285 af 1.327 rækker oprettes; 41 rækker har samme Titel (ental) som en anden række i arket og springes over som dubletter. Se DECISIONS 2026-10-15.

## 2026-10-15: Originalbilleder online før AI-billedarbejde; AI-rentegning af logoer

- Produktbilleder: robotten `product-image-search` (logo-agent) søger hver nyscannet vare online med Google Vision, før kamerafotoet fritlægges; fundene står under Billedforslag ved siden af kamerafoto og udklip.
- Logoer: findes intet fritlagt logo online, rentegner gpt-image-1 originaludklippet med brugerens prompt; vises under Logoer ved siden af originalen. Scanningens udklip sættes ikke længere selv som logo.
- Udestående: følg admin → Robotter og Billedforslag/Logoer efter deploy.

## 2026-10-15: 2-års kvalitetstjek — varer over to år fremstår som nye ved scanning

- En vare, der har ligget i databasen i over to år, fremstår som ny, når en indlogget kunde scanner den: kameraet tager forside, energi og indhold (web + native), kunden får varens tidligere info med det samme, og fotoene gemmes kun. Om natten sammenligner intern AI (`recheck-local`, DINOv2 i quality-control-agent, 02:15) det nye foto med originalen; OpenAI spørges kun, når den lokale sammenligning er i tvivl. Jobbet `product-recheck` (02:40) læser energi/indhold (telefonens OCR først) og sender ændringer til admin → Nye varer → "2-års tjek" (tælles med på forsidens "Nye varer") med originalen og det nye foto side om side, det nyeste valgt som standard. Billedet fritlægges først efter admins ja, om natten. Nye tal gælder kun registreringer fra og med scanningen; historikken røres ikke. Migration `20261015120000_product_recheck` skal med deployet, og quality-control-agent skal genbygges. Prøvet mod lokal Postgres. Se DECISIONS/REGLER 2026-10-15.

## 2026-10-15: Mærkat-jobbet — intern AI først

- Ny robot `label-local` (quality-control-agent) søger forsidefotos lokalt igennem for kendte logoer og mærketekster; `label-scan` spørger kun OpenAI, når intet blev fundet lokalt. Se DECISIONS 2026-10-15. Kvalitetskontrollens forkerte kolonnenavne er rettet.
- Udestående: følg admin → Robotter efter deploy ("Mærkater: lokal søgning" og "Mærkater: AI-aflæsning" viser antal lokalt/OpenAI).

## 2026-10-15: Skelet-glimtet gjort tydeligt

- Skelet-fladerne (fx produktnavnet, mens det læses, og produktcirklen uden billede) var animerede, men glimtet var så bredt og svagt, at de så statiske ud. Glimtet er nu et smallere, lysere bånd (`#FBF9F5`), der løber fra venstre mod højre og ses ca. 80 % af tiden — ca. 55 % stærkere kontrast. Web + native (`HcSkeleton` løb før fra højre mod venstre). Se REGLER 2026-10-15.
- Varesiden: mens brandet læses, står en glimtende boks på brandets plads ved cirklen (brand/subbrand skjules), og den grønne linje (størrelse · variant) er en glimtende boks, mens navnet læses.

## 2026-10-15: Ubeskårne bagsidebilleder + natlig engangsanalyse

- Energi/indhold tager nu også hele kamerabilledet (ubeskåret, op til 4096 px) og uploader det under flowet (`POST /api/products/back-photos`, tabel `product_back_photos`). Serveren gemmer det byte for byte (kun metadata fjernet).
- Ny robot `back-photo-scan` (04:20): ét AI-kald pr. billede, præcis én gang. Mærkninger fra bagsiden → `product_labels` + tomme filtre. Finlæst ingrediensliste/næring/øvrig tekst gemmes. Forskelle mod varens ingrediensliste → forslag under Stavekontrol ("Finlæsning af bagsidebillede").
- **Migration `20261015070000_product_back_photos` skal med deployet.** Prøvet lokalt mod Postgres med falsk OpenAI-svar: kobling før/efter oprettelse, mærke gemt uden at forsidens label-scan markeres, to staveforslag (SOIASAUCE→SOJASAUCE, krydderler→krydderier), anden kørsel analyserer intet igen. Native ikke kompileret lokalt (CI "native").

## 2026-10-15: Tilføj-kameraet — fotoet i trykøjeblikket, forlæsning, synlig behandling

- Udløseren tager nu fotoet i trykøjeblikket, og trinnet er klaret med det samme. Før blev energi-/indholdsfotoet først taget efter 1–3 s lokal OCR.
- Forlæsning, mens man sigter: forsidetekst (dublet + kendt mærke), næringstabel og ingrediensliste læses løbende i baggrunden uden tekst på skærmen (brugerens krav 2026-10-15: ingen "Læser teksten …" eller fund-pille). Udløseren bruger fundene.
- Synlig behandling: load-cirkel på trinnets knap + "Behandler billeder: …" under kameraet; `PhotoWorkingOverlay` skriver sin tekst synligt. Overskrifterne hedder "Tag billede af energi/indholdsfortegnelsen".
- Web `ProductCaptureFlow.tsx`, `HfLoader.tsx`, `product-capture.ts`, `/api/products/recognize-text`. Native kun tekster + dokumentation (ingen levende video). Se DECISIONS/REGLER 2026-10-15.

## 2026-10-15: Forsidefotoet blev "halveret" — beskæring efter AI-boks fjernet

- Tilføj-kameraet beskar forsidefotoet til gpt-4o-mini's objektboks, som var for smal og forskudt (DAGO-posen skåret midt over). Nu bruges altid hele rammen; objektgenkendelsen afviser kun billeder uden vare. Ny vagt-test `src/lib/front-photo-never-cropped.test.mjs`, og serveren logger et smalt/lille forsidefoto som `front_image_suspect` i admin → Log. Native beskar aldrig. Ny natlig robot `front-image-check` (04:50) finder de beskårne billeder (form + loggen) og sender varerne til scan-appens "Skal scannes", hvor det nye forsidefoto erstatter dem. Migration `20261015060000_front_image_suspect` skal med deployet. Prøvet mod lokal Postgres. Se DECISIONS/REGLER 2026-10-15.

## 2026-10-15: Tilføj-kameraet — mørkegrønne flueben, ingen overstreget linje

- Fluebenene på trin-knapperne, opret-sidens fotobokse og i "trin klaret"-animationen er nu mørk signaturgrøn (`--hf-color-brand`) i stedet for den lysegrønne, som ikke kunne ses. Den blivende overstregede linje over trin-overskriften er fjernet; overskriften står alene. Web + native. Se REGLER 2026-10-15.

## 2026-10-15: Brandet "DAGO" på Nettos ØGO-pose — årsag og rettelse

- Forside-AI'en fik de første 750 brands alfabetisk som støtteliste; med ~3.000 brands sluttede listen ved "Dr. Oetker", så ØGO aldrig var med. Logoet var desuden delvist skåret af, og AI'en gættede "DAGO" (findes ikke i OFF-ordforrådet). Kendes navnet ikke, oprettes det som nyt brand, så "DAGO" ligger nu i Brand-tabellen.
- Rettet: `src/lib/known-brands.ts` giver de faste danske kædemærker (`PINNED_BRANDS`: ØGO, Salling, Coop 365, Änglamark, REMA 1000, First Price, Lidl-mærker …) først og derefter de mest brugte brands til forside-, stregkode- og natlig genkørsel. De faste mærker oprettes i Brand-tabellen, hvis de mangler, og ØGO (3 tegn) kan nu også findes i forsideteksten. Prompten front-v5 forbyder at gætte et delvist logo færdigt ud fra listen og nævner æ/ø/å.
- Varen 5712872629689 (og alle andre "DAGO"-varer) er flyttet til ØGO med migration `20261015150000_oego_brand_fix`, som også sender varen til scan-appens "Skal scannes" med det samme (beskåret forsidebillede, kan ikke genskabes — forsiden skal tages om). Det tomme brand "DAGO" slettes i admin → Brands. Prøvet mod lokal Postgres (alle migrationer, to kørsler).

## 2026-10-15: Ø-mærket på produktcirklen — helt, mindre og på linje

- `public/certifications/oekologimaerket.png` var et beskåret udsnit (400×160), der blev 75 px bredt og skåret af foroven/forneden. Udskiftet med det komplette Ø-mærke (Open Food Facts-SVG, transparent, 421×400) — står nu ca. 32×30 px med bunden i cirklens bund. Native henter samme fil fra serveren. Regel i REGLER.md.

## 2026-10-14: Stavekontrol-robot og admin → Stavekontrol

- Natlig robot `spelling-check` (04:15, app-job) + fælles stavemotor + side `/admin/spelling` med flueben, dropdown ("Accepter rettelser" …), original sammenhæng med fremhævet ord, forslag og "Min rettelse". Ordbogen lærer af katalogets ordforråd og admins afgørelser. Migration `20261014230000_spelling_robot` skal med deployet. Prøvet lokalt mod Postgres (alle migrationer, robot, godkend/afvis/fortryd/egen rettelse, læring, 20.000 lister) og i browser. Se DECISIONS/REGLER 2026-10-14.

## 2026-10-14: Ingredienslistens kvalitetskontrol

- Nyt `src/lib/ingredient-text-quality.ts` + test: "£202" → "E202", dansk "soya" → "soja", OCR-ord ("SOIASAUCE", "SFSAMFRØ", "krydderler", "cltronsyre") rettes mod en ordliste, næringstabellen ("Fnergi" …) skæres fra; tegn på fejllæsning afviser telefonens liste og sender AI'ens til admin → Usikkerheder (≤ 60 %) og Log. AI-prompt v2. Gamle lister vises rettet (web + native), databasen er uændret. Se DECISIONS/REGLER 2026-10-14.

## 2026-10-14: Tilføj-kameraet hang ved oprettelsen — rettet

- Oprettelsen har nu 60 s tidsgrænse; ved fejl/timeout slås stregkoden op, og findes varen, går flowet til den (`product_create_recovered`). Kameraet og billedanalysen slukkes under oprettelsen; forsidefotoet står bag "Opretter varen …" i stedet for et sort kamera. Web + native.
- Versionsvagt: `NEXT_DEPLOYMENT_ID` = commit-sha i Docker-buildet, så en gammel fane genindlæses ved næste sideskift (brugerens fane kørte koden fra før PR #404). Se DECISIONS/REGLER 2026-10-14. Ikke prøvet på iPhone her.

## 2026-10-14: Tilføj-kameraet — udløser på fototrinnene, "Spring over", større flueben, intet ImageCapture på iPhone

- Stregkoden som før; forside/energi/indhold tages nu med udløserknappen nederst i kamerabilledet (ingen automatisk scanning, intet tryk på billedet). "Spring over" til højre for udløseren på trin 4. Fluebenet på trin-boksene: lysegrønt, uden baggrund, 48 px. Web `ProductCaptureFlow.tsx` + native `ProductCaptureFlow.kt`/`CameraParts.kt`.
- Sort kamera på iPhone: `ImageCapture.takePhoto` slås fra på WebKit (hænger og fryser videoen); fotoet er det skarpeste af tre 4K-videobilleder. Ny `src/lib/camera-webkit.ts` + test.
- Produktsiden viste allerede felterne løbende (poll på `pendingFields`, parallel AI-læsning) — ingen ændring.
- Lint 0 fejl, 398 tests, tsc, build (404 ruter) og native-paritet grønne. Ikke prøvet på telefon her (ingen enhed): brugerens test på iPhone af (1) at kameraet ikke bliver sort efter energi-trinnet, (2) udløseren på trin 2–4, (3) "Spring over" på trin 4.

## 2026-10-14: Scan-appen — manuel udløser med Bluetooth-trigger sikret

- Gennemgået: scan-appen (`/scan`, `/scan/opret`) bruger telefonens eget kamera via filfelt med `capture="environment"` i hyldebilledet og alle fire bokse; intet automatisk kamera, stregkoden læses af fotoet. Bluetooth-udløser virker derfor via kamera-appens egen udløser. Ingen kodeændring nødvendig.
- Ny vagt-test `src/lib/scan-app-manual-capture.test.mjs` + regel i REGLER.md ("Scan-appen: manuel udløser") og DECISIONS 2026-10-14. Ikke prøvet med fysisk Bluetooth-udløser her (ingen enhed) — brugerens test på telefon.

## 2026-10-14: Tilføj-kameraet efter brugerens mælketest — trin-visning, mindre felt, auto-valg, vagthund

- Nummererede trin med stor overskrift (`ScanHeading`), "trinnet er klaret"-visning med hvidt blink, overstregning og stort flueben (`StepDoneOverlay`) på alle trin, også stregkoden ved ukendt vare. Stregkode-/energi-/indholdsfeltet er lille med resten af billedet mørkt; forsiden beholder hele rammen.
- Ved flere varer i forsidebilledet vælges den i rammens midte automatisk (`pickObjectInFocus` + test); det frosne billede med grønne cirkler er væk fra Tilføj-kameraet. Stregkodefotoets baggrunds-OCR klarer ikke længere energi/indhold.
- Sort kamera på iPhone: `useCameraWatchdog` logger sporets pause/stop, baggrund/forgrund og et helt sort billede i admin → Log og genstarter kameraet (højst tre gange); lærreder genbruges i `camera-still.ts`/`product-outline.ts`. Brugerens konkrete sorte kamera kunne ikke læses ud af loggen herfra (ingen adgang til produktions-DB, og tilstanden blev ikke logget før nu).
- Anden runde (bukseben/tekst/tag om): forsidebilleder uden tekst og uden vare afvises med besked; "Kan ikke læse teksten" på energi/indhold; tesseract-arbejderen genstartes efter fejl; tag om ved tryk på et trin med flueben, Stregkode = forfra; energi/indhold-feltet 60 % med 65 % mørkt.
- Flettet via PR #404 som e44c1e9; "Build and deploy" #721 grøn (app, migrationer, robotter) kl. 17:27 dansk tid. Native bygget grønt i CI (Android + iPhone). Se DECISIONS/REGLER 2026-10-14. **Brugerens test på telefon:** stregkode → blink + "1. Scan stregkode" overstreget → "2. Tag billede af forsiden"; energi/indhold-feltet; at kameraet ikke længere bliver sort (ellers: admin → Log → Scanninger → `camera_black`/`camera_muted`).

## 2026-10-14: Logo-robot — numpy-fejl ved gem rettet

- Robotten (`hellocal-v2-logo-agent-1`) fejlede for hvert brand med kandidater: `schema "np" does not exist`, fordi `visual_similarity()`/`confidence` var `np.float64` (numpy 2 + psycopg2). Nu rene `float` ved kilden og eksplicit cast af alle SQL-parametre i `process_brand`. `import_logos.py` er uændret. Regressionstest `scripts/logo-agent/test_agent.py` (fejler på gammel kode, grøn på ny). Se `docs/LOGO-AGENT.md`.

## 2026-10-12: Adminadgang tilgængelig — visuel opfølgning i gang

- Brugeren melder "Nu virker det"; admin.hellocal.io/admin er indlogget, så den tidligere adgangsblokering er væk.
- Root kontrollerer live-sider og fælles kontrolklasser; den anden agent har source-kontrolleret 33 adminsider. Subagentens CUA har ingen browser-surfaces, så den udfører ikke den visuelle kontrol.
- Kilde/live-kontrollen fandt 29 native checkbox/radio/file-kontroller uden fælles rolleklasse samt tre faste grafegenskaber. Disse samles med identisk appearance; Toggle og Apple-preview er forskellige og bevares.
- Statistikfiltrene i StatsFilters og Analyse → Søgning bruger nu hf-btn--compact. Den lokale 14/20 px typografi er normaliseret til klassens 15/22 px; 40 px minimumshøjde, 12 px vandret padding, farvestates og handlers er bevaret.
- Browserkontrol har timeouts på nogle billedtunge sider. De sidetyper erklæres ikke visuelt godkendt på grundlag af en loading-visning.
- Visuelt kontrolleret live: adminoversigt, varegodkendelser, produkt-/brand-/labeloversigter, OFF-import og OFF-billeder, alle fem retoversigter, flows, guide-builder, sidetræ, statistik/søgning, integrationer, økonomi, Hello Doc, bruger-/points-/personaoversigter, chatbot, testprogrammer, fejlrapporter, support/skabeloner, cron, dyrefoder, passkeys, beskedautomatisering, søgeopsætning, vejning, genveje, scan-kontrol, jobs/agenter/robotter, adminbrugere, partneroversigter, roadmap, Claude og log. Ingen dokument-overflow ved 1280 px; brede tabeller har egen scroll. Samlet produktbilledside får fortsat browserkontrollen til at time out og er ikke visuelt godkendt.
- Native kontrolfixture: 242 elementpar × 35 beregnede CSS-egenskaber ved faktisk 402 og 1440 px uden forskelle. Lint: 0 fejl/12 eksisterende advarsler; build: 403 ruter grøn efter gentagelse med adgang til eksisterende Google-fonte. Native sync/paritet grøn; ingen native layoutændring.
- Brugeren bekræfter eksplicit, at Face ID er løst. Enhedssporet lukkes uden flere reproduktionsspørgsmål; root har ikke selv udført biometrisk dialog.
- Sidste source-kontrol tilknytter også tre native sliders til hf-native-choice med uændrede bredder, accentfarver og events. Samlet 32 native kontroller: 18 checkbox, to radio, tre range og ni file. 15 inputs uden appearanceklasse på adminbrugere/roadmap/log/agenter er bevidste hidden-formularparametre. API-nøgler er kun DOM-/klassekontrolleret uden nøgleaflæsning; designmanual er visuelt kontrolleret.
- Opfølgning: samlet produktbilledside er nu visuelt kontrolleret via direkte screenshot uden stort AX/DOM-træ. De to uploadkolonner, overskrifter, kontroller og synlig uploadhistorik er indlæst korrekt; tidligere timeout er en kontrolbegrænsning, ikke dokumentation for en produktfejl. Uafhængigt slutreview af cb6c0ce1 fandt ingen konkrete regressioner.

## 2026-10-12: Fælles CSS-klasser — flettet og deployet

- Koden er flettet i PR #401 som 5e0414b5. Build/deploy #715 og masterens native #856 er grønne, inklusive Android og iPhone. Hovedmappens ændringer er bevaret; dokumentation afsluttes på codex/css-slutkontrol-20261012 i worktrees/github-samling.
- Gentagne formularer, tabeller, kataloggitre, kamera-/rapportflader, social login, tilføj-labels og widget-preview er samlet i globals.css. 428 identiske småtekster bruger den eksisterende hf-type-caption.
- Marketing har egne mk-type-*, mk-input og butiksknapklasser. WebShell, mobilens bundmenu og platformernes preview-geometri er fortsat adskilte.
- Før/efter-fixtures: 672 elementer uden forskelle i 39 beregnede stilegenskaber ved 402 og 1440 px indholdsbredde; fire felter også kontrolleret med tastaturfokus. Ingen ændret produktadfærd i CSS-refaktoreringen.
- Face ID: midlertidige loginfejl må ikke slette enhedsmarkeringen; allerede-oprettet nøgle kræver serverbekræftet reauth. Seks regressionstests grønne. Brugerens konkrete enrollmentfejl er ikke reproduceret; afventer berørt platform/fejl.
- Talhjulets font/text-box, captions og nået-mål-farve samt lydsøjlernes startform bruger nu klasser; geometriparametre og lydanimation bevares. Fem ekstra før/efter-tilstande er grønne ved 402/1440 px. PR #401 indeholder hovedrefaktoreringen og sidste klasseopfølgning. Afsluttende lint/build og native-paritet er grønne.
- Slutgennemgang har fjernet resterende inline-styles i widget-/push-preview, mobilens handlingslabels, foto-/offlinevisninger og scanfarver. Ni SVG-grafer bruger nu fælles størrelsesklasser; de to orbit-menuer deler baggrund/skygge, inkl. highlight. Lint-reglerne omfatter nu også faste SVG-fontattributter og bevarer farvereglerne uden for admin. 32 ekstra SVG-/kontroltilstande er sammenlignet i 41 CSS-egenskaber ved 402/1440 px uden forskelle; grafens ægte sorte ramme er bevaret særskilt fra appens #232323-token. Native sync og 101 berørte style-only-ruters kildehashes er verificeret.
- 67 faste SVG-tokenattributter er tilknyttet eksisterende fill-/stroke-klasser. 62 source-extracted SVG-par samt tre ekstra drag-skygge/stregkode-tilstande er grønne i 41 egenskaber på mobil/desktop. Skyggesæt er CSS-variabler/klasser; stregkodetekst bruger klasse med størrelsesparameter. Ingen statiske SVG-font- eller hf-tokenpaint-attributter tilbage uden for dokumenterede undtagelser. Separat agentreview fandt ingen konkrete regressioner.
- Online brugersession er tilgængelig; admin viser stadig login. Slutverificeret: 384 tests grønne, lint uden fejl (12 eksisterende advarsler), build på 403 sider grøn, native sync og paritet grøn. De berørte portede ruters kildehashes er opdateret efter style-only verifikation; native vejningstal bruger samme 40/48-headingrolle. Deploy afsluttet: https://github.com/Vandmollevej/hellocalvs2/actions/runs/38212627514. /api/health?deep=1 svarer HTTP 200/status ok.

- Online efter deploy: 35 matchede desktopelementer ved 1280×720, alle 36 mobilelementer ved faktisk 402×874, fire profilfelter ved faktisk 1440×900 og otte adminlogin-elementer har uændrede beregnede egenskaber. Nye hf-shell__add/hf-navrow--profile-klasser er bekræftet i live DOM. Mobilens header/bundmenu og desktopskallen er visuelt kontrolleret og forskellige som tilsigtet. Browserens viewportoverride krævede synlig kontrolfane og faktisk innerWidth-kontrol; fejlsamplet desktop som mobil er kasseret.
- Uafhængig slutkontrol: AST-fixture fra faktisk base 53e86336 til deployet 5e0414b5, med faste iframebredder og aflæst html.clientWidth, har 699 faktiske elementpar uden forskelle i 41 stilegenskaber ved både 402 og 1440 px. Klassenavne, oprindelige faste inline-styles og SVG-attributter indgår; ukendte runtimeværdier udelades. Dette er element-/surfacekontrol, ikke fuld montering af hver side.
- Åbent: indre adminsider kan først kontrolleres visuelt efter brugerlogin i admin.hellocal.io; den konkrete Face ID-tilknytningsfejl kræver berørt platform/enhed og brugerens egen biometriske bekræftelse. Ingen legitimationsoplysninger eller brugerindstillinger er ændret.

## 2026-10-14: Kropsmål — stemmeguide med mikrofon øverst

- Mikrofon øverst på Kropsmål (web + native). Guiden siger, hvilket mål den skal bruge og hvor man måler, lytter efter tallet, udfylder og gemmer feltet og siger "Jeg har registreret … Nu skal du give mig målet om …". Forstår kun tal, "spring over", "tilbage", "gentag" og "stop" (alle syv sprog); ingen AI-model. Se DECISIONS/REGLER 2026-10-14.
- Nyt: `src/lib/body-measurement-voice.ts` (+ test), `src/lib/web-speech.ts`, `useBodyMeasurementVoice`; native `BodyMeasurementVoice.kt`, `DevicePlatform.speak/stopSpeaking` (Android TextToSpeech, iPhone AVSpeechSynthesizer). Native Kropsmål viser nu også bagdel/læg/ankel og følger synlighedsvalget.
- Tests (407), lint (0 fejl), tsc, build, native sync/paritet grønne; Kotlin-logikken kørt på JVM med samme testcases. Ikke prøvet på telefon her (ingen enhed): brugerens test af mikrofonen på Kropsmål på iPhone og Android (at stemmen høres højt nok efter lytning, og at tal som "82 komma 5" forstås).

# HELLO CAL — project status

Last updated: 2026-10-14

## 2026-10-16: «Oplevelse af søvn» flyttet til Screeninger → Søvn (web + native)

- Rækken er væk fra Indstillinger → Visning (app + web); den faste Søvn-række under Screeninger åbner nu til/fra-siden og viser Aktiv/Inaktiv. Webbens sidebjælke: Screeninger → Søvn. Se DECISIONS 2026-10-16.
- Ikke prøvet i browser/på enhed (ingen lokal login); Kotlin kompileres kun i CI (native.yml) — tjek, at «Web ↔ native»-jobbet er grønt.

## 2026-10-14: Graviditet og amning — officielle tillæg til kaloriebehovet

- Nyt trin i oprettelsesguiden ("Er du gravid, eller ammer du?", kun for kvinder) og ny side Indstillinger → Visning → Graviditet og amning (`/settings/display/pregnancy`, web + native + webmenu). Kun for `sex = FEMALE` (brugerens rettelse). Gravid: uge → trimester → +70/260/500 kcal (EFSA 2013); ammer: uger → +500 kcal (første 26 uger) / +300. Ugen regnes selv frem. Intet kalorieunderskud (`PREGNANCY_NO_DEFICIT`); kalibrering og kaloriemål-forslag på pause. Egen linje i regnestykket.
- Migration `20261014200000_pregnancy_status` (enum `PregnancyStatus` + fire kolonner på `users`) skal med deployet. Tests (`pregnancy.test.mjs`, energy-budget), lint (0 fejl/12 eksisterende advarsler), tsc, native sync/paritet grønne. Ikke prøvet i browser/på enhed (ingen lokal DB): tjek trinnet i guiden, siden under Visning og linjen "Graviditet"/"Amning" under Profil → Kaloriemål. Se DECISIONS/REGLER 2026-10-14.


## 2026-10-11: Samling af upushet arbejde

- Gennemgået 160 registrerede worktrees og lokale branches mod den aktuelle
  master. Arbejdet samles i `worktrees/github-samling`; hovedmappen bevares.
- Manglende regnearksscripts og navneregler fra `deploy` medtages med masters
  nyere produkt-/kontoregler bevaret. Labels-siden kobles til adminmenuen og
  bruger de eksisterende certifikatlogoer.
- Detaljer og resterende arbejde: `docs/handoffs/2026-10-11-github-samling.md`.
- Lokalt verificeret: 378 tests, lint uden fejl, build, Prisma, Python-syntaks og native sync/paritet. PR #400 er flettet som abd501c7. Android/iPhone og web/native er grønne på samlingscommitten. Build/deploy #714 er grønt, inklusive migration og alle robotter. Deep health svarer HTTP 200/status ok efter udrulningen.

## 2026-10-11: Codex overtager ni afbrudte opgaver

- Samlet overlevering: `docs/handoffs/2026-10-11-codex-opfoelgning.md`.
- Cardio PR #398 flettet sammen med master i isoleret arbejdskopi; konflikter i native-sideliste og genererede oversættelser løst uden at fjerne masters nye sider. Cardio tilføjet i webmenuen, så desktop-paritet følger profilmenuen.
- Cardio PR #398 er flettet via GitHubs normale PR-knap til master som ae9c4b7e, efter alle otte checks var grønne. Deployet kører. Admin-opfølgningen af84f85d er pushet og ligger i PR #399; checks afventes.
- De efterladte dubletliste-rettelser er hentet fra Claude-arbejdskopien uden at ændre originalen. Begge dubletlister har markering og Handlinger; slettede varer udelades også fra tælling og gruppeopslag. Samlede handlinger nulstiller dubletcachen og genindlæser scroll-listen med beskyttelse mod gamle igangværende svar.
- Lint har 0 fejl (12 eksisterende advarsler); build gennemfører alle 402 sider. Seks webmenu-tests og native-paritetskontrollen er grønne. Browserkontrol mod databasen mangler.
- Deploys for e3a67698 (webmenu), 6c425727 (Vipps), 6d87e4b6 og e0c103b5 (admin) er nu gennemført med success. Cardio-deployet er endnu ikke afsluttet. Opfølgningen på alle ni opgaver fortsætter.

## 2026-10-11: Scan-kontekst (land + sprog) på varer

- Nye kolonner `scannedCountry`, `scannedLanguage`, `scannedDeviceLocale` på varer og scanninger; migration `20261011180000_scan_context` skal med deployet (backfill DK/da). Ikke typetjekket / kørt her (node_modules mangler). Se DECISIONS.

## 2026-10-11: Admin langsom ved sideskift — hurtigere sider + valg mellem evigheds-scroll og sideinddelt

- **Årsager:** ingen indlæsningsskelet (`loading.tsx`) i admin, så siden stod stille, til alle databasekald var færdige; Usikkerheder hentede op til 4000 rækker med joins og sendte dem alle til browseren, og "Øvrige advarsler" læste hele varekataloget for at finde dubletter; Dubletter kørte de tunge gruppe-opslag to gange pr. visning (tælling + side); admin-oversigten brugte hele usikkerhedslisten blot til at tælle; ingen cache.
- **Rettet:** `src/app/admin/loading.tsx`; `src/lib/ttl-cache.ts` (hukommelses-cache 30–60 s, nulstilles ved rettelser); Usikkerheder henter lette rækker gradvist fra `/api/admin/uncertainties` og detaljer først ved "Rediger"; Dubletter → Varer, øvrige advarsler, Varer til godkendelse og Kvalitetskontrol tegnes gradvist; Varer til godkendelse sorteres på lette felter og henter højst 200 med detaljer ad gangen.
- **Valg øverst** (`ListModeToggle`, `src/components/admin/ListMode.tsx`): evigheds-scroll eller sideinddelt; huskes i browseren og gælder alle lister. Billed-fanerne (Dubletter → Varebilleder, Billedforslag) har deres egen størrelses-/sidevælger og er uændrede.
- Typetjek og lint grønne på de ændrede filer; ikke prøvet i browser (ingen lokal DB/login) — tjek Usikkerheder (fanerne, sortering, "Rediger"), Dubletter → Varer og Varer til godkendelse på en stor database.

## 2026-10-11: Forsiden er væk i webversionen

- `AppHomeGate` (`src/components/AppHomeGate.tsx`) pakker den indloggede forside ind: på desktop-skallen (≥ 1024 px) monteres hjul, liste, bundmenu og prompter aldrig, så siden ikke længere starter med at loade drejehjul/spinnere, før kalenderen åbner. Delt breakpoint i `src/lib/desktop-query.ts`. Se DECISIONS 2026-10-11 og REGLER "Webversionen har ingen forside".
- Ikke prøvet i browser/på enhed (ingen lokal DB/login). Telefon/tablet uændret.

## 2026-10-11: Forsidens infoboks (venstre side)

- Ny `InfoBox` (`src/components/InfoBox.tsx`): hvid boks, 1 px sort kant, takket bund, fra hjulets række 2 over til række 2 under midten og til lidt før skærmens midte. Hele boksen er touch-område; swipe op/ned bladrer. Første visning: "puls over dagen" (vågne timer, y-akse fra lidt under hvilepuls til makspuls = zone 5's max).
- **Ikke gjort:** native-skærmen (`HomeScreen.kt`) er ikke porteret (Kotlin kan ikke kompileres her); paritet accepteret, gæld i OPEN-TASKS (`forside-infoboks`). Flere AI-statistikvisninger mangler (afventer brugerens ønsker). Ikke prøvet i browser/på enhed.

## 2026-10-11: Webvisningen — Support nederst, større profilcirkel, tilføj-dropdown og sprogvælger

- **Support** står nu nederst til venstre i sidebjælken i en egen boks under en skillelinje (`WEB_SUPPORT` i `web-nav.ts`, `.hf-shell__footer`); ikke længere sidste punkt blandt indstillingerne.
- **Profilcirklen** i topbjælken er 44 px (før 32) og står uden teksten "Profilindstillinger" (kun tooltip/aria-label).
- **Den grønne tilføj-dropdown** viser de samme ikon-firkanter som mobilens "Tilføj"-vindue (`AddMenuList`, uden redigering og uden "Optag"); lukker ved klik udenfor.
- **Sprogvælgeren på chat-siden** er en dropdown med landekode ("DK ▾") i stedet for flaget og bundarket; mobil (tale-siden) er uændret.
- Ikke live-testet (login kræves). Tjek på desktop ≥ 1280 px: Support-boksen, cirklens størrelse, dropdownens rækker, "DK"-menuen på /chat.

## 2026-10-11: Open Food Facts → Billeder i admin (gennemgang af OFF-billeder)

- Nyt undermenupunkt **Varedatabase → Open Food Facts → Billeder** (`/admin/product-database/open-food-facts/images`): alle OFF-billeder i et gitter, faner Til gennemgang / Godkendt / Afvist, størrelsesskyder (1 = ét billede ad gangen), sortering på interaktioner / tidspunkt i databasen / dato ændret, filter på mindst N interaktioner, pr. side 10–200, sidetal, "Marker alle som godkendt", klikbare halvdele og knapper. Se DECISIONS 2026-10-11.
- Afviste billeder sendes til scan-appens **Skal scannes** (samme mekanisme som Open Food Facts-kontrollen); forsidefotoet fra "Opret vare" erstatter billedet. Banneret "Optjen 10 points" består, og natrobotten `external-image-ai` springer afviste billeder over.
- DB: `Product.offImageReview*` (migration `20261011170000_off_image_review`) — skal med deployet.
- **Ikke gjort/ikke prøvet:** ikke prøvet i browser eller mod rigtig database. Det afviste billede vises stadig for brugerne, indtil en ny forside er taget. Poster der kun findes i `off_products` (uden vare) er ikke med.

## 2026-10-11: Retter uden kendt energi vises aldrig

- "0 kcal pr. servering" under Trender netop nu er rettet: retter med ukendt energi (nutritionMissing / 0 kcal) udelades i `/api/shared-recipes`, og web + native viser aldrig et nul. Se docs/DECISIONS.md og docs/REGLER.md.
- **Ved deploy:** ingen migration. Ikke live-testet (ingen lokal DB/login): tjek Retter → Trender netop nu og Valdemarsro-retter uden Frida-match.

## 2026-10-11: Popups på web er lightboxe

- Fra 1024 px er `BottomSheet` en centreret lightbox (680 px, `full` 960 px, bekræftelser 480 px, X øverst til højre, ingen trækstreg) i stedet for mobilens bundark; under 1024 px er alt uændret. Samme breakpoint som `AppFrame` (`src/lib/desktop-query.ts`), som hook i `src/lib/use-desktop-viewport.ts`.
- Samme på web for popups fra oven/bunden uden `BottomSheet`: `StaleSyncPrompt`, åben `RescanBanner`, scan-appens `ShelfItemSheet` og "Slet billedet?". Regel: KRAV.md "Popups på web", DECISIONS 2026-10-11, REGLER (UI).
- **Ikke prøvet i browser** (bevidst ingen skærmbilleder); breddemål og afstande kan finjusteres. Native uændret.

## 2026-10-11: Webversionen følger appen (menu + forside-popups)

- Webmenuen (`src/lib/web-nav.ts`) dækker nu hele appens Profil og Indstillinger (Beskeder med tal, Status, Point, Vægtkalibrering, Kropsmål, Søvnmønster, Screeninger, Viden om, Hello Doc, Familie, Kommunikation, Visning med Prioritering/Resultatvisning/Kropsmål/Tips, Support-gruppen) + Favoritter og Log ud i profil-dropdownen. Kamera og Billeddagbog er udeladt (kræver kamera); plus-cirklen udelader mikrofon og kamera.
- Vægt/tøj-popup, synk-påmindelse og pulsudsving ("Hvad foretog du dig?") vises nu også på desktop (kalenderen) via `WebStartPrompts`.
- Ny test `src/lib/web-nav.test.mjs` holder webben i takt med appens menuer og forsidens popups. Se DECISIONS og REGLER samme dato.
- Ikke prøvet i browser/mod rigtig login. **Tjek efter deploy:** at Screeninger/Beskeder/Status/Point står i sidebjælken, at Log ud virker, og at vægt-popuppen kommer på kalenderen.

## 2026-10-11: Cardio (Profil → Cardio)

- Ny side `/profile/cardio` lige under Søvn: laveste hvilepuls, maxpuls, VO₂ max, iltmætning, HRV, åndedrætsfrekvens og pulsfald, hver med forløbsgraf (`HistoryLineChart`) og dropdown øverst for tidsinterval (30 dage – alt). Data læses automatisk fra de eksisterende ur-integrationer (`HealthMetric`) og kan indtastes manuelt som kropsmål (`POST /api/cardio`, kilde `MANUAL`, én værdi pr. type og dag).
- Migration `20261011170000_health_metric_manual` skal med deployet. Tekster i `cardio.*` (da/en; øvrige sprog har engelsk).
- **Ikke gjort:** native-skærm (Kotlin kan ikke kompileres her); paritet for `/profile` er accepteret, `/profile/cardio` står som pending i `native/parity/screens.json`. Ikke prøvet i browser/mod rigtig database. `npm test` fejler kun på `/settings/display/priority` (kendt).

## 2026-10-11: Open Food Facts i egen tabel + admin-menu

- **Ny menu** Varedatabase → Open Food Facts (`/admin/product-database/open-food-facts`, Alt+8): alle varer hentet fra OFF med navnet delt op (mærke, sub brand, produkttype, variation, nøgleord, mængde) og en sikkerhed i %. Se DECISIONS 2026-10-11.
- **Scanning gemmer nu hele OFF-varen lokalt** (`off_products`: rå svar + opdeling + filtre + næring), også tynde poster, og opretter varen ud fra de opdelte felter (ikke kun titlen). Filtre → `product_filters`, næring → `product_nutrition_features`/`micronutrientsPer100g`.
- **Opdeleren** er målt mod arkene (produkttype forenelig 92 %, alt rigtigt 61 % hvor navnet indeholder typen); sikkerhedstallet er kalibreret derefter. `scripts/off-import/` har ordforrådsbygger, evaluering og `split-dump.mjs` til at køre på `Backup/off_raa`.
- **Ved deploy:** migration `20261011150000_off_products` kører. Ikke live-testet (ingen lokal DB/login): tjek en scanning af en ukendt stregkode, listen og enkeltsiden, og "Indlæs udtræk" med en fil fra `Backup/off_raa`.
- **Næste:** manuel rettelse af de opdelte felter i admin; genbyg `src/data/off-vocab.json` og kalibreringen, når arkene er rettet færdige; `npm test` fejler på `/settings/display/priority` (mangler i page-tree, ikke fra denne ændring).

## 2026-10-11: Open Food Facts-kontrol (admin → Scan-invites) + "Skal scannes" i scan-appen

- Ny admin-side `/admin/scan-invites/off-kvalitet`: alle Open Food Facts-varer med vurdering (Dårlig/Svag/Acceptabel/God, 0–100), kategorier med kommentar pr. fund, søgning, filtre (vurdering, kategori, sendt/ikke sendt/scannet), sortering, afkrydsning og "Send til scan-appen" / "Træk tilbage" / "Send alle, der matcher filteret". Se DECISIONS 2026-10-11.
- Scan-appen: sendte varer står som ikke scannede (minus + "Skal scannes" på hyldeoverlayet, "Scan varen" i bundarket) og i den nye liste Menu → Skal scannes; de klares, når en agent scanner varen.
- Natlig robot `off-quality` (05:00) + knappen "Vurdér nu". Migration `20261011120000_product_quality_review` skal med deployet.
- Tjekket: tsc mod isoleret Prisma-klient, nye tests (`off-quality.test.mjs`), genvejs- og sidetræs-tests. Ikke prøvet mod produktionsdata; vurderingen er første gang først tilgængelig efter "Vurdér nu" eller natkørslen.

## 2026-10-11: Dubletter → Varebilleder — Behold / Erstat med dette

- Kun to knapper (Behold / Erstat med dette, begge sletter de øvrige varianter), øvrige alternativer som miniaturer under, ingen stregkode, lightbox med sidekolonner til at bladre og tal i bunden, og "Anbefalet" (lysegrøn ramme) for et tydeligt bedre alternativ, som så vises som standard. Se DECISIONS.md 2026-10-11 og REGLER.md.

## 2026-10-11: Synkroniseringssiden for forbundne integrationer

- **Ny side** (`src/app/settings/integrations/[app]/ConnectedView.tsx`): hvid "Rediger visning" allerøverst (bundark med til/fra), "Aktiveret" + grøn cirkel, dagens log, historik-dropdown og sort "Deaktiver" fast nederst. Ny rute `GET /api/integrations/<app>/log?range=…`. Se DECISIONS 2026-10-11 og REGLER → UI.
- **Google Health, iltmætning m.fl.:** timegennemsnit blander ikke længere dagsværdier ind, og migrationen `20261011080000_google_health_hourly_collapse` samler de eksisterende minutmålinger (skal med deployet).
- **Rettet regel:** "Knapper står altid øverst" var forkert → nederst (REGLER → UI).
- **Ikke prøvet i browser eller mod rigtig database** (ingen skærmtjek efter brugerens regel); web typecheckes/lintes, native kompileres kun i GitHub Actions.

## 2026-10-11: Admin-lister — mangler flagges, til/fra-status, markering + Handlinger, slettede

- Varer og alle Retter-lister: rød kant/tekst og rød linje øverst ved manglende billede/næring (filtre), status som tekst + on/off-knap, markering med klik/Ctrl/Shift og "Handlinger" (Disable, Aktivér, Godkend, Send til gennemsyn, Slet; Gendan under Slettede), og "Slettede (N)" øverst på listerne. Se DECISIONS 2026-10-11 og REGLER → UI.
- "(Brug … i stedet)" i HelloFresh-titler er HelloFreshs egne udgåede dubletter: deaktiveret af migrationen og sprunget over af importen.
- DB: `deletedAt` på `products` og `shared_recipes` (migration `20261011120000_admin_soft_delete`) skal med deployet.
- Markering + Handlinger findes også på Kvalitetskontrol, Nye varer, Usikkerheder, Energi-afvigelser, Advarsler, Billedforslag og Dubletter (Varer + Billeder); rækken er en sag, og handlingen rammer varen. Slettede varer udelades fra kø-listerne.
- **Ikke med:** Logoer (rækken er et mærke, ikke en vare). Ikke prøvet i browser. `npm test` har én rød test, der ikke stammer herfra: `/settings/display/priority` mangler i `src/lib/page-tree.ts`.

## 2026-10-11: Google Health — aktiv energi løfter kaloriegrænsen

- **Årsag til at grænsen stod stille:** skridt, træning og aktiv energi blev hentet med filteret `<type>.interval.start_time >= "…Z"`, som Google afviser (400). `Promise.allSettled` skjulte fejlen, så kun vægt/målinger kom ind. Nu `<type>.interval.civil_start_time >= "ÅÅÅÅ-MM-DDTHH:MM:SS"` (uden Z), afviste datatyper logges, og `fetchVersion` = 1 henter de 90 dage igen én gang (PR #391).
- **Aktiv energi (`active-energy-burned`):** hentes som `ACTIVE_ENERGY_KCAL` pr. dag; Google Health har `energy` som læsetype. Kalenderen (web + native, alle visninger) lægger pr. dag det største af træningspas-kcal og enhedens aktive energi oven i målet (PR #389). Se DECISIONS 2026-10-10/11.
- **Ikke prøvet mod rigtige Google-data:** svarets form (`activeEnergyBurned.interval` + `kcal`) er læst fra Googles dokumentation. Rykker grænsen sig ikke efter en synkronisering, så tjek serverloggen for "Google Health datatype #… fejlede".

## 2026-10-10: Mærker på produktcirklen + prioritering af visning

- Venstre side af produktcirklen (`ProductCircleBadges`, `src/lib/circle-badges.ts`): certifikater nederst flugtende med cirklens bund (økologi altid nederst, øvrige ovenover), advarsels-/kostikoner øverst flugtende med cirklens top. Øverste række rykker op til den grønne bjælke (46 px) og æder derefter certifikaterne én ad gangen — økologi sidst. Den gamle certifikatliste under energifordelingen og navne-overlayet på cirklen er erstattet.
- Ny **Visning → Prioritering af visning** (`/settings/display/priority`, første punkt) med træk-og-slip (`SortableList`). Kun slåede-til blokke vises. Standard: sukker → allergener → E-numre → kosthensyn → mærker → vegansk. Alt kan flyttes frit.
- **Resultatvisning:** nye til/fra for sukker, kosthensyn, mærker og vegansk. Allergen-rækker åbner et bundark med Aktivér/Deaktivér og Indeholder / Indeholder ikke / Begge dele ("indeholder ikke" kun for gluten (glutenfri) og mælk (laktosefri), der har fri-for-påstand i `ProductFilters`).
- DB: `User.displayPrefs` (JSON, migration `20261011000000_user_display_prefs`) — skal med deployet. Tekster ligger i `circleBadges` (da/en; øvrige sprog har engelsk indtil oversat).
- **Ikke gjort:** native-skærmene er ikke porteret (Kotlin kan ikke kompileres her); paritet er accepteret og gælden står i OPEN-TASKS (`cirkel-maerker`). Ikke prøvet i browser/mod rigtig database. Ikoner for is_*-mærker er midlertidige Tabler-ikoner; kosthensyn "høj på protein" udledes af ≥ 20 % energi fra protein.

## 2026-10-10: Kalender — dagsvisningens timer følger klokken

- Åbner man en dag, vises morgen+nat om morgenen, morgen+aften midt på dagen og aften+nat (bunden) om aftenen. Erstatter den gamle "stå-op-tid / nu ±2 timer"-logik og besøgs-cookien. Web + native. Se REGLER → UI. Tjekket: eslint, tsc, paritet; ikke prøvet på enhed.

## 2026-10-10: Søgeresultater viser "Brand Subbrand Varenavn"

- Søgelisterne (web + native: Madvarer, Søg, Opret ret) viser nu brand og subbrand forrest i varens tekst via `searchTitle` fra `GET /api/products`; brandet står ikke igen i undertitlen. Se DECISIONS 2026-10-10 og REGLER → Søgning.

## 2026-10-10: Søgemotor (Meilisearch) og Analyse → Søgning i admin

- Søgningen kører nu på Meilisearch: stavefejl ("nescfe gold", "rugbrd", "mælj"), sammensatte ord begge veje, varetype/mærke/variant med, præfiks mens man skriver og synonymer. Postgres-søgningen er reserve, hvis motoren ikke svarer. Robotten "Søgemotor: opdater indeks" holder indekset ajour hvert 5. minut. Se DECISIONS og DEPLOYMENT 2026-10-10.
- Admin → Analyse → Søgning: alle søgninger (periode, land, sortering), raffinerede søgninger (søgte på A, så på B, fandt det bagefter?) og søgninger uden resultat med filteret "Kun rene fejl" (stavefejl og meningsløse sorteret fra af regler + natlig AI-vurdering, knappen "Vurdér nye søgninger nu").
- Migration `20261010210000_search_events` og ny container `meilisearch` skal med deployet (begge håndteres af `build.yml`).
- Samtidig rettet: de to røde tests på master (admin-genveje: genveje til Søgning, Synonymordbog, Dyrefoder-filter, Vejning: tøj; sidetræet: 55 manglende sider).
- Tjekket: tsc, eslint, `npm test` (315/315 grønne), paritet, build. Lokalt mod Meilisearch v1.53.2 + Postgres 16 med de 2.830 REMA-/butiksvarer fra repoet: søgninger, indekssynk (2.830 varer på 5 s; anden kørsel 0 ændringer), statistik, raffinering, klik og admin-siden. AI-vurderingen er ikke prøvet (ingen OpenAI-nøgle lokalt), og intet er prøvet mod produktionsdata.

## 2026-10-10: HelloFresh-robotten opdaterer og rydder op automatisk

- `hellofresh-import` henter nu hver opskrift igen mindst hver 30. dag, prøver retter uden billede igen og spærrer retter, HelloFresh har fjernet (genåbner dem, hvis de kommer tilbage). Nye opskrifter hentes som før løbende fra sitemap'en; ugemenuernes retter viderestiller til opskrifter, der allerede er i kataloget.
- Tjekket mod en lokal Postgres med rigtige HelloFresh-sider: import, opdatering med billede, spærring af fjernet ret, genåbning og at admins deaktivering ikke røres.

## 2026-10-10: RetNemt og BetterFeast som integrationer (som HelloFresh)

- To nye natlige robotter: `retnemt-agent` (job `retnemt-import`, 03:45; ugens menu + hele opskriftsarkivet ugentligt, ca. 150 retter på menuen) og `betterfeast-agent` (job `betterfeast-import`, 04:00; ugens menu, ca. 100 unikke færdigretter med deklaration). Første kørsel sker straks efter deploy (jobbene har ikke kørt før). Styres under admin → Cron-jobs.
- Integrationer → Opskrifter har kort for HelloFresh, RetNemt og BetterFeast (`User.recipeProviders`); Retter → Delte retter viser kildeknapper for dem, der er slået til (Seriøs). Opskriftssiden er HelloFreshs; BetterFeast viser deklaration og næring pr. 100 g. Admin → Retter har RetNemt- og BetterFeast-lister.
- Rettet undervejs: HelloFresh-kontakten under Integrationer kunne ikke gemmes (feltet fandtes ikke i databasen); admin "Deaktivér" satte status i stedet for `discontinued`; Valdemarsro-listen i admin var tom.
- Migration `20261010235000_meal_kit_providers` skal med deployet. Native app (Opskrifter, opskriftsside, Integrationer, Favoritter) er porteret.
- Tjekket: robotternes indhentning og tolkning kørt mod de rigtige sider (RetNemt: næring/ingredienser/allergener/arkiv-bladring; BetterFeast: 164 menupunkter, deklaration, næring, allergener), prisma validate, tsc, eslint, `npm test` (de 2 kendte røde er røde på master), paritet, sync og build. Robotternes databaseskrivning er ikke kørt mod en rigtig database før deploy.

## 2026-10-10: Søgning — "Nescafé instant kaffe" og "instantkaffe" finder Nescafé

- Årsag: butiksvarerne hedder fx "Gold" (mærke Nescafé, varetype "Instant kaffe"), og søgningen læste kun navn og mærke; "instantkaffe" i ét ord matchede heller ikke "Instant Kaffe". Nu læses varetype, serie, variant, smag og søgeord med, og sammensatte ord matcher. Gælder web og native (samme API). Se DECISIONS 2026-10-10.
- Tjekket: tsc, eslint, `npm test` (4 nye tests grønne; de 2 kendte røde er røde på master), paritet, build, og lokalt mod Postgres med testvarer: før rettelsen fandt "instantkaffe" kun de generiske varer, efter findes Nescafé-varerne. Ikke prøvet mod produktionsdata.

## 2026-10-10: Søgning — brand og subbrand søgbare og altid øverst

- Subbrand er nu søgbart (titel, brand og subbrand, også når det kun vises som logo). Nævner søgningen et brand eller subbrand, står dets varer altid øverst, sorteret efter resten af søgningen. Nye parametre "Brand nævnt i søgningen" og "Subbrand nævnt i søgningen" (standard 100) + boksen "Søgeparametre" i admin → Søgealgoritmer. Se DECISIONS 2026-10-10.
- Migration `20261010230000_search_subbrand` (trigram-indeks på subbrand, `search_words` genopbygget med subbrand-ord) skal med deployet.
- Tjekket: tsc, eslint på ændrede filer, nye rangeringstests (`src/lib/product-search-ranking.test.mjs`) og brand-tests grønne. Ikke prøvet mod produktionsdata.

## 2026-10-10: Frida-skøn (∼) på varer uden energimærkning

- Ny robot `frida-estimates` (admin → Cron-jobs/Robotter, kl. 02:30 + efter importerne) giver varer uden energimærkning Fridas tal i de tomme felter (∼), opretter stregkoder på alle butiksvarer, regner Valdemarsro-retter ud, når alle linjer kan regnes med, og udfylder delte retter. Tvivlstilfælde: admin → Usikkerheder → Frida-match. Varesiden viser ∼ ved kcal og Fridas kildeangivelse nederst i det udfoldede næringsfelt (web + native). Se DECISIONS 2026-10-10.
- Migration `20261010200000_frida_estimates` (`products.fridaEstimateId`, tabel `frida_estimate_reviews`) skal med deployet. Agenterne (butiksimport, Frida, Valdemarsro) er ændret og bygges om.
- Tjekket: tsc, eslint på ændrede filer, `npm test` (8 nye matchetests grønne; de 2 røde, admin-genveje og sidetræ, er røde på master i forvejen), paritet, sync og build. Matchet er prøvet mod Frida-arket og de 50 eksempelvarer i repoet, ikke mod produktionsdatabasen; første kørsel skriver de rigtige tal i robotloggen.

## 2026-10-10: Søgning — varer uden energitabel kan nu findes

- Årsag: rangeringen fjernede varer uden søgevisninger ved korte søgninger (under 5 tegn), og varerne uden kalorietal havde aldrig været vist. Desuden tog puljen kun de 80 nyeste træffere. Nu rykker lav popularitet kun ned, og puljen vælges efter tekstmatch. Søgelisten viser "Næringsindhold ukendt" (web + native). `/foods` viste et gammelt cachet svar i stedet for det friske. Se DECISIONS 2026-10-10.
- Tjekket: tsc, eslint, paritet, lokal rangeringstest ("vin"/"øl" med en vare uden visninger). Ikke prøvet mod produktionsdata.

## 2026-10-10: Vægt-popup — Withings' webhook blev afvist af adgangsmuren

- Årsag til at tøj-popuppen stadig ikke kom: adgangsmuren (`middleware.ts` → `src/lib/access-wall.ts`) afviser alle klienter uden browser-User-Agent med 403. Withings' tjek af adressen og selve notifikationerne er serverkald, så tilmeldingen fejlede, og vejninger kom først med 15-minutters-jobbet. Webhooks (Withings, Garmin, Stripe, MobilePay) er nu undtaget bot-spærren; ruterne validerer selv.
- Første synk efter en genstart/deploy kører Withings' notifikations-tilmelding igen (én gang pr. integration pr. proces), så rettelsen virker inden for et kvarter efter deploy i stedet for ved næste token-fornyelse.
- Tjekket: tsc, eslint på ændrede filer, paritet. Ikke prøvet mod Withings' rigtige notifikationer; brugerens test: vej dig, og hold forsiden åben.
- Udestående rettet samtidig: alle `weighIn.*`-tekster (tøj-popup, synk-popup, vejningsdetaljer) er oversat til tysk, fransk, hollandsk, svensk og norsk (web + native via sync).

## 2026-10-10: Søgning — viser alt, ignorerer accenter og retter stavefejl

- Deploy-hændelse: den fejlede migration står som fejlet i produktion (P3009), fordi agent-trinnet i `build.yml` kører `migrate` efter en fejlet prøvekørsel. Midlertidig `migrate resolve --rolled-back` ligger i `compose.production.yaml` og skal fjernes, når migrationen er anvendt. Se DEPLOYMENT 2026-10-10.

- Deploy-rettelse: migrationen fejlede på Postgres 17 ("function unaccent(unknown, text) does not exist"), fordi indeks/visninger bygges med begrænset `search_path`. `hc_search_norm()` og alle kald er nu skema-kvalificeret (`public.`). Prøvet lokalt med `SET search_path = pg_catalog, pg_temp` + REFRESH/REINDEX; produktionen var urørt (migrationstesten på skemakopien stoppede deployet).

- `GET /api/products`: varer uden kalorietal er ikke længere skjult; accent-ufølsomt match; ved 0 hits søges på rettet tekst (`correctedQuery`/`originalQuery`), ved 1-2 hits foreslås `suggestedQuery`; `&exact=1` slår det fra. Linjen "Viser resultater for … · Søg i stedet efter …" / "Mente du …?" er i `/search`, `/create-dish`, `/foods` og de tre native skærme; loftet på 6 rækker er fjernet i `/search` og Opret ret. Tekster i `searchCorrection` (7 sprog).
- Migration `20261010120000_search_unaccent_trgm` (extensions `unaccent`, `pg_trgm`, `fuzzystrmatch`, visning `search_words`) skal med deployet og er prøvet mod Postgres 16 lokalt, ikke mod produktionsdata. tsc og lint grønne; `npm run build` og paritet grønne; Kotlin ikke kompileret lokalt; ikke prøvet i browser/på telefon. Se DECISIONS samme dato.

## 2026-10-10: "Styres her"-link ved hver ekstern nøgle i admin

- Admin → API-nøgler: hvert felt viser "Styres her: <menusti>" med det præcise link hos udbyderen (Google Auth Platform → Clients, Meta App settings → Basic, Apple Keys/Services IDs/Membership, Mailjet SMTP/API-nøgler/afsendere, Stripe API keys/Webhooks, Garmin My Apps/Endpoint Configuration, AppGallery Connect My projects m.fl.). Egne API'er kræver nu et link. Se DECISIONS 2026-10-10 og REGLER.
- Hver tjeneste har et anker; forsidens Drift-widget, Beskeder og integrationssiderne linker direkte til tjenesten.
- Kun admin (web) — ingen native-skærm berørt. Tjekket: tsc, eslint på ændrede filer, `npm test` (de 2 kendte røde på master), paritet. Ikke prøvet i browser; Polar, Passio, TeamMessage og Vipps-portalen har ingen fast dyb adresse, så der linkes til det indloggede område med menustien.

## 2026-10-10: Withings-data i realtid og tøj-popup med det samme

- Withings melder nu nye data til `/api/integrations/withings/webhook`. Vægt, kropssammensætning, puls, blodtryk, temperatur, EKG og søvn hentes straks; aktivitet hentes, næste gang appen er fremme (`POST /api/integrations/app-open`, web + native). Forsiden (web + native) tjekker hvert 15. sekund og når appen kommer frem igen, så tøj-popuppen kommer inden for få sekunder. Se DECISIONS 2026-10-10.
- Eksisterende Withings-forbindelser tilmeldes automatisk ved første synkronisering efter deploy; ingen ny tilkobling og ingen migration. Kræver `APP_BASE_URL` på serveren (er sat).
- Tjekket: tsc, eslint på ændrede filer, paritet. Kotlin kompileres i GitHub Actions. Ikke prøvet mod Withings' rigtige notifikationer endnu.

## 2026-10-10: Subbrand over brandet ved produktcirklen

- Varesiden (web + native): subbrandet står oven over brandet til højre for cirklen; begge vises som logo, når det findes, ellers som navn i fed grøn tekst. Se DECISIONS 2026-10-10.
- Ny tabel `subbrand_logos` (migration `20261010120000_subbrand_logos`), `subbrandLogoUrl` i `/api/products/[id]`. Logo-upload i admin og logo-robottens `_import` sætter en fil som subbrand-logo, når intet brand men et subbrand hedder som filen (fx de ventende `Ota Solgryn`, `Kinder Bueno`, `Schulstad Det Gode` i `_import`). Migrationen skal med deployet; Kotlin kompileres i GitHub Actions.

## 2026-10-10: cl-drikkevarer og omregningstabel væsker → gram

- Varer med mængde i cl vises altid i cl (aldrig gram), uanset kategori (web `product-display-unit.ts`, native `FoodLogic.kt`).
- Ny omregningstabel (137 væsker + tørvarer målt i dl, bygget ud fra Frida-varerne): Viden om mad → "Omregning: væsker til gram" (`/viden-om/omregning`, native `KitchenConversions.kt`), `GET /api/kitchen-conversions`. Retter har Mål/Gram-skift over ingredienserne (HelloFresh + egne/delte, web + native), og Indsæt tekst/Scan regner dl/spsk om med tabellen. Tilføj vare fra Opret ret: væsker viser gram med småt i hjørnet af mængdeboksen og et op/ned-ikon; tryk bytter til gram som primært. Se DECISIONS.
- Tjekket: tsc, eslint på ændrede filer, `npm test` (de 2 røde tests — admin-genveje og sidetræ — er røde på master i forvejen), paritet og sync. Ikke prøvet i browser/på telefon.

## 2026-10-10: Trender netop nu som slider med 10 retter

- Delte retter: "Trender netop nu" er nu en vandret slider med op til 10 kort (web `RecipeCard`, native `RecipeCard`). Rangering: klik den seneste måned (seneste uge tæller dobbelt); mangler der klik, fyldes op med tilfældige retter (fast rækkefølge pr. dag), så der altid er mindst tre, når der findes retter.
- Nyt: tabel `recipe_clicks` (migration `20261010100000_recipe_clicks`), `POST /api/recipe-clicks`, `trending=1` på `/api/shared-recipes`. Klik registreres ved tryk på en ret i listen/slideren (højst ét pr. time pr. bruger pr. ret).
- Valdemarsro: importen er bygget (2026-10-08), men agenten skal først deployes og køre; 150 retter pr. nat. Indtil da er knappen Valdemarsro tom. Migrationen skal med deployet. Lint/tsc/build ikke kørt (ingen `node_modules`), Kotlin ikke kompileret, ikke prøvet i browser.

## 2026-10-10: Tøjvalg ved vejning formuleret som "Med …"

- Tilføj vægt (web + native, via sprogfilerne): rækkerne hedder nu "Med undertøj", "Med bukser", "Med top / T-shirt", "Med overdel" (tidl. Sweater), "Med sko" og "Med mobil og andet i lommerne"; "Efter toiletbesøg" uændret. Ingen kodeændring; nøglerne er de samme. Paritet grøn; ikke visuelt testet.

## 2026-10-10: Indberet fejl — bundark pr. punkt, kamera og tak-boks

- `/profile/report-bug` (fra en vare): punkterne er ikke længere dropdowns, men rækker der åbner et bundark med punktet som overskrift, notefelt og under det kamera ("Tag billede", fjern/tag nyt). "Gem" lukker arket; den sorte "Send indberetning"-knap nederst sender alt. Efter indsendelse bliver siden stående, og banneret er erstattet af et sort felt "TAK! Vi har modtaget din indberetning…".
- Fotos: ny kolonne `bug_reports.sectionPhotos` (migration `20261010080000_bug_report_section_photos`), gemt uden EXIF i `public/product-images/bug-report-images` (`src/lib/bug-report-image-storage.ts`), sendt som `sectionPhotos` i POST/PATCH `/api/bug-reports`, vist under hvert punkt i admin. Et punkt med kun foto får teksten "Se vedhæftet foto".
- Native `ReportBugScreen.kt` følger med (`HcBottomSheet`, `Device.takePhoto`). Migrationen skal med deployet. Ikke prøvet i browser/på telefon; Kotlin ikke kompileret lokalt.

- 2026-10-16: Time-visningen i kalenderen (Kl. 22–23) viser nu produkter som forsiden (swipe, kcal/100 g, bekræft-ark), og "Slet" er omdøbt til "Fjern" i swipe-række og bekræft-ark (web + native).
