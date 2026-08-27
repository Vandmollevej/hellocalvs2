# UI/UX — HELLO CAL

Se [SPECIFICATION.md](SPECIFICATION.md) for det samlede overblik.

> Ny, endnu ikke implementeret kravspec (kalender, statistik, madvareside, FAB,
> bundmenu, accordion/chevron m.m.): se [UI-KRAVSPEC-2026-08-27.md](UI-KRAVSPEC-2026-08-27.md).

## Visuelt designsystem — HelloFresh-stil

Fra og med implementeringsfasen skal appens generelle visuelle stil (farver, fonte, knapstørrelser, boksdesign) lægge sig tæt op ad HelloFreshs app — **undtaget forsiden med halvcirkel-knappen og drejehjulet, som ikke må ændres**.

- **Farver:** Grøn header/primærfarve (`--hf-green`), cremet/beige sidebaggrund (`--hf-cream`), tan/beige accordion- og kortbokse (`--hf-tan`), sort tekst og sorte pilleformede knapper (`--hf-black`).
- **Typografi:** Fed, sort/hvid tekst på headere og knapper.
- **Accordion-mønster:** Indstillinger og lignende lister opbygges som cremede/tan rundede kort med chevron-rækker (ikon til venstre, label, ">" til højre), grupperet i separate kort — matcher HelloFreshs Indstillinger-skærm.
- **Ingrediens-/kalorieopstilling:** Skal genbruge HelloFreshs ingrediensliste-design (cirkulære ikoner pr. ingrediens, fed mængde + navn).
- **Kamera/hero-billedeområde:** Samme højde som HelloFreshs opskriftsheader, hvor billeder af retter/kamera-preview vises.
- **Favorit-ikon:** Bookmark-ikon (som i HelloFresh), ikke stjerne — bruges dog stadig ikke på selve forsiden/drejehjulet.
- **Søgning/råvarer:** Kan vises som kort-gitter à la HelloFreshs "Leder du efter inspiration"-sektion.
- Implementeret i kode som CSS-variabler/Tailwind-tokens (`bg-hf-green`, `bg-hf-tan`, `text-hf-black` m.fl. i `globals.css`) og genbrugelige komponenter i `src/components/hf/` (`ScreenHeader`, `AccordionCard`/`ChevronRow`), så stilen er konsistent og ikke skal genopfindes pr. skærm.

## Designprincipper

- Færrest mulige tryk/valg. AI foreslår, brugeren godkender. Smarte standardvalg. Avancerede muligheder gemmes bag "Rediger"/"Mere".
- Brugeren skal som udgangspunkt kun godkende, ikke indtaste.
- Ingen "Gem"-knap noget sted — alt gemmes automatisk løbende. "Luk"/"Annuller" er de eneste relevante lukkehandlinger.
- Tilføj-dialoger vises altid på én skærm uden scrolling.
- Kort tryk = åbn/se detaljer. Langt tryk = tilføj direkte som ny registrering (visuel "Tilføjet"-animation). Gælder favoritter, tidligere brugte, søgeresultater, kalender og statistik.
- Kalenderen viser en rolig rød markering, når en dags mål ikke er nået, og en grøn stjerne-streak (antal dage i træk) fra 5 dage og opefter — ellers ingen kunstige "Du er fantastisk!"-beskeder.
- Kalenderen kan vises som måned, uge eller liste via ikonet øverst til højre.
  Vandret swipe og pile skifter periode, månedstitlen åbner alle årets måneder,
  og tryk på en dato åbner dagens gemte registreringer.
- I kalenderen markeres en dag med opfyldt mål diskret med en 1 px grøn ramme
  og et lysegrønt flueben øverst til højre. Dags dato har grøn baggrund.

## Navigation

- Bundnavigation med fire faner: **Tilføj** (hjem), **Madvarer**, **Kalender**, **Statistik**.
- Hovedfaner skiftes med vandret swipe. Swipet deaktiveres, når et fuldskærmsvindue er åbent.
- Historik ligger under profilmenuen, ikke i bundnavigationen.
- Øverste bjælke (på forsiden): venstre tom, højre en cirkel med brugerens initialer — tryk åbner en kort menu: Profil, Indstillinger, Privatliv, Log ud.

### Indstillinger — struktur

Indstillinger er opdelt i fire sektioner:

