# Fejlretninger — løbende liste

Denne fil er en løbende log over fejl/mangler, som brugeren lister op via skærmbilleder. Hver post beskrives grundigt, så en fremtidig agent kan forstå og rette fejlen uden yderligere kontekst. Poster slettes/redigeres ikke uden brugerens eksplicitte input — nye poster tilføjes nederst.

---

## 1. Portionsstørrelse på "Tilføj"-siden (IMG_1577)

**Skærmbillede:** `IMG_1577.png`

**Observeret adfærd:** På tilføj-siden (`/tilfoej` el. lign.) vises portionsvælgeren som "1 portion" med `380 kcal`, og der er +/- knapper til at ændre antal portioner.

**Problem:** "1 portion" (eller "1 person") må kun vises som enhed, når denne vægtenhed rent faktisk findes i databasen for den pågældende fødevare/ret — dvs. den skal matches mod databasens definerede portionsstørrelser, ikke antages generisk. Lige nu ser det ud til at blive vist uafhængigt af, om databasen faktisk har en portionsdefinition for varen.

**Krav til rettelse:**
- Standardvisningen skal altid være **per 100 gram** forrest (dvs. 100 g er default-enheden, ikke portion/person).
- "1 portion"/"1 person" som alternativ enhed må kun tilbydes, når det matcher en eksisterende vægtenhed i databasen for den specifikke vare.
- Antal-feltet ("antal personer" i lignende sammenhænge) er i øjeblikket sat med en alt for stor default/max-værdi — skal begrænses til noget realistisk.

**Status:** Skal noteres i roadmap, da det kræver database-matching (portionsdefinitioner skal kunne slås op og valideres pr. vare). Ikke løst endnu.

**Yderligere krav (samme skærmbillede):** "Tilføj"-knappen skal altid være placeret nederst på skærmen og være statisk/fast (fixed) — den må ikke scrolle med indholdet eller flytte sig alt efter hvor meget indhold (fx Energifordeling-sektionen) der er på siden.

**Usikkerhed:** Brugeren er ikke sikker på, om skærmbilledet viser den nuværende version af appen eller en ældre version — skal verificeres mod den aktuelle live-visning, før der rettes noget.

---

## 2. Integrationssiden giver 404 (IMG_1580)

**Skærmbillede:** `IMG_1580.png`

**Observeret adfærd:** Ved at navigere til integrationssiden (`hellocal.packroff.dk/settings/integrationer` el. lign.) vises en 404-side ("This page could not be found").

**Problem:** Siden findes ikke/er ikke bygget færdig endnu.

**Krav til rettelse:** Integrationssiden skal oprettes med faner (tab-navigation), på samme måde som profil- og indstillingssiderne allerede bruger faner. Fanerne skal — som tidligere aftalt/talt om — vise mindst:
- Fitbit
- Health (Apple Health el. lign.)
- Fitbit vægt (separat fane/integration fra almindelig Fitbit)
- HelloFresh

**Status:** Ikke løst endnu — kræver ny side/komponent samt fane-struktur.

---

## 3. Tænd/sluk-knapper (toggle switches) er ødelagte layoutmæssigt (IMG_1581)

**Skærmbillede:** `IMG_1581.png` (Billede-dagbog-siden, "Kræver telefonens adgangskode for at vise")

**Observeret adfærd:** Toggle-kortet viser en overskrift ("Kræver telefonens adgangskode for at vise") + brødtekst ("Håndhæves endnu ikke af OS'et...") i venstre kolonne, og selve tænd/sluk-knappen (toggle) er placeret til højre — men vertikalt centreret i forhold til HELE kortets højde (overskrift + brødtekst), ikke kun i forhold til overskriften. Det giver et ustabilt/skævt indtryk, fordi toggle-knappens position flytter sig afhængigt af, hvor meget brødtekst der er.

**Problem (generelt, gælder ALLE tænd/sluk-knapper i appen, ikke kun denne side):** Alle toggle-switches er "fuldkommen ødelagte" layoutmæssigt på samme måde.

**Krav til rettelse:**
- Tænd/sluk-knappen skal altid sidde fast på øverste linje/række (dvs. justeret ud for overskriften, ikke centreret på hele kort-højden), uanset hvor meget brødtekst der er under.
- Selve toggle-knappen skal gøres mindre (den nuværende størrelse er for stor).
- Dette skal implementeres som en fælles, genbrugelig klasse/komponent (fx en `.hf-toggle` eller tilsvarende), ikke løses lokalt på hver enkelt side — så alle toggles i appen rettes samtidig og forbliver konsistente.
- Under overskriften ("Kræver telefonens adgangskode for at vise") skal der indsættes en meget let/lys grå skillelinje (den lyseste grå i det eksisterende tema — dvs. brug en eksisterende semantisk linje-/separator-token, ikke en ny farve) mellem overskrift og brødtekst. Formålet er dels visuel adskillelse, dels at det underbygger, at toggle-knappen virker mere stabil/fast placeret på øverste række, når overskriften er tydeligt afgrænset fra brødteksten.

**Status:** Ikke løst endnu — kræver central komponent-rettelse (påvirker alle sider med toggles), ikke en side-specifik fix.

**Yderligere krav (samme side — Billede-dagbog, galleri/billedvisning):**
- Billederne, der tages og vises på siden, skal vises i **portræt-format i iPhonens fulde højde/aspect ratio** (dvs. billeder taget med iPhone-kameraet skal ikke beskæres/klippes til en anden ratio — de skal beholde deres native portræt-højde).
- Billedvisningen skal kunne **swipes/slides frem og tilbage** mellem billeder (side-til-side navigation, som et karrusel/slider), ikke bare vise ét statisk billede ad gangen uden navigation.
- Under hvert billede skal der vises en **dato-linje** (dato for hvornår billedet er taget).

---

## 4. Header og bundnavigation er ikke statisk/korrekt — flere designbrud (IMG_1581, samme side)

**Skærmbillede:** `IMG_1581.png` (Billede-dagbog)

**Observeret adfærd / brud på eksisterende designregler:**

1. **Profilcirkel forkert side:** Brugerprofil-navnet/-cirklen (fx "PT") skal ALTID sidde statisk/fast i højre side af headeren. Den er i stedet vist forkert (til venstre) — dvs. modsat af det aftalte.
2. **Tilbagepil forkert side og forkert stil:** Tilbagepilen skal sidde i **venstre** side af headeren, og den skal være magen til HelloFresh-appens tilbagepil-stil (dvs. en bestemt visuel reference/ikon fra HelloFresh) — ikke bare en generisk pil.
3. **Header-højde/typografi ændret uden lov:** Headeren skal være **fast/statisk i højde** og skal være magen til HelloFresh-headerens højde. Højden og/eller overskriftsstørrelsen er blevet ændret, hvilket ikke var meningen.
4. **Bundmenuen (BottomNav) er fjernet:** Den faste bundnavigation med de fire Hello Cal-funktioner SKAL altid være statisk/synlig i bunden. Den mangler helt på denne side — det er et alvorligt/kritisk designbrud, da bundmenuen er en fast, ufravigelig del af app-shellen (jf. `.hf-screen`/`.hf-bottom-nav` i design.md).
5. **"Tag billede"-knappen skal være fast i bunden:** Action-knappen ("Tilføj"-knap / kamera-/tag billede-knap) skal altid være placeret nederst på skærmen og være statisk — samme princip som fejl #1 (Tilføj-knappen på tilføj-siden).

**Vigtigt — sammenhæng med profil/venstre-højre-reglen:** Dette er IKKE en ny regel, men en eksisterende, allerede besluttet regel i `design.md` (§1: "Profilcirklen til venstre og højre side reserveret til luk-handling") og i brugerens globale feedback-hukommelse (`feedback_back_arrow_not_cross.md`: brug altid tilbagepil, ikke kryds, til at lukke/navigere tilbage). Denne fejl er derfor et konkret eksempel på, at en tidligere kodeændring har vendt om på venstre/højre-placeringen og fjernet bundnavigationen — det skal rettes centralt i `ScreenHeader`/`HfScreen`-komponenterne, ikke kun på denne side, så det ikke sker igen på andre sider.

**Status:** Ikke løst endnu — kritisk, da det er et brud på fastlagte, allerede besluttede designregler (ikke en ny regel).

---

## 5. Manglende billede i billedserien (opfølgning til punkt 3/4)

**Kontekst:** Brugeren nævnte at et billede og en side manglede at blive tilføjet til denne liste — dvs. der er flere skærmbilleder i `Fejlretninger`-mappen, der endnu ikke er gennemgået/beskrevet her. Listen fortsættes løbende efterhånden som brugeren sender flere billeder.

**Status:** Afventer flere billeder fra brugeren.

---

## 6. Bundnavigationens "rediger ikoner"-funktion er helt ødelagt (IMG_1582)

**Skærmbillede:** `IMG_1582.png` (Mine oplysninger-siden, med redigeringsmenu for bundnav åben ovenpå)

**Observeret adfærd:** Der er et system til at redigere/omarrangere bundnavigationens ikoner (long-press for at aktivere redigeringstilstand, hvor man kan trække nye ikoner ned i menuen fra en liste med "Kamera"/"Søg" osv., og fjerne eksisterende med et lille X-badge). Dette ses i skærmbilledet som en bundsheet med teksten "Træk et ikon ned i menuen" og "Færdig", samt X-badges på de fire nuværende bundnav-ikoner (Tilføj, Madvarer, Stemme, Profil).

**Problem — flere samtidige fejl:**
1. **Long-press/"ryst"-interaktion virker ikke korrekt:** Ikonerne skal ryste (som iOS' hjemmeskærm-redigeringstilstand), når man holder fingeren nede på et ikon, som visuel bekræftelse på at redigeringstilstand er aktiveret. I stedet ryster de slet ikke — og redigeringsvinduet (bundsheet'et med "Træk et ikon ned i menuen") åbner kun "hvis man er heldig", dvs. det er upålideligt/tilfældigt om det overhovedet trigges.
2. **Kan ikke slette knapper:** Selvom der vises X-badges på ikonerne (som normalt betyder "kan fjernes"), kan man rent faktisk ikke slette/fjerne knapperne ved at trykke på X'et.
3. **Ikonerne er visuelt skåret over/beskåret:** De fire bundnav-ikoner (Tilføj, Madvarer, Stemme, Profil) fremstår afskårne i redigeringstilstanden — sandsynligvis fordi bundsheet'et overlapper dem, eller fordi ikonernes egen boks/kant er forkert dimensioneret.

**Krav til rettelse:**
- Long-press skal give en pålidelig, tydelig "ryste"-animation (ligesom iOS-hjemmeskærmen) ved aktivering af redigeringstilstand — ikke en tilfældig chance for at redigeringsvinduet åbner.
- X-badge på hvert ikon skal rent faktisk fjerne/slette det pågældende ikon fra bundnavigationen, når man trykker på det.
- Ikonerne må ikke fremstå beskårne/afskårne i redigeringstilstand — de skal vises fuldt og korrekt, uanset om bundsheet'et er åbent ovenover.

**Status:** Ikke løst endnu — funktionen er reelt ubrugelig i sin nuværende form.

---

## 7. Slide-navigation mellem app-sider fungerer som helside-navigation, ikke som en glidende slider (gentaget klage — også nævnt tidligere)

**Kontekst:** Samme skærmbillede (`IMG_1582`) illustrerer også dette problem, men det gælder generelt i hele appen, ikke kun denne side. Brugeren har påpeget dette problem før ("hvilket jeg brokkede mig over sidst"), og det er altså ikke rettet endnu.

**Problem:** Når man swiper/slider mellem sider/skærme (fx mellem sider i bundnavigationen, eller mellem billeder i en billedserie), opfører navigationen sig som at "bladre hele sider" (dvs. en diskret side-skift-animation, formentlig med et hårdt cut eller en "snap"-effekt mellem hele viewports) i stedet for en jævn, kontinuerlig slider-bevægelse, hvor man kan følge fingeren og se indholdet glide roligt frem og tilbage i realtid (som en almindelig iOS-native swipe-slider/carousel, fx som billedgalleriet i Billeder-appen).

