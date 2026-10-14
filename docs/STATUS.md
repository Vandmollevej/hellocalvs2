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