- **Mine oplysninger** — navn, e-mail (med bekræftelsesflow ved ændring), adgangskode/loginmetoder (Apple, Google, e-mail, 2FA, passkeys), dataeksport, **slet konto** (kræver "SLET").
- **Udseende** — tema (Lys/Mørk/Følg system), Dynamic Type/tekststørrelse.
- **Præferencer** — emnerne opstilles i clusters (grupperede kort), bl.a.:
  - *Sprog og format*: appsprog, dato/tid/tal-format, kcal/kJ.
  - *Notifikationer*: afkrydsning pr. type, "Slå alle til"/"Slå alle fra".
  - *Interaktion*: position af +-knappen (venstre/højre), intelligente tips til/fra, statusbjælke for onboarding til/fra.
- **Integrationer** — Fitbit, Apple Health, Google Health Connect, smartvægt (pr. datatype/på-off, write-only).

"Aktive enheder" er **ikke** en del af Indstillinger — funktionen bruges ikke.

## Forsiden ("Tilføj")

- Central, halvcirkelformet **+**-knap i bunden af skærmen (ca. 1/3 af skærmbredden), placeret i den ergonomiske tommelfingerzone. Position kan flyttes venstre/højre i Indstillinger.
- Tryk på +-knappen åbner en radial menu med fire ikoner — **Måltid** (tallerken med kniv og gaffel), **Kamera**, **Søg**, **Mikrofon** — med en kort åbne-/lukke-animation (150-200 ms). Menuen lukker automatisk igen.
- "Måltid" åbner kameraet med tallerken-guide (til madfotografering). "Kamera" åbner kameraet uden tallerken-guide — kun en generisk fokusramme — til produkter/stregkoder/emballage. Kameraet er stadig intelligent og kan selv genkende typen, men indgangsikonet sætter den forventede kontekst.
- Ved siden af +-knappen: et lodret nøgletalspanel udformet som et drejehjul/urskive. Hvert tal har et ikon placeret FORAN tallet (ikke efter). Det midterste tal er altid størst og tydeligst (kalorier som standard) med et flamme-ikon; tallene over og under vinkles let og er svagere, som på en urskive, hver med sit eget ikon (fx en gåfigur for skridt, et æg-ikon for protein). Lodret swipe, scroll, tryk på nabotallet eller tastaturets pile roterer panelet, så et nyt tal bliver midtstillet og forstørret.
- Statistik-ikonet i bundnavigationen skal være en tydelig, tyk opadgående kurve med tre markerede knækpunkter (prikker) — ikke en spinkel linje.
- Under det store centrale tal vises totalen (fx "/ 3.299 kcal") som en mindre linje nedenunder — ikke på samme linje som selve tallet, så det ikke bliver for langt.
- Rækkefølgen af nøgletal, hvilket der vises som standard i midten (kalorier som standardvalg) og hvilket ikon der bruges pr. nøgletal kan indstilles under profilindstillinger → Præferencer.
- Bunden af dagens registreringer toner ud (fade to baggrundsfarve) lige inden bundnavigationen, som et visuelt hint om at listen kan scrolles.
- Under +-knappen: dagens registreringer som en lodret, scrollbar tidslinje, nyeste øverst. Hver række viser tidspunkt til venstre, titel i midten (maks. to linjer, herefter ellipsis), kalorier under titlen, og en kvadratisk miniature til højre. Miniaturen bevarer billedformatet uden forvrængning (center-cropped) og er altid kvadratisk, uanset kildebilledets format.
- Tryk på en registrering åbner den direkte i fuld skærm til redigering (ingen preview).
- Swipe venstre på en registrering viser en rød "Slet"-knap (som i Mail-appen). Intet slettes ved selve swipet — kun ved tryk på Slet. Ingen bekræftelsesdialog, ingen fortryd-bjælke.
- Swipe højre på en registrering = Favorit (opretter en duplikat til hurtig genbrug senere).

## Layout-konsistens

- Den samme topbjælke og den samme bundnavigation (fire ikoner) vises konsekvent på alle skærme — også Tilføj, Kamera, Stemme og Søgning. Der er ikke en særskilt "luk"/"annuller"-krydsknap, som fjerner den faste ramme; indholdet skifter, men rammen foroven og forneden er identisk overalt.
- Topbjælken viser "HELLO CAL" (tekst-logo) i venstre hjørne og profilcirklen i højre hjørne — modsatte hjørner.
- Handlingsknapper som "Tilføj" vises som en lille, rund plus-knap i stedet for en stor fuldbredde-knap, så der er mere plads til selve indholdet.

## Accordion — udvidelse af en vare i en liste