**Krav til rettelse:** Al slide-/swipe-baseret navigation (bundnav-sider, billedserier, m.v.) skal implementeres som en ægte, kontinuerlig, fingerfulgt slider — ikke en diskret side-for-side-bladring. Brugeren skal kunne slide "stille og roligt" frem og tilbage og se bevægelsen følge fingeren undervejs, ikke kun opleve et spring mellem faste tilstande.

**Status:** Ikke løst endnu — dette er en gentagen, tidligere rapporteret fejl, som stadig ikke er rettet.

---

## 8. "Nulstil"-ikonet (reset/recycle-knappen fra redigeringsmenuen) er implementeret forkert (opfølgning til IMG_1582)

**Kontekst:** I skærmbillede `IMG_1582` ses en grøn, cirkulær "nulstil"-knap med et recycle/genbrugs-ikon (de to buede pile) nederst i redigeringssheetet for bundnav.

**Reference-ikon vedhæftet af brugeren:** Et simpelt, sort "refresh"/gendan-ikon — én enkelt cirkulær pil (ikke to buede genbrugspile), tegnet som et rent streg-ikon uden udfyldt baggrundscirkel eller -farve.

**Problem:** Det nuværende nulstil-ikon (den grønne cirkel med genbrugssymbol) er slet ikke det, brugeren havde forestillet sig, da vedkommende bad om at få det ændret globalt som en klasse/komponent. Det er blevet implementeret forkert i forhold til den intention, der lå bag ønsket.

**Krav til rettelse:** Nulstil-ikonet skal ændres til en enkelt, cirkulær "refresh"-pil (som i det vedhæftede referencebillede) — vist i **grøn** (brand-grøn-tokenen) uden udfyldt baggrundscirkel eller -flade, dvs. et rent linje-ikon, ikke et ikon inde i en farvet cirkel-knap. Dette skal implementeres centralt som en genbrugelig ikonklasse/-komponent (ligesom `HfChevron`), så det bruges konsistent alle steder, hvor et nulstil/reset-ikon indgår — ikke kun i bundnav-redigeringsmenuen.

**Status:** Ikke løst endnu — tidligere forsøg matchede ikke den ønskede visuelle stil.

---

## 9. Baggrunden bag redigeringssheetet kan stadig scrolles op/ned — skal være helt låst (IMG_1583)

**Skærmbillede:** `IMG_1583.png` (Mine oplysninger-siden, med redigeringssheet for bundnav åbent, mens baggrundssiden er scrollet/skubbet ned så en loading-spinner og et stykke tomt grå areal er synligt over selve headeren)

**Observeret adfærd:** Mens redigeringssheetet ("Træk et ikon ned i menuen") er åbent ovenpå "Mine oplysninger"-siden, kan man stadig scrolle/trække baggrundsindholdet (siden bagved sheetet) op og ned. I skærmbilledet ses konsekvensen tydeligt: hele siden — inklusive den grønne header ("Mine oplysninger") — er blevet skubbet nedad, så der nu vises et bart, gråt område med en loading-spinner ØVERST, over selve headeren. Det ser broken/uprofessionelt ud ("det ligner lort").

**Problem:** Når redigeringssheetet (eller enhver anden modal/bottom sheet) er åbent, skal baggrundssiden være helt låst/fastfrosset — dvs. scroll skal deaktiveres på baggrunden (`body`/`.hf-screen__scroll` skal have scroll-lock), så man ikke ved et uheld kan trække hele sideindholdet inklusive headeren ud af position, mens en modal er åben ovenpå.

**Krav til rettelse:**
- Når en bottom sheet/modal er åben, skal underliggende sides scroll-container låses (ingen touch-scroll skal kunne påvirke baggrunden).
- Headeren skal forblive fast i sin position (øverst i viewporten) uanset brugerens forsøg på at scrolle baggrunden, mens en modal er åben.
- Dette er et generelt krav til alle modaler/bottom sheets i appen, ikke kun redigeringssheetet for bundnav.

**Status:** Ikke løst endnu — scroll-lock mangler helt på baggrundssiden, når en modal/sheet er åben.

---

## 10. Vægt kalibrering-siden: forkert primær knap, manglende dummydata, for stort tekstfelt, uklar "vægt øverst"-funktion (IMG_1584)

**Skærmbillede:** `IMG_1584.png` (Vægt kalibrering-siden)

**Problem A — "Ved ikke" er fejlagtigt den primære/dominerende knap:** Flere af valgmulighederne (Med tøj/Uden tøj, Med sko/Uden sko/Ved ikke, Efter toilet/Før toilet/Ved ikke, Før mad/Efter mad/Ved ikke) er implementeret sådan, at "Ved ikke" vises som en stor, fyldt grøn primær-knap, mens de faktiske svarmuligheder (fx "Uden tøj", "Med sko") vises som utydelig, umarkeret gråtekst uden knap-styling. Det er bagvendt: "Ved ikke" bør aldrig være den visuelt dominerende/primære handling — det er ikke det mest sandsynlige eller ønskede svar, det er en undtagelse/fallback. De rigtige valgmuligheder skal være de primære, tydeligt klikbare knapper/toggles.

**Problem B — Manglende dummydata på testprofilen:** Der er ønsket realistiske dummy-vægtdata på testprofilen, så man rent faktisk kan se, hvordan siden ser ud, når der er registrerede vejninger (i stedet for kun at se "Ingen vejninger registreret endnu."). Kravet: tilføj et sæt realistiske vægt-registreringer (forskellige tidspunkter, forskellige "med/uden tøj"-kombinationer osv.) til dummyprofilen, så den fulde visning (graf/liste over historik) kan vurderes visuelt.

**Problem C — Vægt-tekstfeltet er en for stor, tung boks:** Feltet "VÆGT (KG)" med placeholder "fx 78,4" er i øjeblikket et stort, afrundet tekstfelt/boks. Det ønskede design er i stedet et minimalistisk linje-input: et rent input **med en statisk "kg"-enhed foran/i feltet**, og en simpel understregning (bottom border/line) i stedet for en fuld boks — altså intet stort tekstfelt-kort, kun en tynd linje, for et renere design.

**Problem D — Skal gemme i realtid, ingen "Registrér vejning"-knap nødvendig:** Der er i øjeblikket en stor, grå "Registrér vejning"-knap nederst i kortet. Denne er ikke nødvendig — inputtet skal gemme automatisk/i realtid, i tråd med Hello Cal's generelle regel om automatisk lagring uden en generel "Gem"-knap (jf. `design.md` §1 og `docs/DECISIONS.md`).

**Problem E — Uklar hensigt med "vægt øverst"-feltet, spørgsmål til Claude:** Brugeren spurgte direkte, hvad formålet/tanken bag "vægt øverst"-feltet oprindeligt var, og om Claude er i stand til at give sparring/tage stilling, når noget er uklart, i stedet for bare at implementere uden at spørge. **Dette er et åbent spørgsmål til Claude, ikke kun en fejlrapport** — næste gang denne fil læses/behandles, skal der svares/tages stilling til dette spørgsmål direkte til brugeren, ikke kun logges.

**Problem F — Manglende introtekst i grøn boks:** Introduktionsteksten øverst på siden ("Vej dig på forskellige tidspunkter og under forskellige forhold — så får du en fornemmelse af dit udsving i løbet af dagen, uden at skulle veje dig nøgen hver gang.") skal placeres inde i en grøn boks/kort (brand-grøn baggrund, formentlig hvid tekst, jf. eksisterende brand-kort-mønstre andre steder i appen) med pæn luft/padding foroven og forneden — ikke stå som løs tekst direkte på sidebaggrunden. Derudover skal der tilføjes en fyldestgørende vejledningstekst nedenfor (uddybende hjælpetekst til hele vejnings-flowet), som Claude selv skal formulere/udfylde.

**Status:** Ikke løst endnu — kræver UI-omstrukturering af hele kortet samt dummydata-seeding og et svar/sparring om vægt-feltets formål.

---

## 11. Søvnmønster-siden: flere kritiske fejl i logik, rækkefølge og tidsvælgerens design (IMG_1585)

**Skærmbillede:** `IMG_1585.png` (Søvnmønster-siden, med native iOS time-picker åben over "Individuelle tider pr. ugedag")

**Problem A — Alvorlig logikfejl: stå-op-tid kopierer sengetid:** Når man vælger "Normal sengetid" (fx 22.11), bliver "Normal stå-op-tid" automatisk sat til det SAMME tidspunkt (22.11). Det giver ingen mening — de to felter er tydeligvis ikke uafhængige af hinanden, som de burde være. Dette er en konkret bug, der skal findes og rettes i den underliggende state-håndtering (formentlig deler de to inputfelter fejlagtigt samme variabel/state, eller stå-op-feltet initialiseres forkert fra sengetid-feltet).

**Problem B — Forkert rækkefølge og navngivning:** "Stå op"-feltet skal stå FØRST (dvs. til venstre, før sengetid), og skal blot hedde **"Normal stå op"** (ikke "Normal stå-op-tid" — kortere label).

**Problem C — Manglende automatisk udregning af søvnvarighed:** Der mangler en automatisk udregning, der antager 7,5 times søvn som default, når kun ét af de to tidspunkter er sat (dvs. hvis brugeren angiver stå-op-tid, skal sengetid automatisk foreslås 7,5 time før, og omvendt) — i stedet for at lade begge felter stå tomme/ukoblede.