- I enhver liste med varer/ingredienser (fx under stemmeoptagelse, eller den almindelige produktliste) kan brugeren trykke på en vare for at folde den ud accordion-stil. Den udfoldede vare rykker op i toppen af listen, så der er mere plads til at læse og redigere.
- Header-rækken (billede, titel, kalorier) er identisk i sammenfoldet og udfoldet tilstand — kalorier flytter/forsvinder ikke ved udfoldning. Fold-op-pilen er en smal, separat bjælke centreret lige under header-rækken, ikke en del af selve rækken.
- I den udfoldede tilstand kan brugeren redigere: mængde (med -/+ trin). Kalorier vises kun i header-rækken, ikke duplikeret nedenunder.

- Under taleoptagelse står den løbende transskription øverst, direkte under en
  standmikrofon i en cirkel. Cirklen pulserer, mens AI omformer talen til felter.
  Fundne retter, madvarer og ingredienser vises nedenunder i samme rækkestil som
  "Dagens måltider". Når talen er færdigbehandlet, kan brugeren redigere de
  fundne felter eller trykke "Godkend".
- "Energifordeling" vises som en fed overskrift med god luft ned til indholdet. Protein, kulhydrat og fedt vises hver med egen slider til at justere gram. Gramtallet vises stort nok til at kunne trykkes på for manuel indtastning (ikke kun styres via slideren).
- Øvrige varer i listen forbliver kompakte nedenunder, mens den valgte vare er foldet ud.

## Registreringsdetaljer

- Øverst: Annuller til venstre (kasserer ændringer siden åbning), Luk til højre (ændringer er allerede gemt løbende).
- Dagens nøgletal/totaler opdateres kun, når detaljevinduet lukkes — ikke løbende under redigering.
- Detaljevinduet åbner altid i fuld skærm, aldrig som bottom sheet eller popup. Swipe/tilbage svarer til Luk, ikke Annuller.
- Layout: øverste halvdel viser billedet med AI-markeringer. To små runde knapper øverst til højre på billedet (søgeikon + ingrediens/analyse-ikon). En mikrofonknap nederst på billedet til at indtale rettelser eller manglende ingredienser.
- Billedet vises som en mindre thumbnail i selve detaljevisningen (ikke fuld bredde). Langt tryk åbner fuld størrelse med AI-markeringer og ingredienslisten vist nedenunder.
- Ingredienslisten under billedet: "+" øverst til manuel tilføjelse af ingrediens, "-" pr. ingrediens til fjernelse. Swipe-til-venstre sletter også en ingrediens.
  - Tryk på "+" åbner et tomt tekstfelt med løbende søgeforslag.
  - Tryk på søgeikonet skubber detaljevinduet 2/3 mod højre og åbner en søgeflade i den venstre 1/3 (samme design som forsidens søgning). Lukkes ved tryk på den synlige 2/3-del, tryk på 1/3-panelet, eller swipe fra højre mod venstre.
  - Tryk på en enkelt ingrediens åbner et separat detaljeoverlay i den nødvendige højde (ikke altid fuld skærm), med et 80 % hvidt overlay på baggrunden. Lukkes ved swipe til siden, tryk udenfor, eller swipe op på billedet.
- Ingredienslisten vises som en flad liste, én ingrediens pr. række, uden gruppering. Rækkefølgen er fast og kan ikke ændres af brugeren.
- Titlen er AI-genereret som standard og redigeres direkte ved tryk på teksten — ingen separat redigeringsknap.
- Kalorier er låst, når de stammer fra en emballages næringsdeklaration (redigeres kun via mængde). For AI-estimerede retter kan kalorietallet overskrives manuelt; sletning af den manuelle værdi gendanner AI's standardværdi.
- Ingen synlig "sidst redigeret"-tidsstempel — kun i loggen.

## Madvarer-siden / "Mit bibliotek"

- Samlet liste over madvarer, drikkevarer og retter (erstatter separate lister), med tre faner (Madvarer/Drikkevarer/Retter), et tværgående søgefelt, filtre (type + brand) og sortering (nyeste/ældste/alfabetisk).
- Favoritter er et filter ovenpå biblioteket, ikke en separat liste eller et separat stjerneikon.
- Statistik (fx antal gange brugt) vises kun ved åbning af det enkelte produkt, ikke i listen.
- En vare forbliver i "Tilføjet mad"-listen, så længe den er registreret på mindst én dag ELLER er favorit — fjernes automatisk, når begge betingelser ophører.
- "Erstat produkt" bevarer den valgte mængde og spørger, om ændringen kun skal gælde den aktuelle registrering eller også tidligere (med advarsel ved historik-ændring).
- Ingen "fortryd" (undo) med 10-15 sekunders tidsvindue — i stedet findes en "Historik"-log nederst på siden med en fortryd-knap pr. handling. Historikken dækker hele kontoen, kronologisk opdelt efter år/måned, og logger kun ændringer/tilføjelser (ikke søgninger eller visninger). Ingen filtre i historikken.