**Problem D — Manglende default-udfyldning af ugedagstabellen + forkert komponenttype (gentaget krav, tidligere ikke implementeret):** Brugeren har tidligere bedt om, at "Individuelle tider pr. ugedag"-tabellen som DEFAULT udfyldes med de samme værdier som de generelle normal-sengetid/stå-op-tider, så det er nemmere at justere enkelte dage bagefter i stedet for at skulle udfylde fra bunden. Dette er stadig ikke implementeret (tabellen ses tom for Lørdag/Søndag i skærmbilledet).
  - Derudover skal hver ugedags-række laves som **en slider i stedet for et tekstfelt/dropdown**: to sliders pr. dag (én for stå op, én for sengetid), hvor selve klokkeslættet vises som tekst UDENFOR sliderens ender (i hver sin side), mens brugeren trækker/kører sliderhåndtaget frem og tilbage for at justere tidspunktet.
  - Rækkefølgen skal her også være stå-op-tid først (tekst i venstre ende), sengetid sidst (tekst i højre ende).
  - Slider-komponentens design (farver, håndtag, spor) skal genbruge eksisterende slider-styling fra andre steder i appen (fx Energifordelings-sliderne på Tilføj-siden, jf. fejl #1's skærmbillede) eller som minimum matche samme farvepalette, så det ikke bliver et nyt, afvigende visuelt element.

**Problem E — Native iOS time-picker matcher ikke appens design:** Den viste tidsvælger (det mørke overlay med rullende tal-kolonner, "Reset"-knap og blå cirkulær checkmark-knap) er tydeligvis browserens/OS'ets native `<input type="time">`-picker eller lignende — dens farver (mørkegrå baggrund, blå accent-checkmark) passer slet ikke til appens palette (`--hf-color-brand` grøn, `--hf-color-action` mørk osv.). Spørgsmål fra brugeren: kan dette justeres, så det matcher designet?
  - **Svar/vurdering:** Native OS-tidsvælgere (iOS' egen picker-wheel) kan ikke omstyles med CSS — deres udseende styres af operativsystemet, ikke af websiden. Skal tidsvælgeren se ud som resten af appens design, kræver det en **custom-bygget tidsvælger-komponent** (fx et eget wheel-picker eller en dropdown/slider bygget i appens eget UI), fremfor at bruge native `<input type="time">`. Dette bør besluttes eksplicit (jf. `docs/DECISIONS.md`) inden implementering, da det er en større UI-komponent at bygge fra bunden, men det er den eneste måde at få fuld visuel kontrol over farverne.

**Status:** Ikke løst endnu. Punkt A er en decideret bug (skal rettes med det samme); punkt C og D er nye funktionskrav; punkt D er samtidig et GENTAGET krav fra tidligere, som stadig mangler; punkt E kræver en arkitektur-beslutning (native vs. custom time-picker), før det kan implementeres.

**Opfølgning (chat):** Brugeren spurgte, hvorfor det custom-byggede tidsvælger-komponent ikke bare blev bygget med det samme, når intet reelt forhindrede det. Svar givet: intet forhindrede det reelt — det blev fejlagtigt behandlet som en arkitektur-beslutning af vane, selvom det blot er en almindelig UI-komponent. Brugeren bad om at vente med selve implementeringen ("Ikke nu. Først bagefter") til efter hele fejllisten er gennemgået.

---

## 12. Invitér en ven-siden: kontrastfejl, manglende globalt afstandssystem, manglende fast bund-actionbar, og ny liste-visning for invitationer (IMG_1586)

**Skærmbillede:** `IMG_1586.png` (Invitér en ven-siden)

**Problem A — Alvorlig kontrastfejl (tilgængelighedsbrud):** Teksten "300 points kan indløses til 1 gratis måned under Profil → Points." er sat i en lys/gennemsigtig grå-grøn tone oven på den mørkegrønne baggrundsboks. Kontrasten er så lav, at teksten reelt ikke kan læses. Dette er et "absolut no-go" og skal rettes øjeblikkeligt til en tekstfarve med tilstrækkelig kontrast (fx hvid eller en lys, næsten-hvid tone) på den grønne brand-baggrund, og reglen skal generelt indskærpes: tekst på farvede baggrunde skal altid tjekkes for kontrast (WCAG AA som minimum), ikke kun vælges "hvad der ser rimeligt ud" i editoren.

**Problem B — Mangler globalt, dokumenteret afstandssystem for boks-til-boks og boks-til-header:** Brugeren ønsker en ny, global regel i designkontrakten (`design.md`) for, hvor meget luft/margin der skal være mellem forskellige kort/bokse på en side, samt afstanden fra headeren til første boks. Dette skal ikke besluttes ad hoc pr. side. **Handling for Claude:** Analysér et eller flere af de eksisterende HelloFresh-referencebilleder i `Hello Fresh inspiration/` (eller tag et nyt referencebillede fra selve HelloFresh-appen, hvis brugeren leverer et) for at måle det faktiske afstandsmønster mellem kort/sektioner og fra header til indhold, og dokumentér resultatet som en ny, navngiven token/regel i `design.md` (i tråd med det eksisterende afsnit 5 "Afstands- og geometri-system"), så alle sider fremover bruger samme værdi i stedet for tilfældige `mt-*`/`mb-*`-værdier.

**Problem C — Manglende fast bund-actionbar (gentaget, kritisk designbrud):** Der findes en global regel om, at handlingsknapper som "Del dit invite-link" (og lignende primære CTA'er/action-knapper) ALTID skal være placeret fast i bunden af skærmen, over footeren/bundnavigationen (`.hf-actionbar`, jf. `design.md` §6.10) — de må ikke stå inde i det almindelige, scrollbare sideindhold. På denne side er "Del dit invite-link"-knappen placeret midt i det almindelige indhold og bundnavigationen/actionbaren mangler helt. Dette er samme type kritiske fejl som tidligere rapporteret i punkt #4 (header/bundnav-brud) — det "må aldrig ske", og skal derfor rettes centralt (i den fælles skærm-/actionbar-komponent), så det ikke gentager sig på endnu en side.

**Problem D — Ny funktionskrav: struktureret liste-visning af afsendte invitationer, med "Send igen":** Når der er afsendte invitationer, skal hver invitation vises i en listerække med følgende opbygning (top til bund i selve raden):
1. **Navn** øverst (modtagerens navn, hvis kendt/angivet).
2. **Email** under navnet.
3. **Tidspunkt** for hvornår invitationen blev sendt.
4. **Udløbsperiode/status**: en invitation er kun gyldig i **1 uge** fra afsendelse — dette skal vises tydeligt (fx "Udløber om X dage" eller "Udløbet").
5. **Genafsend-handling**: yderst til højre i raden skal der være en handling for at sende invitationen igen — vist som et cirkulært "gensend"/refresh-ikon (genbrug samme nulstil/refresh-ikon-komponent som besluttet i fejl #8, dvs. grøn cirkulær pil uden udfyldt baggrund, ikke et nyt ikon). Øverst i denne handlings-"kolonne" (dvs. som kolonneoverskrift, hvis listen har en header-række) kan der stå teksten "Send igen".

**Anmodning om visning:** Brugeren har bedt om at få designet for denne nye liste-visning at se, før/når det implementeres. Jf. projektets regel om ikke at bruge Artifacts til mockups (`CLAUDE.md`, global brugerinstruks), skal dette vises ved at implementere det direkte i de faktiske kildefiler for siden (ikke et separat mockup-dokument) og derefter vise/verificere det i en rigtig browserpreview.

**Status:** Ikke løst endnu — afventer implementering efter resten af fejllisten er gennemgået (jf. brugerens "Ikke nu. Først bagefter").

---

## 13. Kommunikation-siden mangler helt appens standard-shell (header/footer) og skal omstruktureres i sektioner (IMG_1587)

**Skærmbillede:** `IMG_1587.png` (Kommunikation-siden under Indstillinger, viser fire toggle-rækker på en side uden grøn header og uden bundnavigation)

**Problem A — Kritisk designbrud: mangler helt header og bundnavigation:** Siden bruger slet ikke den fælles `HfScreen`/`ScreenHeader`/`BottomNav`-struktur. I stedet ses en helt anden, afvigende header-stil: sort tekst-titel ("Kommunikation") med en simpel `<` tilbagepil i almindelig sidefarve — ingen grøn brand-header, intet profilikon, og ingen bundnavigation nedenunder overhovedet. Dette er samme type alvorlige designbrud som tidligere rapporteret (fejl #4 og #12, punkt C): **alle sider i appen skal bruge den samme faste header (grøn `.hf-appbar`, profilcirkel/tilbagepil i faste slots) og samme faste bundnavigation** — det er ikke noget, der kan droppes eller opfindes forfra på enkelte sider. Denne side skal bygges om, så den bruger de eksisterende, fælles skærmkomponenter, ligesom resten af appen (fx Indstillinger, jf. `design.md` §10 DES-023).

**Problem B — Manglende sektionsopdeling og indhold:** Siden skal omstruktureres til at have tydeligt adskilte sektioner med en overskrift og en tynd skillelinje mellem hver sektion (samme stregstil som ønsket i fejl #3 — lyseste grå tema-linje), i tråd med HelloFresh's visuelle stil (jf. `design.md`'s HelloFresh-referencer). Konkret ønsket sidestruktur, top til bund:

1. **Introtekst øverst (ca. 3 linjer):** En kort tekst, der forklarer appens kommunikationspolitik — hvor ofte og hvilken type kommunikation brugeren kan forvente at modtage (push/e-mails/tilbud). Denne tekst skal Claude selv formulere.
2. **Sektion "Push-beskeder"** (som sektionsoverskrift), med de tilhørende toggle-valgmuligheder derunder (fx "Jeg ønsker at modtage push-beskeder").
3. **Sektion "E-mails"** (som sektionsoverskrift), med de tilhørende toggle-valgmuligheder derunder (fx "Jeg vil gerne modtage nyheder om updates" og "Jeg vil gerne modtage gode råd pr. mail").
4. **Sektion nederst: "Information fra vores samarbejdspartnere"** (som sektionsoverskrift), med den tilhørende toggle ("Jeg vil gerne modtage gode tilbud og information fra vores samarbejdspartnere").
5. **Nederst på siden:** et link til appens "terms and conditions"/betingelser.

**Krav til rettelse (opsummeret):**
- Brug samme `.hf-appbar`/`HfScreen`/`.hf-bottom-nav`-struktur som resten af appen.
- Del siden op i tre navngivne sektioner (Push-beskeder, E-mails, Information fra samarbejdspartnere) adskilt af sektionsoverskrift (`.hf-type-section-title`) + tynd separatorlinje (samme lyse gråtone som i fejl #3).
- Tilføj en kort, Claude-forfattet introtekst øverst om kommunikationsfrekvens/-politik.
- Tilføj et link til terms and conditions nederst på siden.
- Toggles på denne side skal naturligvis også overholde den centrale toggle-rettelse fra fejl #3 (fast øverste linje-justering, mindre størrelse, fælles klasse).

**Status:** Ikke løst endnu — kræver både struktur-ombygning (shell) og nyt indhold/sektionsopdeling.

---

## 14. Indberet fejl-siden: gentaget kontrastfejl, dårlig linkplacering og manglende medie-grid (IMG_1588)

**Skærmbillede:** `IMG_1588.png` (Indberet fejl-siden)

**Problem A — Gentaget, kritisk kontrastfejl (samme type som fejl #12A):** Teksten "Indberet en fejl og optjen 10 points, når den godkendes og rettes.*" er vist i sort/mørk tekst på den mørkegrønne brand-baggrund. Dette er et gennemgående mønster nu (set både her og i fejl #12A) og skal rettes som en **generel regel, ikke en enkeltstående fix**: al tekst på grøn brand-baggrund (`--hf-color-brand`) skal ALTID være hvid (`--hf-color-white`), aldrig sort/mørk. Dette bør tilføjes eksplicit i `design.md` som en håndhævet kontrastregel for brand-kort, så det ikke sker en tredje gang.

**Problem B — "*Læs betingelser"-linket er dårligt placeret:** Linket sidder klemt lige op under den grønne boks uden luft, og er venstrestillet helt ude ved kanten. Det skal i stedet rykkes en smule ind fra venstre kant (dvs. have samme venstre-indrykning/gutter som resten af sidens indhold, ikke sidde længere ude til venstre end boksen ovenover) samt have lidt luft til boksen ovenover. **Handling for Claude:** Undersøg om HelloFresh har et tilsvarende referencemønster (fx i onboarding/checkout-referencerne i `Hello Fresh inspiration/`) for, hvordan et lille "læs betingelser"/disclaimer-link typisk er placeret i forhold til et brand-kort ovenover, og brug det som skabelon for afstand og indrykning fremfor at gætte.

**Problem C — Manglende medie-upload-sektion under tekstfeltet:** Under "Beskriv fejlen"-tekstfeltet skal der tilføjes:
1. En sort, venstrestillet overskrift med teksten **"Tilføj"**.
2. Fire bokse til at vedhæfte relevant dokumentation: **stregkode, ernæring, indhold og produktbilleder** — dvs. samme mønster/genbrug af den allerede eksisterende `CreateProductMediaGrid`-komponent (2×2-grid med nummererede badges, jf. `design.md` §6.11: 1 stregkode, 2 næringsindhold, 3 indholdsfortegnelse, 4 produktbilleder), fremfor at bygge en ny variant fra bunden.
3. "Send indberetning"-knappen skal forblive nederst på siden (som i dag), men bør vurderes i forhold til den generelle bund-actionbar-regel (fejl #12C) — dvs. om den skal være en fast bund-CTA eller en almindelig CTA i indholdet, afhænger af om siden har mere indhold under foldet end det viste.

**Status:** Ikke løst endnu — kontrastfejlen (A) bør prioriteres højt, da det er anden gang samme fejl observeres.

---

## 15. Points-siden: øverste saldo-boks er uforståelig/i stykker (kontrast igen), samt ny historik-struktur (IMG_1589)

**Skærmbillede:** `IMG_1589.png` (Points-siden)

**Problem A — Gentaget, tredje forekomst af samme kontrastfejl:** Den øverste grønne saldo-boks skal formentlig vise brugerens aktuelle points-saldo (fx "Din saldo: X points"), men teksten "Din saldo" og "points" er sat i en næsten usynlig, gennemsigtig/lys grå-grøn tone på den mørkegrønne baggrund — nøjagtig samme fejltype som #12A og #14A. Derudover er det faktiske pointstal (selve tallet) tilsyneladende slet ikke vist eller usynligt af samme grund — der ses kun tre sorte prikker ("...") midt i boksen, hvilket gør boksens formål helt uforståeligt for brugeren ("jeg kan slet ikke forstå formålet"). Dette bekræfter, at kontrastfejlen (sort/gennemsigtig tekst på grøn brand-baggrund) er et systematisk problem, der optræder på tværs af mindst tre sider (Invitér en ven, Indberet fejl, Points) — det skal derfor løses **centralt/globalt** i det fælles brand-kort-komponentmønster, ikke rettes side for side, og bør formaliseres som en håndhævet regel i `design.md` (jf. opfølgningen under fejl #14A).

**Krav til rettelse af saldo-boksen:**
- Overskrift ("Din saldo") og selve points-tallet skal være tydeligt synlige i hvid tekst på den grønne baggrund.
- Points-tallet skal rent faktisk vises som et stort, læsbart tal — ikke skjules bag utilsigtet lav kontrast eller erstattes af en visuel "..."-loading-indikator, der aldrig opløses til et tal.

**Problem B — Ny struktur for "Historik"-sektionen:** Den nuværende simple "Historik"-overskrift + "Ingen points optjent endnu."-tekst er fin som tom-tilstand, men når der er historik-poster, skal hver post/række i historikken struktureres sådan:
1. **Overskrift-linje:** navnet på den event/handling, der har udløst point-tildelingen (fx "Ven oprettede konto", "Fejl godkendt og rettet", "Produkt oprettet").
2. **Under overskriften:** tidspunktet for hændelsen.
3. **Til højre i raden:** antallet af optjente/brugte points (fx "+300" eller "-300").

**Problem C — Ny "Saldo pr. indløsning"-visning:** Derudover skal der, øverst i hver sektion (dvs. ØVERST, ikke nederst, som ellers ville være det naturlige sted for en løbende saldo) vises en linje med den aktuelle saldo, hver gang brugeren har indløst sine points (dvs. hver gang der er sket en indløsning, skal den efterfølgende sektion/periode i historikken indledes med en saldo-linje, der viser saldoen på det pågældende tidspunkt). Dette skal ses som en form for sektionsopdeling af historikken omkring indløsningstidspunkter, hvor saldoen vises som en overskrifts-lignende linje øverst i hver sektion.

**Status:** Ikke løst endnu. Problem A er kritisk og bekræfter et gennemgående, systemisk designbrud (3. observation af samme fejltype); Problem B og C er nye strukturkrav til historik-visningen, som først kan vurderes fuldt ud, når der findes faktiske dummy-data at vise (jf. lignende ønske i fejl #10, Problem B).

---

## 16. Notifikationer-siden skal nedlægges som selvstændig side (IMG_1590)

**Skærmbillede:** `IMG_1590.png` (Notifikationer-siden, viser kun introtekst og en hængende "Henter…"-tilstand uden yderligere indhold)

**Beslutning:** "Notifikationer" skal IKKE eksistere som en selvstændig side/route i appen. Siden skal **slettes**. Indholdet (valg af hvilke beskeder man vil have som e-mail og/eller push) hører i stedet til under den nye "Kommunikation"-side (jf. fejl #13), som allerede dækker push-beskeder og e-mail-præferencer i sektioner. Notifikationer-siden er dermed overflødig/en duplikering af samme funktion under et andet navn.

**Krav til rettelse:**
- Fjern "Notifikationer" som selvstændigt menupunkt (fx fra "Mine oplysninger"-listen, hvor det ses delvist skåret af i baggrunden af IMG_1582/IMG_1583) og som selvstændig route/side.
- Sikr at teksten "Vigtige kontobeskeder (fx verifikation og nulstil kodeord) sendes altid" (den vigtige undtagelsesinfo om obligatoriske kontobeskeder) bevares et sted i den nye "Kommunikation"-side, da det er væsentlig information, der ikke må gå tabt ved sammenlægningen.
- Verificér at ingen andre steder i appen linker til den gamle Notifikationer-route, når den fjernes.

**Status:** Ikke løst endnu — kræver sammenlægning med Kommunikation-siden (fejl #13) og fjernelse af det gamle menupunkt/route.

---

## 17. Indstillinger → Region: mangler HelloFresh's fulde liste af leveringslande (IMG_1591)

**Skærmbillede:** `IMG_1591.png` (Indstillinger-siden, med en native dropdown/picker åben over "Region"-feltet, der viser Danmark, Sverige, Norge, Tyskland, Storbritannien, USA)

**Problem — Ufuldstændig landeliste:** Den nuværende Region-vælger viser kun 6 lande. Det skal i stedet være den fulde liste af lande/regioner, som HelloFresh reelt leverer til (brugeren angiver ca. 16 regioner, men det præcise antal og den præcise liste skal verificeres — fx via HelloFresh's officielle hjemmeside/landevælger, jf. `design.md` §2.1's metode for web-krydskontrol). **Handling for Claude:** Undersøg HelloFresh's officielle liste over lande, de leverer til, og brug den som datagrundlag for Region-vælgeren, i stedet for den nuværende forkortede liste på 6 lande.

**Sekundær observation (samme skærmbillede, lavere prioritet):**
- Samme native-picker-designproblem som i fejl #11E: dropdown'en er browserens/OS'ets native select-liste (mørkt overlay, ingen match til appens palette). Bør løses samlet med #11E's beslutning om custom vs. native picker-komponenter.
- Der ses en uventet "TRIN 3 AF 3 GENNEMFØRT"-fremskridtslinje (grøn progress-bar) øverst på Indstillinger-siden. Det er uklart, hvorfor en almindelig indstillinger-side viser en onboarding-agtig trin-indikator — dette bør undersøges/afklares, om det er en fejlplaceret onboarding-komponent, der ved en fejl vises på den forkerte side.

**Status:** Ikke løst endnu — kræver research af HelloFresh's fulde regionsliste samt en afklaring af den uventede fremskridtslinje.

---

## 18. Opfølgning til IMG_1591: manglende valgt-værdi-visning, forkert placering af Allergener, og afklaring af "Trin 3 af 3"-elementet

**Kontekst:** Direkte opfølgning på fejl #17 (samme skærmbillede, `IMG_1591.png`).

**Problem A — Manglende visning af aktuelt valgt værdi:** I både "Sprog"-boksen og "Region"-boksen mangler der at stå, hvilken værdi der faktisk er valgt i øjeblikket (fx skal "Region" vise "Danmark" et sted i kortet, og "Sprog" skal vise det aktuelt valgte sprog, fx "Dansk"), ikke kun en generisk beskrivelsestekst ("Vælg det sprog appen…" / "Prioriterer produktsøgning efter dit lands stregkoder…") uden reference til den nuværende indstilling.

**Problem B — "Vis allergener" hører hjemme under Profil, ikke under Indstillinger:** Indstillingen "Vis allergener" (med beskrivelsen "Vis en allergen-linje, hvis findes.") er fejlplaceret. Den skal flyttes til **Profil**-siden i stedet for at ligge under de generelle app-indstillinger, da allergener er en personlig/brugerspecifik egenskab (ligesom kostpræferencer, vægt osv.), ikke en app-konfiguration.

**Problem C — "Trin 3 af 3 gennemført"-elementet skal laves om til en ny side "Opsætning" med rigtige HelloFresh-styling step-cirkler:** Fremskridtslinjen fra fejl #17 var ikke en fejlplaceret komponent, men en tiltænkt funktion — dog forkert udført. Det aktuelle "TRIN 3 AF 3 GENNEMFØRT" (kun en enkelt grøn linje-bar) matcher ikke HelloFresh's faktiske onboarding-/progress-mønster, som i stedet bruger synlige, runde **step-cirkler** (nummererede eller ikon-baserede trin-indikatorer, jf. HelloFresh-referencebillederne i `Hello Fresh inspiration/` og den eksisterende "Progressområde er en fælles komponent"-regel i `design.md` §7 "Onboarding/checkout"). **Beslutning:**
- Selve design-siden (kortet/indholdet med Region, Sprog osv.) bevares som den er strukturelt.
- Siden skal omdøbes fra en implicit "trin X af 3"-onboardingside til en selvstændig side ved navn **"Opsætning"**.
- Fremskridtsindikatoren skal bruge de rigtige HelloFresh-stil step-cirkler (ikke kun en enkelt bar), i tråd med det fælles, allerede definerede progress-komponentmønster.
- Flere punkter/skridt skal tilføjes til dette opsætningsflow over tid — den præcise liste af trin, der skal indgå, er endnu ikke fastlagt og skal besluttes særskilt.

**Status:** Ikke løst endnu. Problem A og B er konkrete, afgrænsede rettelser. Problem C kræver en ny, navngivet side ("Opsætning") samt en fremtidig beslutning om det fulde step-flow — indtil videre er kun selve step-indikator-designet og sidenavnet besluttet.

---

## 19. "Vis allergener"-accordion åbner på forkert placering, forkert label, og manglende visuel adskillelse (IMG_1592)

**Skærmbillede:** `IMG_1592.png` (samme side som fejl #17/#18, nu scrollet, viser allergen-listen — Gluten, Skaldyr, Æg, Fisk, Jordnødder osv. — udfoldet mellem "Sprog"-kortet og resten af siden)

**Problem A — Accordion udfolder sig i forkert rækkefølge/placering:** Når man trykker/aktiverer "Vis allergener"-toggle'en, forventes det, at den tilhørende liste af allergener (Gluten, Skaldyr, Æg, osv.) udfolder sig direkte UNDER "Vis allergener"-kortet, som en accordion. I stedet ses listen udfoldet under "Sprog"-kortet, dvs. der er et helt kort (Sprog) imellem toggle'en og den liste, den styrer. Det giver et forvirrende, usammenhængende layout ("Hvad fuck?"). Dette skal rettes, så accordion-listen altid udfoldes umiddelbart under det kort/den række, der faktisk styrer den (dvs. under "Vis allergener", ikke under "Sprog").

**Problem B — Forkert label-tekst:** Toggle-rækkens label skal ændres fra "Vis allergener" til **"Få vist allergener"**.

**Problem C — Manglende visuel tydelighed for accordion-relationen:** Der skal tilføjes en visuel indikation af, at allergen-listen faktisk er en udfoldet undersektion af "Få vist allergener" — fx en tynd skillelinje/streg mellem toggle-rækken og den udfoldede liste, eller en anden tydelig visuel markør, så sammenhængen er indlysende for brugeren.

**Problem D — Ønske om kortere/mere kompakte bokse:** De enkelte allergen-rækker (Gluten, Skaldyr, Æg, Fisk, Jordnødder osv.) fremstår som høje, luftige bokse. Brugeren ønsker kortere/mere kompakte rækker her.

**Spørgsmål fra brugeren (kræver undersøgelse/svar, ikke kun implementering):** Hvordan løser HelloFresh dette mønster — bruger de overhovedet accordions til den slags udfoldelige lister? **Handling for Claude:** Undersøg de eksisterende HelloFresh-referencebilleder i `Hello Fresh inspiration/` (særligt Indstillinger-/checkout-relaterede referencer, jf. `design.md` §7 og §10 DES-023) for at afklare, om og hvordan HelloFresh bruger accordion-mønstre til denne type udfoldelige valglister, og brug fundet som skabelon — i stedet for at opfinde en ny accordion-stil. Hvis HelloFresh ikke bruger accordions til dette, skal et alternativt, dokumenteret mønster foreslås og besluttes, før det implementeres.

**Status:** Ikke løst endnu — kræver research af HelloFresh's mønster for udfoldelige lister, før den endelige accordion-stil kan fastlægges. Placeringsfejlen (A) og label-fejlen (B) kan rettes uafhængigt af research-spørgsmålet.

**Opfølgning/præcisering (bekræfter fejl #18, Problem B):** Brugeren har bekræftet igen, at hele "allergener"-funktionen (både "Få vist allergener"-toggle'en og den udfoldede liste af konkrete allergener — Gluten, Skaldyr, Æg, Fisk, Jordnødder osv.) skal flyttes til/også findes under **Profil**-siden, ikke kun under Indstillinger. Dette er samme krav som #18B, men uddybet: det er ikke kun toggle'en, men hele allergen-listen med underliggende valg, der hører hjemme under Profil.

---

## 20. Tilføj-siden: E-tilsætningsstoffer skal være en accordion, og "Ukendt tilsætningsstof" rejser et spørgsmål om database-indeksering (IMG_1593)

**Skærmbillede:** `IMG_1593.png` (Tilføj-siden, viser Energifordeling, E-tilsætningsstoffer og Allergener-sektioner)

**Bemærkning (positiv observation):** På dette skærmbillede ses headeren med profilcirkel til venstre (og et deleikon til højre i stedet for tilbagepil, formentlig fordi dette er en "del/gem"-kontekst), samt en fast bundnavigation OG en synlig "Tilføj"-knap over bundnavigationen — dette ligner en mere korrekt tilstand end det, der blev rapporteret i fejl #4. Det skal dog stadig verificeres eksplicit mod reglerne i #4 (profilcirkel højre/tilbagepil venstre), da det ikke fremgår tydeligt af dette skærmbillede alene, om det er en anden side-variant eller en allerede delvist rettet tilstand.

**Problem A — E-tilsætningsstoffer skal foldes ind i en accordion:** Sektionen "E-tilsætningsstoffer" (med rækkerne "(E407) Ukendt tilsætningsstof" og "(E955) Ukendt tilsætningsstof") skal ikke vises fuldt udfoldet som nu. Den skal i stedet være en **accordion, der kan foldes ud/ind** (dvs. vises samlet/kollapset som standard, med mulighed for at folde ud og se detaljerne for hvert E-nummer).

**Problem B — Spørgsmål om manglende data: "Ukendt tilsætningsstof" for kendte E-numre:** Både E407 og E955 er reelt velkendte, navngivne tilsætningsstoffer (E407 = Carrageenan, E955 = Sucralose), men appen viser dem som "Ukendt tilsætningsstof". Brugeren spørger direkte, om E-numrene ikke burde være indekseret og gemt i en intern database/opslagstabel, så deres navne kan slås op og vises korrekt, i stedet for at fremstå som "ukendt", når nummeret rent faktisk er identificeret.

**Svar/vurdering (kræver bekræftelse fra en udviklingsagent, der kan se den faktiske datamodel):** Dette tyder på, at appen enten (a) slet ikke har en lokal opslagstabel over E-numre og deres navne/beskrivelser, og i stedet udelukkende er afhængig af, hvad en ekstern datakilde (fx OpenFoodFacts) returnerer for det specifikke produkt, eller (b) har en opslagstabel, men den er ufuldstændig og mangler E407/E955. Den rigtige løsning er at oprette/udvide en statisk, lokalt vedligeholdt E-nummer-database (nummer → navn → evt. kort beskrivelse/oprindelse) i kodebasen, så alle kendte E-numre kan slås op uafhængigt af, hvad den eksterne kilde leverer af navn. Dette bør undersøges konkret i kodebasen (søg efter "E-tilsætningsstoffer"/E-nummer-håndtering) for at afklare, om en sådan tabel allerede findes og blot er ufuldstændig, eller om den mangler helt.

**Status:** Ikke løst endnu. Problem A er en UI-ændring (accordion). Problem B kræver undersøgelse af den faktiske kode/datamodel, før det kan afgøres, om det er en manglende database, en ufuldstændig database, eller en fejl i opslagslogikken.

**Yderligere krav (samme skærmbillede):** Foran "Allergener"-overskriften skal der tilføjes en grøn cirkel med et advarselstegn/udråbstegn (!) som ikon — for visuelt at fremhæve, at sektionen indeholder en advarsel (jf. den fundne allergen, "Mælk"). Ikonet skal genbruge/matche eksisterende badge-/ikon-mønstre i appen (fx samme stilart som `NumberedBadge` i `design.md` §6.11, men med udråbstegn i stedet for tal, eller en tilsvarende ny navngivet variant, hvis den skal dokumenteres separat).

---

## 21. Manuel overskrivning af Energifordeling (Protein/Kulhydrat/Fedt-tal) åbner fejlagtigt en boks/dialog i stedet for direkte inline-redigering (opfølgning til IMG_1593)

**Kontekst:** Samme side som fejl #20 (Tilføj-siden, Energifordelings-sliderne for Protein/Kulhydrat/Fedt).

**Problem:** Når brugeren trykker på selve talværdien (fx "19.6 g" ud for Protein) for manuelt at overskrive/indtaste en anden værdi, åbner der i øjeblikket en separat boks/dialog/modal. Dette er ikke den ønskede adfærd.

**Krav til rettelse:** Der skal IKKE åbnes nogen boks/modal ved tryk. I stedet skal selve talfeltet (fx "19.6 g"-teksten) opføre sig som et **inline-redigerbart tekstfelt**:
- Ved tryk på feltet skal feltets baggrund blive hvid (dvs. en visuel indikation af, at feltet nu er i redigerings-tilstand, ved at skifte baggrund til hvid bag teksten).
- Samtidig skal enhedens native tastatur (taltastatur) komme frem, så brugeren kan skrive den nye værdi direkte ind i feltet, uden at der vises nogen separat dialog/popup ovenpå resten af siden.
- Dette skal gælde alle tre felter (Protein, Kulhydrat, Fedt) ensartet.

**Status:** Ikke løst endnu — kræver at den nuværende modal-baserede indtastning erstattes med inline-redigering direkte i feltet.

**Bekræftende skærmbillede:** `IMG_1594.png` viser præcis den beskrevne, uønskede modal: en hvid boks midt på skærmen med label "Fedt", et tekstfelt med værdien "2.7" og enheden "g" ved siden af, samt en stor grøn "Gem"-knap, mens det numeriske tastatur er fremme nedenunder. Dette bekræfter problemet 1:1 — modalen skal fjernes til fordel for inline-redigering direkte i det viste tal på selve Energifordelings-linjen, uden separat "Fedt"-boks eller "Gem"-knap.

---

## 22. Tilføj-siden (produktdetalje-visning): kalorier skal altid vises pr. 100 g, "Detaljer" skal centreres, og E-tilsætningsstoffer flyttes ind under Detaljer (IMG_1595)

**Skærmbillede:** `IMG_1595.png` (Tilføj-siden for produktet "SBA Protein Milk Shake Banan" fra Mlekovita, med billede, "148 kcal / portion", "Detaljer ⌄" og "E-tilsætningsstoffer" side om side, samt "Personer"/"Gram"-vælger og "1 person / 148 kcal")

**Problem A — Kalorier vises pr. portion/person i stedet for pr. 100 g (GENTAGET krav, samme rodfejl som #1):** Dette er samme grundlæggende problem som allerede rapporteret i fejl #1: appen skal ALTID vise kalorier/næringsindhold som standard **pr. 100 gram**, ikke pr. portion eller pr. person. Her ses det igen tydeligt: "148 kcal / portion" vises som hovedtal, og "Personer"/"Gram"-vælgeren har "Personer" som forvalgt/aktiv fane (sort, fremhævet) i stedet for "Gram". Brugeren påpeger eksplicit, at dette er sagt igen — dvs. kravet fra fejl #1 er endnu ikke implementeret, og det er nu observeret på (mindst) to forskellige sider/varianter af Tilføj-flowet.
  - **Krav (uddybet):** Standardvisningen og standard-fanevalget skal altid være "Gram" (pr. 100 g), ikke "Personer". "Personer" må kun være en mulighed, hvis en portionsstørrelse faktisk er defineret i databasen for denne vare (jf. #1's krav om database-matching).

**Problem B — "Detaljer" skal være centreret:** "Detaljer ⌄"-linket (som formentlig folder produktdetaljer ud) skal være vandret centreret på sin linje, ikke stå til venstre som i dag (hvor det står side om side med "E-tilsætningsstoffer").

**Problem C — E-tilsætningsstoffer skal omdøbes og flyttes:** Linket "E-tilsætningsstoffer" (med det grønne "E"-ikon) skal:
1. Omdøbes til **"E-numre"**.
2. Flyttes væk fra den øverste, altid-synlige placering (ved siden af "Detaljer") og i stedet placeres **inde under "Detaljer"** — dvs. det skal kun være synligt, når brugeren folder "Detaljer" ud (ved scroll/expand), ikke stå fremme som en selvstændig, altid synlig genvej øverst på siden.

**Status:** Ikke løst endnu. Problem A er en gentaget, endnu ikke rettet fejl fra #1 — bør prioriteres, da den nu er rapporteret to gange. Problem B og C er nye, afgrænsede UI-justeringer.

---

## 23. Statistik-siden: siden var helt låst og kunne ikke scrolles (IMG_1596)

**Skærmbillede:** `IMG_1596.png` (Statistik-siden, viser en linjegraf med Kalorier/Vægt, "Kalorieindtag i løbet af dagen"-graf, "I dag"-dropdown, "Tilføj kort"-knap og Statistik-kort som "Forbrændt"/"Skridt", hvor det nederste kortpar er delvist afskåret nederst i viewporten)

**Observeret adfærd:** Brugeren rapporterer, at boksene/siden var "låst" — det var ikke muligt at scrolle på siden. Det nederste sæt statistik-kort ses da også tydeligt afskåret (kun toppen af det tredje/fjerde kort er synligt lige over bundnavigationen), hvilket bekræfter, at der er indhold under folden, som brugeren burde kunne scrolle ned til, men ikke kunne.

**Mulig sammenhæng med tidligere fejl:** Dette minder om den type scroll-lock-fejl, der blev rapporteret i fejl #9 (baggrundsscroll, der ikke burde være muligt, mens en modal er åben) — men her er problemet omvendt: en side, hvor scroll burde være muligt, er i stedet helt blokeret. Det kan tyde på en generel, utilsigtet bug i scroll-lock-logikken (fx en `overflow: hidden`/scroll-lock-klasse, der ved en fejl forbliver aktiv på `body`/`.hf-screen__scroll`, efter en modal er lukket, eller som er sat forkert på selve Statistik-sidens layout).

**Krav til rettelse:** Undersøg Statistik-sidens layout- og scroll-container-logik (`HfScreen`/`.hf-screen__scroll` og evt. graf-komponenternes egne touch-event-håndtering, da graf-biblioteker nogle gange fanger touch-events og forhindrer parent-scroll) for at finde årsagen til, at siden ikke kunne scrolles, og sikre at hele sideindholdet (inkl. alle statistik-kort under folden) altid er tilgængeligt via normal lodret scroll.

**Status:** Ikke løst endnu — kræver undersøgelse af scroll-container/touch-event-håndtering på denne specifikke side.

---

## 24. Kalender-siden: flere designregressioner — overflow-dato-farve, "målsætning"-tekst danser, månedspile flyttet forkert, og manglende dropdown-pil for listevisning (IMG_1597)

**Skærmbillede:** `IMG_1597.png` (Kalender-siden, September 2026, månedsvisning)

**Problem A — Dato uden for den viste måned skal være lysere:** Den 31. (fra august, vist øverst til venstre, uden for den aktuelle måneds celle-styling) skal have en endnu lysere farve/tone, så det tydeligere fremstår som en "udenfor måneden"-dato og ikke forveksles med en almindelig, aktiv dag i september.

**Problem B — "Du er inden for din målsætning"-teksten flytter sig (skal være statisk placeret):** Teksten/statuslinjen med det grønne flueben og "Du er inden for din målsætning." flytter sig op og ned i layoutet afhængigt af, hvor mange uge-rækker den viste måned har (dvs. en måned med 4 uger vs. 5 uger giver forskellig kalenderhøjde, hvilket skubber teksten til en anden vertikal position). Dette skal rettes, så teksten altid har en fast, statisk placering/afstand til kalendergrid'et, uafhængigt af antallet af uger i den viste måned (fx ved at reservere en fast højde til kalendergrid'et, der altid dækker op til 6 uge-rækker, eller ved at give teksten en fast afstand til bunden af en fast-højde-container).

**Problem C — Månedsnavigations-pilene (</>) er flyttet forkert langt ud til siderne (regression):** Pilene til at skifte måned frem/tilbage er nu placeret helt ude i hver sin side af skærmen (yderst til venstre/højre), langt fra selve månedsnavnet ("September 2026"). Det er en uønsket ændring — pilene skal i stedet stå tæt ved siden af månedsnavnet, men med en **statisk/fast bredde/position**, der er beregnet ud fra den længste månedsnavn-tekst i kalenderen (dvs. bredden skal dimensioneres, så pilene ikke hopper vandret rundt afhængigt af, om måneden hedder "Maj" eller "September" — layoutet skal være stabilt uanset måned, men pilene skal sidde tæt op ad teksten, ikke ude ved skærmkanterne).

**Problem D — Manglende dropdown-pil ved kalenderikonet i headeren (regression, kritisk funktionstab):** Der plejede at være en lille ned-pil/chevron ved siden af kalender-ikonet i headeren (ved siden af "Kalender"-titlen), som gjorde det muligt at skifte til en listevisning (eller anden alternativ visning) af kalenderdata. Denne pil/funktion er nu væk, hvilket betyder, at brugeren ikke længere kan tilgå listevisningen. Dette er en alvorlig, uforklaret regression — funktionaliteten skal genindføres, og det skal undersøges, hvorfor/hvornår den forsvandt, så det ikke sker igen.

**Status:** Ikke løst endnu. Problem D vurderes mest kritisk, da det er reelt tab af funktionalitet (listevisning utilgængelig), ikke kun et visuelt problem.

---

## 25. Kalender dag-visning: manglende fallback-standardværdier for søvn (vågn op/gå i seng), hvis brugeren ikke selv har sat dem (IMG_1598)

**Skærmbillede:** `IMG_1598.png` (Kalender-siden, dagvisning for "Fredag 18. september", med "Dagens mål blev nået"-banner og en timeline-graf fra kl. 05 og fremefter uden markerede søvnperioder)

**Kontekst:** Denne dag-timeline hænger sammen med Søvnmønster-siden (fejl #11), hvor brugeren kan angive "Normal sengetid" og "Normal stå-op-tid". Hvis brugeren ikke selv har udfyldt disse værdier, mangler der en fornuftig fallback/standardværdi, så timeline-visningen (og formentlig søvn-relaterede beregninger andre steder i appen) ikke bare fremstår tom/udefineret.

**Krav til rettelse:** Hvis "vågn op" og "gå i seng"-tidspunkterne ikke er sat af brugeren, skal appen falde tilbage til en fornuftig standardværdi baseret på almindelig, realistisk statistik — konkret: **det mest almindelige/typiske søvnmønster for en kvinde omkring 30 år** (hvis en sådan generel demografisk statistik kan identificeres/antages), og under alle omstændigheder skal beregningen tage udgangspunkt i **7,5 timers søvn** som standard-søvnvarighed (samme 7,5-timers-regel som allerede besluttet i fejl #11, Problem C). Dette er altså en fallback-værdi for visning/beregning, ikke en ændring af, hvad brugeren selv kan indstille.

**Sammenhæng:** Dette hænger direkte sammen med fejl #11 (Søvnmønster-siden) — løsningen bør implementeres samlet med rettelserne dér, så standardværdi-logikken er konsistent på tværs af Søvnmønster-siden og Kalenderens dag-visning.

**Status:** Ikke løst endnu — bør løses sammen med fejl #11.

---

## 26. Kalender dag-visning: header-linjen med dato-navigation er fuldstændig i stykker (IMG_1598, samme skærmbillede)

**Skærmbillede:** `IMG_1598.png` (samme som fejl #25 — dag-headeren under den grønne appbar, med "‹ 📅 Fredag 18. september ›" og en tilbagepil yderst til højre)

**Observeret adfærd:** Denne under-header-linje (dato-navigationsraden med venstre-pil, kalenderikon, datoen "Fredag 18. september", højre-pil og en ekstra tilbagepil) er "helt helt gal" ifølge brugeren. Konkret er højre-pilen (">"), som skal bruges til at navigere til næste dag, flyttet ned og fejlplaceret, så den fremstår som hørende til linjen/rækken UNDER selve datorækken, i stedet for at sidde på linje med venstre-pilen, kalenderikonet og datoteksten.

**Krav til rettelse:** Hele dato-navigationsraden (venstre-pil, dato med ikon, højre-pil, evt. tilbagepil til månedsvisning) skal ligge vandret på samme linje/samme vertikale akse. Ingen af elementerne må optisk falde ned på en anden linje/række. Denne rad bør behandles som en fast, dedikeret sub-header-komponent (adskilt fra den grønne hovedheader), med korrekt flex/grid-justering, så alle ikoner og tekst er vertikalt centreret i forhold til hinanden.

**Status:** Ikke løst endnu — kritisk visuelt layoutbrud, skal rettes hurtigt.

---

## 27. Kalender dag-visning: uforståelig grå streg midt om natten i timeline, og "Dagens mål blev nået"-boksen er for stor og skal matche månedsoversigtens stil (IMG_1599)

**Skærmbillede:** `IMG_1599.png` (samme dag-visning som fejl #25/#26, scrollet ned til kl. 20-02, med et gråt skraveret område fra ca. 22 til 02 og en kort, vandret grå streg omkring 01:00, samt en åben bundsheet: "Sengetid sat til 00:00. Skal ændringen gælde kun denne dato, eller dit faste mønster?" med knapperne "Kun denne dato" og "Standardmønster")

**Problem A — Uforklaret grå streg midt om natten:** Der ses en kort, isoleret vandret grå streg omkring kl. 01:00 i timeline-grafen, uden nogen synlig label, forklaring eller sammenhæng med det omkringliggende indhold. Brugeren forstår ikke, hvad stregen skal forestille eller hvilket formål den tjener. **Handling for Claude:** Undersøg kildekoden for denne timeline-komponent (formentlig samme komponent, der viser det skraverede "søvn"-område fra ca. 22-02, jf. fejl #25 om søvn-fallback-værdier) for at afklare, hvad denne streg teknisk set repræsenterer (fx en registrering med varighed 0, en fejlbehæftet render af en tom/ugyldig datapost, eller en placeholder-graf-linje, der ved en fejl vises udenfor sin tiltænkte kontekst), og enten forklar dens formål tydeligt i UI'et (label/tooltip) eller fjern den, hvis den er en visuel fejl/rest fra debugging.

**Problem B — "Dagens mål blev nået"-boksen er for stor og skal redesignes:** Den grønne banner-boks med det store, cirkulære checkmark-ikon og teksten "Dagens mål blev nået" er alt for stor/dominerende. Boksen bag (den fulde grønne baggrundsflade) skal fjernes, og elementet skal i stedet have samme, mere afdæmpede design som det tilsvarende statuselement i kalenderens månedsoversigt (jf. fejl #24: en lille grøn cirkel med flueben + almindelig sort/mørk tekst "Du er inden for din målsætning.", uden nogen stor farvet baggrundsboks). De to statusvisninger (måned- og dag-visning) skal altså bruge samme, ensartede, minimale statuslinje-komponent, ikke to forskellige stilarter.

**Status:** Problem A rettet 2026-09-10: `SleepBlock` i `src/app/calendar/page.tsx` beregnede den grå søvnskygges højde som "24 timer minus top" i stedet for den faktiske søvnvarighed (stå-op minus sengetid). Det fik skyggen til altid at strække sig til bunden af hele den 24-timers timeline-liste, uanset stå-op-tid — deraf den mærkelige, for lange grå boks og den fejlplacerede håndtag-streg midt i. Rettet til at bruge `((wakeTime - bedtime) % 1440 + 1440) % 1440` som varighed, med korrekt wrap-håndtering hvis søvnperioden krydser bunden af listen (som er anchored ved stå-op-tiden). Bør verificeres visuelt i browser ved næste lejlighed. Problem B er stadig ikke løst — klar, afgrænset redesign-opgave (ensret med #24's statuslinje-stil).

---

## 28. Madvarer-siden: manglende favorit-ikon, bundnav flyttet forkert op, manglende dummy-madvarer, og uautoriseret kildetekst på skærmen (IMG_1600)

**Skærmbillede:** `IMG_1600.png` (Madvarer-siden, med "Søg i madvarer"-felt, "Ingen favoritter endnu"-boks, "Opret nyt produkt manuelt"-knap og teksten "Råvaredata: Fødevaredata (frida.fooddata.dk), DTU Fødevareinstituttet". Øverst ses desuden en iOS-systembjælke "Ringer" (skærmoptagelses-/mute-indikator fra selve telefonen, ikke en del af appen).

**Problem A — Manglende favorit-ikon i "Ingen favoritter endnu"-boksen:** Boksen med teksten "Ingen favoritter endnu" mangler et favorit-ikon (bookmark, jf. den allerede definerede `.hf-favorite-button`/`FavoriteButton`-komponent i `design.md` §6.8) foran/ved siden af teksten, som visuelt reference til, hvad "favoritter" betyder i denne kontekst.

**Problem B — Bundnavigationen er flyttet op fra sin faste bundposition (kritisk, gentaget designbrud):** Bundnavigationen (Tilføj/Madvarer/Stemme/Profil) ses placeret et godt stykke oppe på skærmen, med et stort tomt, gråt område under den — i stedet for at sidde fast i selve viewportens bund. Dette er endnu en variant af samme kritiske fejl som tidligere rapporteret i fejl #4, #12C og #23 (bundnav/scroll-container, der ikke opfører sig som en fast shell-komponent). Det bekræfter, at dette IKKE er en enkeltstående side-fejl, men et grundlæggende, gennemgående problem i den fælles `HfScreen`/`.hf-bottom-nav`-implementering, som optræder på tværs af mange forskellige sider. **Dette bør derfor håndteres som én samlet, central opgave** (ikke som separate side-for-side-rettelser), hvor `HfScreen`-komponentens højde-/scroll-/flex-logik gennemgås og rettes fundamentalt, og derefter verificeres på alle sider i appen.

**Problem C — Manglende default/dummy-madvarer:** Der ønskes nogle standard/dummy-madvarer oprettet på testprofilen, så Madvarer-siden (og relaterede lister) ikke fremstår helt tom under udvikling/test — samme type ønske som tidligere i fejl #10 (dummy-vægtdata). **Handling for Claude:** Opret et sæt realistiske dummy-madvarer (med navne, kalorietal, evt. billeder) i databasen for testprofilen.

**Problem D — Uautoriseret/uønsket kildehenvisningstekst på skærmen:** Teksten "Råvaredata: Fødevaredata (frida.fooddata.dk), DTU Fødevareinstituttet" er tilføjet på siden, uden at brugeren nogensinde har bedt om dette. Brugeren afviser tydeligt denne tilføjelse ("Det har jeg aldrig nogensinde bedt dig om!!!"). **Krav til rettelse:** Fjern denne tekst fra Madvarer-sidens UI. Hvis der er et reelt, juridisk krav om kildeangivelse for anvendt fødevaredata (fx pga. licensvilkår for Frida/DTU Fødevaredata), skal dette i stedet afklares eksplicit med brugeren og evt. placeres et mere passende sted (fx en "Om appen"/"Kilder"-side under Indstillinger), fremfor at blive tilføjet direkte og synligt på en almindelig brugsside uden forudgående aftale.

**Status:** Ikke løst endnu. Problem B er kritisk og bør løses centralt (jf. #4/#12C/#23). Problem D skal rettes med det samme (fjern uautoriseret tekst); en eventuel fremtidig kildeangivelse skal først aftales med brugeren.

---

## 29. Forsiden (drejehjul/statistik-karrusel): scroll-tekst springer op og bliver grøn, Kcal-tallet fylder for meget, og sidste listepunkt er unormalt langt væk fra de øvrige (IMG_1601, IMG_1602 — to identiske skærmbilleder af samme tilstand)

**Skærmbilleder:** `IMG_1601.png` og `IMG_1602.png` (Forsiden med den grønne cirkel/FAB til venstre og en lodret liste af statistik-værdier til højre: "0 g", "1,6 Liter", "FORBRÆNDT / 642 kcal", "6.210 skridt", og til sidst "0 kcal" langt nede)

**Problem A — GENTAGET fejl, IKKE rettet: scroll-tekst ("FORBRÆNDT") hopper op og skifter til grøn ved scroll:** Brugeren påpeger direkte, at denne fejl allerede er rapporteret tidligere, men stadig ikke er rettet ("Du har IKKE ændret fejlen i designet i scroll-teksten til højre!!!"). Når man scroller den lodrette liste af statistik-værdier (0 g / 1,6 Liter / Forbrændt-kcal / skridt / 0 kcal), springer "FORBRÆNDT"-labelen pludselig op til toppen af sin egen visning og bliver grøn i stedet for at forblive på sin faste plads over kcal-tallet. Dette må ikke ske — labelen skal blive siddende fast lige over sit tilhørende tal, i den faste grå/mørke farve (`--hf-color-text-secondary` eller tilsvarende), uanset scrollposition.
  - **Handling for Claude:** Da dette er en GENTAGET, tidligere rapporteret fejl, der stadig ikke er rettet, skal årsagen findes grundigt (formentlig en sticky/absolut positioneret label, der ikke er korrekt bundet til sit tal-element under scroll) — ikke blot forsøges lappet overfladisk igen.

**Problem B — Kcal-tallet ("642 kcal") er for stort/dominerende:** Selve tallet skal gøres mindre, så der er plads nok til, at "FORBRÆNDT"-labelen kan blive stående korrekt uden at kollidere eller springe rundt. Der er rigeligt med ubrugt, tomt lodret plads på resten af forsiden (jf. det store, tomme hvide område over og under statistik-listen), som kan udnyttes bedre i stedet for at lade ét enkelt tal dominere så meget af den tilgængelige plads.

**Problem C — Sidste listepunkt ("0 kcal") er unormalt langt nede, adskilt fra resten af listen:** Det sidste element i den lodrette statistik-liste ("0 kcal" med et lille pil-ikon) er placeret ekstremt langt nede på skærmen i forhold til de øvrige fire elementer ovenover (0 g, 1,6 Liter, Forbrændt/642 kcal, 6.210 skridt), som ellers sidder tæt sammen. Det ser ud til at være en spacing-fejl (fx en forkert `margin-top`/`gap`-værdi på netop dette element), og gør det umuligt at forstå, hvad "0 kcal"-værdien egentlig skal forestille i sammenhængen, fordi den visuelt fremstår som løsrevet fra resten af listen.

**Status:** Ikke løst endnu. Problem A er kritisk, fordi det er en allerede rapporteret, men stadig ikke rettet fejl — indikerer at en tidligere rettelse enten ikke blev committet, ikke ramte den rigtige kode, eller blev overskrevet af senere ændringer. Problem B og C er nye, konkrete layout-justeringer.

---

## 30. Forsidens grønne drejehjul/FAB: nyt interaktionsdesign for plus-ikonet og "udbulings"-effekt mod valgt retning

**Kontekst:** Vedrører forsidens store, halvt-synlige grønne cirkel (drejehjulet/FAB'en, jf. den eksisterende, bevarede regel i `design.md` §1: "Forsidens drejehjul og den særlige FAB-adfærd" må ikke ændres af en generel visuel audit — dette er derfor en eksplicit, ny funktionsspecifikation til selve drejehjulets interaktion, ikke en fejlrettelse af eksisterende adfærd).

**Ny funktionsspecifikation (fra brugeren):**
1. **Plus-ikonets placering:** Plus-tegnet skal placeres i midten af den synlige del af den grønne cirkel (cirklen er kun halvt synlig i viewporten, men skal stadig regnes som en fuld cirkel med sit eget centrum — plusset skal sidde i midten af HELE cirklen, ikke kun i midten af den synlige halvdel).
2. **Plus i en lys cirkel:** Selve plus-ikonet skal sidde inde i en mindre, lys (lys/hvid) cirkel, der ligger ovenpå/inde i den store grønne cirkel — ikke stå frit på den grønne baggrund.
3. **Plusset følger fingeren under drag:** Når brugeren trækker fingeren rundt for at vælge mellem drejehjulets forskellige valgmuligheder (retninger/segmenter), skal den lyse cirkel med plusset bevæge sig med/følge fingerens bevægelse, men blive begrænset til at forblive inden for den grønne cirkels areal (dvs. plus-cirklen kan bevæge sig rundt inden for den grønne cirkel i retning af fingerens træk, men ikke forlade den grønne cirkel).
4. **"Udbulings"-effekt ved kant:** Når brugeren trækker plus-cirklen helt ud til kanten af den grønne cirkel (dvs. mod et bestemt valgt segment/retning), skal selve den grønne cirkels kant bule let ud i den retning — ca. 20 pixels udover den grønne cirkels normale radius — som om den lyse plus-cirkel fysisk presser/skubber den grønne cirkels rand ud i den retning, hvor brugeren trækker/vælger. Dette skal give en organisk, blød "udbulings"/"squish"-fornemmelse (formentlig løst med en SVG-path-morph eller CSS-clip-path-animation, der reagerer på drag-positionen), ikke en hård, kantet deformation.

**Status:** Ny funktionsspecifikation, endnu ikke implementeret — kræver formentlig en del custom animations-/interaktionsarbejde (drag-tracking + dynamisk SVG/clip-path-deformation af selve FAB-cirklen). Bør implementeres og verificeres visuelt i en rigtig browserpreview med faktisk touch-/drag-interaktion, ikke kun som statisk CSS.

**Yderligere justering (samme drejehjul-funktion):** De mindre cirkler, der dukker op omkring den grønne cirkel og viser de forskellige valgmuligheder (fx "Tilføj"/"Kamera"/"Søg" el. lign., jf. drejehjulets segment-valg), skal have lidt større afstand ud til selve den grønne cirkel, end de har i dag — dvs. mellemrummet mellem den grønne cirkels kant og hver valgmuligheds-cirkel skal øges en smule.

---

## 31. Søg-siden: "Alle varer"-sektionen giver ikke mening — skal erstattes med Favoritter og Senest anvendte (IMG_1603)

**Skærmbillede:** `IMG_1603.png` (Søg-siden, viser en liste med "Æble"/"Kylling og quinoasalat" øverst, derefter en sektion "Alle varer" med seks tilfældige produkter — Valiojogurtti Banan, Æble/Banan/Jordbær Smoothie, Activia třeseň jablko banán, b-Aktiv SMothie bor banan, SBA Protein Milk Shake Banan, Truskawka marchew jabłko banan)

**Problem — Konceptuel designfejl: "Alle varer"-sektionen er meningsløs i praksis:** Søgesiden viser i øjeblikket en sektion kaldet "Alle varer", som tilsyneladende forsøger at vise et udpluk af ALLE produkter i databasen (heraf flere produkter med udenlandske/ikke-danske navne — polsk, tjekkisk osv. — hvilket tyder på, at det reelt er et vilkårligt uddrag af hele den globale produktdatabase). Dette giver ingen mening som en sektion på en søgeside, når man ikke har indtastet en søgning endnu — det ville i teorien skulle liste et enormt antal (brugeren nævner eksempelvis "20 millioner varer") produkter, hvilket hverken er brugbart eller performant.

**Krav til rettelse — erstat med to meningsfulde sektioner:**
1. **Favoritter (øverst):** Vis brugerens favorit-markerede madvarer/produkter øverst på siden, når der ikke er nogen aktiv søgetekst. Hver række skal vise favorit-ikonet (bookmark, jf. `.hf-favorite-button`/`FavoriteButton` i `design.md` §6.8), så det er tydeligt, at det er favoritter.
2. **Senest anvendte (nedenunder):** Under favoritterne skal der vises en sektion med de produkter, brugeren senest har tilføjet/registreret (dvs. en historik-baseret liste, sorteret efter seneste anvendelse), i stedet for et vilkårligt uddrag af hele databasen.

**Status:** Ikke løst endnu — kræver at "Alle varer"-sektionen fjernes helt og erstattes af de to nye, brugerspecifikke datakilder (favoritter + senest anvendte), som begge kræver forespørgsler afgrænset til den enkelte brugers egne data, ikke hele produktdatabasen.

---

## 32. Landskabs-/liggende visning (bred skærm): header fylder for meget, manglende kompakt footer-adfærd, og kalenderen skal vise 7-dages kolonnevisning (IMG_1604)

**Skærmbillede:** `IMG_1604.png` (Kalender-siden vist i vandret/liggende iPad- eller browser-vindue, hvor den grønne header og bundnavigationen begge fylder uforholdsmæssigt meget af det tilgængelige lodrette skærmareal)

**Kontekst — gentaget krav, tidligere beskrevet men ikke implementeret:** Brugeren har tidligere bedt om, at headeren (den grønne `.hf-appbar`) skal gøres smal/kompakt, MEN kun i den vandrette/brede visning (liggende format) — ikke i den normale, stående (portræt) visning, hvor den nuværende højde skal bevares uændret. Dette er endnu ikke implementeret.

**Problem A — Header fylder for meget i liggende format:** Den grønne header bruger uforholdsmæssigt meget af den tilgængelige lodrette plads, når appen/browseren vises i liggende format (bredt vindue, lav højde). Brugeren anerkender selv, at dette muligvis er svært at løse fuldt ud i en webapp-kontekst (pga. browserens egen UI, adressefelt, faneblade osv., som også fylder i skærmbilledet), MEN uanset skal det forberedes, som hvis det skulle blive til en native app (dvs. selve Hello Cal-appens egen header-komponent skal require en kompakt/lav variant til liggende format, uafhængigt af hvor meget plads browser-chrome'et omkring den fylder).
  - **Krav:** Tilføj en dedikeret, kompakt header-højde-variant, der aktiveres specifikt ved liggende/bred visning (landscape/wide viewport, fx via en CSS media query på `orientation: landscape` eller en bred `min-width`-tærskel), mens den normale, højere header bevares uændret i stående/normal visning.

**Problem B — Bundnavigationen skal kunne minimeres til en "pull-bar" i liggende format:** I liggende format skal bundnavigationen (BottomNav) ikke fylde med sine fulde ikoner/labels som normalt. I stedet skal den som udgangspunkt vises helt smal/minimeret — kun med selve bundnav-baggrundsfarven synlig, og en lille, centreret "pull-bar"/håndtag-streg i midten (samme visuelle idé som iOS' egen "swipe up for hjem"-indikator, eller en bottom-sheet-håndtag-streg), der indikerer, at man kan trykke på den eller trække den opad for at folde selve bundnavigationen (med ikoner/labels) ud igen. Dette er en ny, dedikeret liggende-format-adfærd for `.hf-bottom-nav` og skal ikke påvirke den normale, stående visning.

**Problem C — Kalenderen skal vise en 7-dages kolonnevisning som default i liggende format:** Når appen vises i liggende/bred format, skal Kalender-siden som standard vise en **7-dages kolonnevisning** (dvs. en ugevisning med hver ugedag som sin egen lodrette kolonne, formentlig med tidspunkter/registreringer inde i hver kolonne — svarende til en klassisk "uge"-kalendervisning), i stedet for den nuværende månedsgrid-visning, der er designet til stående format.

**Status:** Ny funktionsspecifikation for liggende/bred visning, endnu ikke implementeret. Alle tre punkter (A, B, C) hænger sammen som én samlet "landscape mode"-tilpasning af app-shell'en og bør designes/implementeres samlet, så de er konsistente med hinanden.

---

## 33. Stemme-siden (registrerede madvarer-liste): mangler favorit-ikon på hver vare-række (IMG_1605)

**Skærmbillede:** `IMG_1605.png` (Stemme-siden, "Tilføjet"-listen med registrerede madvarer som "Rumpsteak og skalotteløgssmør", "Rugbrød, revet, med brunt su...", "Sushiruller med agurk og laks", "Hurtig kylling i tomatsauce", samt en swipe-afsløret "Rediger"/"Slet"-handling på et af elementerne)

**Problem:** Hver vare-række i listen mangler et favorit-ikon (bookmark), svarende til det, HelloFresh benytter på tilsvarende vare-/opskriftsrækker. Den eksisterende `.hf-favorite-button`/`FavoriteButton`-komponent (jf. `design.md` §6.8: 44×44 px rund mørk/translucent overlay-knap med 24×24 hvid outline-bookmark) er indtil videre kun defineret til brug på billedkort — men her mangler en tilsvarende, strategisk placeret favorit-mulighed direkte på liste-rækkerne.

**Krav til rettelse:** Tilføj et favorit-ikon (bookmark) på hver vare-række i denne liste (og tilsvarende lister andre steder, hvor enkelte madvarer/produkter vises i rækkeform), placeret der hvor HelloFresh typisk ville placere det på en tilsvarende liste-række (fx til højre for eller integreret i selve billedminiaturen/thumbnailet, eller som et separat ikon i den højre side af raden ved siden af kcal-tallet — den præcise placering skal findes ved at undersøge HelloFresh's egne referencer for liste-rækker med favorit-funktion, jf. `Hello Fresh inspiration/`, fremfor at gætte).

**Status:** Ikke løst endnu — kræver research af HelloFresh's præcise placeringsmønster for favorit-ikon på liste-rækker (til forskel fra billedkort, hvor placeringen allerede er dokumenteret).

---

## 34. Swipe-actions ("Rediger"/"Slet") på vare-rækker har forkerte farver (opfølgning til IMG_1605)

**Kontekst:** Samme skærmbillede som fejl #33 (`IMG_1605.png`) — swipe-to-reveal-handlingerne "Rediger" (grå baggrund, hvid tekst) og "Slet" (rød baggrund, hvid tekst), der afsløres, når man swiper en vare-række til venstre.

**Problem A — "Slet" skal være sort, ikke rød:** "Slet"-handlingen skal have sort baggrund (`--hf-color-action`, `#232323`) med hvid tekst, i stedet for den nuværende røde baggrund. Dette er en afvigelse fra det generelle mønster andre steder i appen, hvor rød bruges til destruktive handlinger (`--hf-color-danger`) — men her ønskes specifikt sort i stedet, formentlig fordi swipe-to-delete i HelloFresh-stil traditionelt bruger en mørk/sort, ikke rød, baggrund. **Dette bør afklares/dokumenteres eksplicit i `design.md`**, så det er en bevidst, navngivet undtagelse (fx en dedikeret `--hf-swipe-delete`-farve = sort) frem for en tilfældig enkeltstående ændring, der senere kan blive overskrevet igen.

**Problem B — "Rediger" er for mørk grå — mangler en lysere grå-token i temaet:** Den nuværende grå baggrund på "Rediger"-handlingen er for mørk. Brugeren spørger, om der findes en lysere grå i det eksisterende farvetema, og om HelloFresh overhovedet bruger lysegrå noget sted. **Svar/vurdering:** Ja — designkontrakten (`design.md` §3) definerer allerede flere lysere grå/beige-toner, som kan genbruges her i stedet for en ny, mørkere grå: fx `--hf-color-card` (`#EEE9DF`, kortbaggrund), `--hf-color-nav` (`#DFD9CC`, bundnav-baggrund) eller `--hf-color-placeholder`/`--hf-color-disabled` (`#C1C0BE`/`#A6A29F`) til en mere afdæmpet, lys grå-beige "Rediger"-baggrund — dog skal tekstfarven i så fald ændres fra hvid til en mørk tekstfarve (`--hf-color-text`, `#242424`), da hvid tekst ikke vil have tilstrækkelig kontrast på en lys baggrund. Den præcise valgte token bør besluttes og dokumenteres centralt (fx som en ny `--hf-color-swipe-edit`-rolle), så "Rediger"-handlingen bruger samme farve alle steder, hvor swipe-to-edit forekommer.

**Status:** Ikke løst endnu. Begge farver bør fastlægges som nye, navngivne semantiske tokens (`--hf-swipe-delete`/sort og en lysere `--hf-swipe-edit`-grå/beige) i `design.md`, så ændringen er konsistent og ikke skal gættes på ny senere.

---

## 35. Ny funktionsspecifikation: "Rediger"-swipe-handlingen skal åbne selve varen med "Anvend ændring" og "Indberet fejl"

**Kontekst:** Uddybning af, hvad "Rediger"-swipe-handlingen (fra fejl #34) faktisk skal gøre, når man trykker på den.

**Ny funktionsspecifikation:**
1. Når brugeren trykker "Rediger" på en vare-række (swipe-to-reveal-handlingen), skal det ende på selve varens detaljevisning/redigeringsside for den pågældende registrering (dvs. samme type side som Tilføj-siden for varen, men i redigeringstilstand for en allerede registreret post).
2. På denne side skal der være en **"Anvend ændring"-knap** (primær CTA), som gemmer brugerens ændringer.
3. Under "Anvend ændring"-knappen skal der stå en lille hjælpetekst, der forklarer, at ændringen **gemmes lokalt** (dvs. præcisere for brugeren, at redigeringen kun påvirker denne registrering hos brugeren selv, ikke den centrale/delte produktdatabase).
4. Under denne hjælpetekst skal der være en separat **"Indberet fejl"-knap**. Denne knap er begrundelsen for, at man overhovedet ville vælge at redigere en vare i første omgang (dvs. hvis brugeren opdager forkerte data på et produkt, er "Rediger" ikke kun for at rette sin egen registrering, men også en indgang til at gøre opmærksom på en fejl i den underliggende produktdata). Denne knap skal føre videre til den eksisterende "Indberet fejl"-side (jf. fejl #14).

**Status:** Ny funktionsspecifikation, endnu ikke implementeret — kræver en ny/udvidet redigeringsside for enkelte registreringer, samt et link derfra videre til den eksisterende Indberet fejl-side.

---

## 36. Vare-rækkens ned-pil ("⌄") skal fjernes og erstattes af favorit-ikon (opfølgning til IMG_1605/fejl #33)

**Kontekst:** Uddybning af, hvordan vare-rækkerne (fx i fejl #33/#34's liste) skal se ud og opføre sig.

**Problem — Overflødigt/misvisende ned-pil-ikon (chevron):** Vare-rækkerne viser i øjeblikket en lille ned-pil ("⌄") til højre for kcal-tallet på hver række. Denne skal fjernes. Begrundelse: at klikke/trykke på selve varen fører allerede brugeren videre til varens egen detaljeside (som har sin egen "Tilføj"-knap i bunden, jf. Tilføj-siden andre steder i denne log) — ned-pilen antyder fejlagtigt, at der er en udfoldelig accordion direkte i listen, hvilket ikke er den faktiske adfærd.

**Krav til rettelse:**
1. Fjern ned-pil-ikonet (chevron) fra vare-rækkerne.
2. Erstat det med favorit-ikonet (bookmark, jf. fejl #33's krav om favorit-ikon på vare-rækker), placeret i samme område af raden, hvor ned-pilen sad.
3. **Vigtig detalje om favorit-ikonets visuelle placering:** Favorit-ikonet skal fremstå let "ophøjet"/hævet i forhold til selve tekstlinjen — dvs. det skal IKKE sidde centreret vertikalt på linje med resten af rækkens tekst (varenavn/kcal), men i stedet være løftet en smule op (fx justeret mod den øverste del af raden), så det fremstår som et let adskilt, "svævende" element frem for et almindeligt inline-ikon midt i teksten.

**Status:** Ikke løst endnu — hænger direkte sammen med fejl #33 (skal implementeres samlet: fjern chevron, tilføj favorit-ikon med den beskrevne, let hævede placering).

---

## 37. Stemme-siden: mikrofonens standardtilstand er omvendt, og transkriptionsfeltet mangler korrekt tastatur-adfærd

**Kontekst:** Stemme-siden (samme side som fejl #33-#36), hvor brugeren optager/taler madvarer ind via mikrofon-ikonet, og talen transskriberes til et tekstfelt.

**Problem A — Mikrofonens start-/stop-logik er omvendt (GENTAGET krav, tidligere beskrevet):** Brugeren har allerede tidligere bedt om, at mikrofonen som udgangspunkt skal være **tændt/optagende som standard**, når man trykker på mikrofon-ikonet for at gå ind på siden/starte funktionen — og at man i stedet skal kunne **PAUSE** optagelsen ved at trykke på ikonet igen. Den nuværende implementering har tilsyneladende den modsatte rækkefølge (dvs. mikrofonen starter slukket, og man skal trykke for at starte optagelse). Dette skal vendes om: default = optager, tryk = pause.

**Problem B — Transskriptionsfeltet kan ikke redigeres korrekt manuelt:** Man skal kunne skrive/redigere direkte i tekstfeltet, der viser den transskriberede tale. I øjeblikket kommer det native tastatur godt nok frem, når man trykker i feltet, men der er ingen måde at afslutte/bekræfte redigeringen på — der findes ikke nogen synlig "Gem"-knap eller tilsvarende afslutningshandling.

**Krav til rettelse (Problem B):** Når brugeren trykker "Enter"/"Retur" på tastaturet, skal det:
1. Beholde/gemme den indtastede tekst i feltet (ikke slette eller annullere den).
2. Fjerne/lukke det native tastatur igen (dvs. `blur()` feltet), så brugeren vender tilbage til den normale visning af siden.

**Status:** Ikke løst endnu. Problem A er et GENTAGET krav — samme type situation som tidligere gentagne, ikke-implementerede krav i denne log (jf. #7, #29A) og bør derfor tjekkes ekstra grundigt for, om en tidligere rettelse er gået tabt. Problem B er en ny, konkret adfærdsrettelse til tekstfeltets tastatur-håndtering.

---

## 38. Stemme-siden: ny "nulstil session"-knap i tekstgenkendelsesvinduet

**Kontekst:** Samme tekstfelt/transskriptions-vindue som fejl #37.

**Ny funktionsspecifikation:** Øverst i højre hjørne af tekst-genkendelses-/transskriptionsvinduet skal der tilføjes en **sort, cirkulær nulstil-knap** (reset). Ved tryk skal den slette/nulstille:
1. Den aktuelle skærms indhold (fx den viste, transskriberede tekst).
2. Alt, hvad der er blevet foreslået/genkendt i den igangværende session (dvs. hele den aktuelle tale-til-tekst-arbejdsgang skal nulstilles, ikke kun det synlige tekstfelt — evt. mellemliggende AI-genkendte forslag, delvist udfyldte varer osv. skal også ryddes).

**Bemærkning om ikon-genbrug:** Selve nulstil-ikonet skal genbruge den centrale nulstil/refresh-ikon-komponent, der allerede er besluttet i fejl #8 (en enkelt cirkulær pil) — dog specificeres her, at knappens baggrund i denne kontekst skal være **sort** (ikke grøn uden baggrund, som i #8's oprindelige beslutning). Dette er en anden variant/kontekst af samme grundikon og bør afklares, om det skal være to forskellige, navngivne varianter (fx en "ghost"-variant uden baggrund til generel brug, og en "solid/sort cirkel"-variant specifikt til denne "nulstil session"-handling), eller om det er en uoverensstemmelse, der skal harmoniseres til én fælles stil. **Handling for Claude:** Afklar dette som en del af implementeringen af #8, så begge steder ender med et bevidst, dokumenteret valg.

**Status:** Ny funktionsspecifikation, endnu ikke implementeret — bør designes samlet med nulstil-ikon-beslutningen fra fejl #8.

**Præcisering/rettelse fra brugeren:** Nulstil-knappen skal KUN slette/nulstille selve teksten i transskriptions-/tekstgenkendelsesfeltet — ikke de allerede genkendte/foreslåede varer (madvarerne, der er identificeret ud fra teksten). Punkt 2 i beskrivelsen ovenfor ("Alt, hvad der er blevet foreslået/genkendt i den igangværende session") er dermed for bredt formuleret og skal indskrænkes: kun tekstfeltets indhold ryddes, de fundne/foreslåede varer i sessionen berøres ikke.

---

## 39. Verificeringsopgave: er bundnavigationens inaktive gråfarve rent faktisk 1:1 med HelloFresh?

**Spørgsmål fra brugeren:** Er det bekræftet, at den grå farve, der bruges til IKKE-valgte/inaktive ikoner i bundnavigationen, er nøjagtig den samme, som HelloFresh bruger — brugeren oplever, at der ikke er stor synlig farveforskel mellem aktiv og inaktiv tilstand, og er i tvivl om, hvorvidt den korrekte token rent faktisk er implementeret i koden.

**Svar givet i chatten:** `design.md` §3 og §6.10 dokumenterer allerede en målt/besluttet værdi for dette: `--hf-color-text-secondary` (`#656565`) til inaktive bundnav-labels, over for `--hf-color-action` (`#232323`) til den aktive. Værdien `#656565` er desuden bekræftet via den officielle web-krydskontrol i §2.1. Om denne token rent faktisk ER anvendt korrekt i den nuværende `BottomNav`-kildekode (og ikke fx en anden, lignende grå-token eller en hardkodet farve, jf. fejl #12 i `design.md`'s audit-afsnit DES-012, der nævner "baggrunden kommer fra den forkerte `--hf-tan`") kan ikke bekræftes 100% uden at læse selve koden og måle den faktiske computed style i en frisk visning. **Brugeren har bedt om, at det efterlades som det er, hvis Claude er sikker — men da denne besvarelse ikke er baseret på en faktisk kodeverifikation, er dette punkt IKKE fuldt bekræftet og bør verificeres eksplicit (læs `BottomNav`-komponenten, mål computed color på et inaktivt ikon i en frisk browserpreview) næste gang siden røres.**

**Status:** Uafklaret — kræver en faktisk kode-/visuel verifikation, før det kan afkrydses som bekræftet. Indtil da: efterlades urørt, som brugeren bad om, men markeret her som en åben verificeringsopgave.