## Søgning

- Søgefeltet søger på tværs af alt (mad, drikke, retter). Faner bruges kun til at gennemse en liste, ikke som filter under en aktiv søgning.
- Søgeresultater viser ingen kategorier og ingen labels som "Populær"/"Ny"/"Ofte valgt af dig" — kun "Tidligere valgt" for brugerens egne tidligere registreringer, klikbar for detaljer.
- Søgeresultat-række viser kun titel + produktbillede + en "TILFØJ"-knap. Tryk på titlen åbner produktsiden med en TILFØJ-knap i toppen.
- Et produkt med flere pakkestørrelser vises som én vare; undervarer (samme indhold, andre størrelser/stregkoder) vises på produktsiden. Appen vælger automatisk senest anvendte pakkestørrelse.
- Prioritering: favoritter → tidligere brugte → øvrige relevante → udgåede nederst. Maks. seks primære resultater — ingen "vis flere"-knap, kun scroll.
- Søgning opdateres løbende, mens brugeren skriver (ikke ved tryk på "Søg").
- Automatisk rettet søgning viser en lille tekst "Søger på: [rettet tekst] ✕" (Google-stil) — krydset fjerner rettelsen og søger på originalen. Personlig historik/favoritter/hyppighed påvirker rettelser og rangering; kan slås fra under Indstillinger → Privatliv.
- Inline autosuggestion vises som lysere tekst direkte i forlængelse af det skrevne (Safari/Spotlight-stil) — ikke en separat forslagsliste under feltet.
- Er resultatet ikke klart hurtigt, sløres resultatblokken diskret i stedet for at vise forkerte/gamle resultater.
- Enter vælger aldrig automatisk et resultat — et produkt vælges altid ved aktivt tryk.
- Tomt søgefelt viser favoritter og tidligere tilføjede, med produktminiaturer i resultatlisten.

## Scanning

- Alle synlige stregkoder markeres med gule bokse (også når der kun er én) og læses parallelt i baggrunden — scanneren låser sig ikke til den første kode.
- EAN/GTIN har altid førsteprioritet. Giver én kode et kendt match, åbnes produktet direkte i registreringsvinduet (ikke auto-tilføjet). Flere gyldige match viser en liste med miniature/navn/størrelse/mærke.
- Irrelevante koder (QR-links, pant-, logistik- og emballagekoder) kan blacklistes globalt og ignoreres fremover (admin styrer listen).
- Scanneren foretrækker altid enkeltkolli frem for sampak. Scannes en sampak, åbnes det tilsvarende enkeltprodukt som 1 stk. — brugeren vælger derefter gram eller antal.
- Ved stregkodescan vises det bedste match i en boks mærket "Match!" med navn, brandlogo, billede, pakkestørrelse og en TILFØJ-knap.

## Ukendt stregkode

- Guidet firetrins-proces med fremdriftsindikator (1/4 osv.): stregkode, emballage/forside, næringsdeklaration, ingrediensliste/indhold.
- Efter hvert billede går appen automatisk videre. Øverst findes Forrige, Næste og Spring over.
- Produktet gemmes som kandidat til den fælles database og afventer administratorens godkendelse.

## Ingredienser og produkter

- Ingredienslisten viser én ingrediens pr. række uden gruppering eller manuel rækkefølge. Tryk på en ingrediens åbner et separat detaljeoverlay i den nødvendige højde med 80 % hvidt baggrundsoverlay.
- Langt tryk på et produktbillede åbner fuld størrelse med swipe mellem flere billeder; en indikator (fx 3/5) står i højre hjørne lige under billedet.
- Foreslå ændring: et trekantet info-ikon med "i" øverst i produktvinduet åbner en dialog med "Foreslå ændring", der fører til et vindue med redigerbar næringstabel, tekstfelt, vægt og mulighed for at uploade/tage flere billeder. Forslag godkendes af administrator; brugeren ser resultatet som en meddelelse (indsendt/godkendt/afvist), ikke en separat statusoversigt.
- Ingrediens- og opskriftsdetaljer har Apples standard Share-ikon (kvadrat med pil op) øverst til højre — ikke et brugerdefineret deleikon.

## Gruppechat (UI)

- Én permanent, kronologisk tråd pr. gruppe — som en WhatsApp-gruppe, kun tekst.
- Understøtter: svar, et fast begrænset sæt reaktioner, læsekvitteringer, leveringsstatus, skriveindikator, online/sidst set, @omtaler (valgt fra medlemsliste), redigering og sletning af egne beskeder (ubegrænset i tid).
- Ingen billeder, video, lyd, filer, GIF'er, klistermærker, private beskeder, fastgjorte beskeder eller søgning i selve chatten.
- Delte milepæle vises som automatiske opslag med én kommentar-/reaktionstråd, synlig for alle inviterede i gruppen.

## Meddelelser og notifikationer

- Under profilikonet findes "Meddelelser", som samler alle notifikationer. Nyeste vises øverst.
- Til venstre vises et typeikon (fx cirkel med "G" for gruppe, flueben for godkendt, kryds for afvist, pil for opdatering, udråbstegn for system).
- Ulæste meddelelser: lys baggrund, fed tekst, høj kontrast. Læste: lysegrå baggrund, ikke-fed tekst, lavere kontrast.
- Ingen badges eller tællere på app-ikonet eller i appen. Ny besked på en delt milepæl vises som en lille orange cirkel delvist ovenpå meddelelsesikonet.
- Swipe venstre på en meddelelse viser Slet (ingen "Slet alle", ingen bekræftelse). Meddelelser åbner i et nyt fuldskærmsvindue, lukkes med sideswipe, swipe op eller et X øverst.
- Notifikationsindstillinger: afkrydsningsfelt pr. type, plus samlet "Slå alle til" og "Slå alle fra".

## Onboarding og hjælp

- Tvungen, interaktiv onboarding ved første login — en modal der ikke kan lukkes (kun "Vis senere" i første omgang); ved efterfølgende visning tilføjes "Vis ikke igen". Kan altid genstartes under Indstillinger.
- Læres ved at udføre handlinger (fx holde en finger nede på en vare), ikke via lange forklaringer. Resten af skærmen dæmpes, kun den relevante knap er aktiv.
- Kontekstuelle "intelligente tips" vises, hvis en bruger aldrig har brugt en funktion (fx langt tryk) — kan slås til/fra i Indstillinger.
- En statusbjælke øverst viser hvor stor en procentdel af onboardingen der er gennemført (kan skjules i Indstillinger). Klik åbner de resterende punkter. Et punkt markeres kun som gennemført, når brugeren selv har udført handlingen.
- Hver hovedfane har en sammenklappet hjælpesektion nederst på siden, foldet sammen som standard.

### Opsætningsguide (fuldskærm, ved første konto)

- Første gang brugeren opretter sig, vises en fuldskærms opsætningsguide med tydelig trin-for-trin-progression (fx "Trin 3 af 10"). Progressionen kan også ses senere på profilniveau.
- Nederst i guiden: "Næste", "Påmind mig senere", og "Vis ikke igen" (sidstnævnte vises først, når brugeren allerede har valgt "Påmind mig senere" mindst én gang — samme mønster som den øvrige tvungne onboarding ovenfor).
- Søvnspørgsmål: "Har du et fast søvnmønster?" (Ja/Nej). Hvis nej: "Skyldes det varierende arbejdstider eller natarbejde?" (Ja/Nej). Hvis ja til det: aktivér `shiftWorkEnabled`, og spørg om brugeren ønsker at registrere arbejdstider eller søvntider dagligt (`dailyLogPreference`).
- Smartwatch/sundhedsdata: spørg om import fra smartwatch/sundhedsapp. Vis én positiv handling ("Opsæt nu") — ikke tre ligeværdige valg — ellers fortsætter brugeren blot med "Næste". Kan sættes op senere under personlige oplysninger (Profil).
- Arbejdstider i kalenderen: guiden kan også spørge, om brugeren ønsker mulighed for at registrere arbejdstider direkte i kalenderen (`workHoursInCalendarEnabled`).
- Implementeringsstatus: kun disse tre spørgsmål er specificeret og bygget i dag (`src/components/OnboardingWizard.tsx`); guidens fulde ti-trins indhold (mål, aktivitetsniveau m.m. fra §5) er endnu ikke specificeret og tilføjes til komponentens `ALL_STEPS`-liste, når det besluttes. Se `docs/DECISIONS.md` (2026-08-27).
