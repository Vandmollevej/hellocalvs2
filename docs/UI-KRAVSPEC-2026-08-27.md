# Hello Cal – samlet design- og funktionskravspec (2026-08-27)

> Modtaget fra brugeren 2026-08-27 som en samlet liste af designkrav og UI-ændringer,
> baseret på HelloFresh-referencebilleder. Endnu ikke implementeret — se
> [STATUS.md](STATUS.md) for hvad der rent faktisk er bygget. Dette dokument er
> kravgrundlaget og må ikke slettes eller forkortes; marker punkter som
> implementeret i STATUS.md efterhånden som de bygges, ret ikke i selve kravene
> her uden brugerens godkendelse.

## 1. Kalender – månedsvisning

### 1.1 Statusmarkeringer

- Flueben for dage, hvor målet er nået, skal være mørkegrønne.
- Brug samme mørkegrønne farve som appens header.
- Der må ikke være ring/cirkel omkring dage, hvor målet er nået.
- De dage skal ellers se neutrale ud som de øvrige dage.
- Hvis målet ikke er nået:
  - vis et rødt minus-tegn, ikke et kryds/luk-ikon.
  - minus-tegnet skal have samme visuelle størrelse/proportion som fluebenet.
  - brug Hello Cal/HelloFresh-palettens røde accent, hvis en sådan allerede findes.
  - ellers definer en passende mørkerød nuance i den faste palette.

### 1.2 Markering af dags dato

- Den grønne ramme omkring en dato må kun bruges til dags dato.
- Den grønne ramme må ikke bruges som indikator for, om et mål er nået.

### 1.3 Tidligere og kommende dage

- Datoer fra forrige måned skal stadig vises, hvis de indgår i den aktuelle kalenderuge.
- Tidligere dage må gerne have statusmarkeringer.
- Flueben for tidligere dage skal fortsat være grønne.
- Det er kun selve datoen fra den tidligere måned, der skal være visuelt nedtonet.
- Denne nedtoning gælder kun tidligere dage, ikke kommende dage.

### 1.4 Fast grå palette

- Undgå mange tilfældige grånuancer.
- Definér en fast neutral palette med fx: lys grå, mellemgrå, mørkegrå.
- Genbrug de samme nuancer konsekvent.
- Den grå farve, der bruges til datoer fra forrige måned, kan fx også bruges til andre
  nedtonede elementer og kalenderomkransninger.

## 2. Kalender – månedlig status nederst

Den nuværende forklaring om grøn ramme/flueben skal fjernes.

### 2.1 Primær månedsstatus

Vis en statuslinje under kalenderen.

Hvis brugeren er inden for målsætningen:
- Vis grønt flueben.
- Tekst på samme linje: `Du er inden for din målsætning. Du har X kalorier til gode.`
- Kalorietallet `X` skal være sort og fed.
- Resten af teksten skal bruge samme grå tekstfarve som den eksisterende forklaring,
  men i større størrelse.

Hvis brugeren ikke er inden for målsætningen:
- Vis rødt minus-tegn.
- Tekst på samme linje: `Du er ikke inden for din målsætning. Du har overskredet med X kalorier.`
- Kalorietallet `X` skal være sort og fed.
- Resten af teksten skal være grå og visuelt rolig.

### 2.2 Seneste 7 dage

Under månedsstatus vises en mindre sekundær linje:
- `Over de sidste syv dage er du over/under din målsætning.`
- Denne linje skal være mindre og/eller lysere end primær status.
- Ingen flueben eller minus foran denne linje.

### 2.3 Streak

Over månedsstatus kan der vises en streak-indikator:
- Vis kun streak, hvis brugeren har nået målet mindst 5 dage i træk.
- Vis en stjerne med antal streak-dage inde i stjernen. Eksempel: stjerne med `5`.
- Så snart streaken brydes, skal indikatoren forsvinde.

### 2.4 Målopfyldelse i antal dage

Vis en tredje statuslinje, fx: `5 ud af 23 dage har du opnået din målsætning.`
- For tidligere måneder skal teksten stå i datid.
- For indeværende måned skal den stå i nutid.

## 3. Kalender – header og visningsvalg

### 3.1 Kalenderikon og initialer

- Brugerens initialer i headeren skal fortsat bruges som adgang til personlige indstillinger.
- Kalenderikonet skal stå foran overskriften `Kalender`.
- Under kalenderikonet skal der være en lille hvid pil ned.
- Pilen skal gøre det tydeligt, at ikonet åbner et valg af kalendervisning.

### 3.2 Visningsvalg

Dropdown/menuen skal bl.a. indeholde: Måned, Listevisning, relevante øvrige visninger.

Den nuværende visning, der viser cirka 7 dage som klikbar liste, skal hedde `Listevisning`.

## 4. Listevisning – ugevisning som liste

Listevisningen er i praksis en ugevisning.

### 4.1 Struktur pr. dag

Hver række skal vise: ugedag, dato, statustekst, kalorier, flueben eller minus til sidst.
Ugedagen skal ellers bevare sit nuværende design og placering.

### 4.2 Datoboks

- Datoen skal stå inde i en lille omkransning/boks.
- Formen skal visuelt ligne datoboksen i kalenderen.
- Standardrammen skal være mellemgrå.
- Dags dato kan bruge den grønne markering.
- Brug en eksisterende grå nuance fra den faste palette.

### 4.3 Statustekst

Erstat eksisterende tekster som `Se dagen` / `Dagens mål er opnået` med mere direkte
status: `Du nåede dit mål` eller `Du overskred dit mål`.

### 4.4 Kaloriefarver

- Hvis målet er nået: kalorietallet vises grønt.
- Hvis målet ikke er nået: kalorietallet vises sort.
- Undgå at gøre for mange elementer røde; det skal ikke føles demotiverende.

### 4.5 Statusikonets placering

- Flueben/minus skal stå til sidst på rækken.
- Det må ikke stå foran indholdet.

### 4.6 Fjern forældet ring-forklaring

- Fjern enhver forklaring om ring omkring dage, hvor målet er nået.
- Denne markering findes ikke længere i listevisningen.

### 4.7 Scroll og fade

- Hvis ikke alle 7 dage er synlige, skal nederste synlige række have en diskret fade-effekt.
- Fade skal indikere, at der er mere indhold under.
- Fade/scroll-overgang skal være designet, så bundmenuen ikke visuelt kommer til at se
  unødigt høj ud.

### 4.8 Ugesnap og skift til næste uge

- Listen skal opføre sig som en ugevisning.
- Ved scroll skal den først naturligt kunne lande/snappes på den 7. dag.
- Hvis brugeren fortsætter/forcerer scrollen videre: hele den aktuelle uge skal glide
  væk, og næste uge skal komme ind.
- Ugeintervallet i toppen skal opdateres til den viste uge.

## 5. Kalender – landskab og dagsvisning

### 5.1 Landskab

Når telefonen vendes vandret:
- kalenderen skal automatisk skifte til en 7-dages kalender.
- Visningen skal minde om Outlooks ugevisning.
- De 7 dage står ved siden af hinanden.
- Der skal være tidsakse fra `00:00` til `24:00`.
- Kalorieindtag skal placeres på de tidspunkter på dagen, hvor de er registreret.

### 5.2 Klik på en dag

Ved klik på en dag: åbn dagsvisning.
- Dagsvisningen skal være lodret.
- Vis tidsakse fra `00:00` til `24:00`.
- Registreringer placeres på de relevante tidspunkter.

### 5.3 Swipe mellem dage

I dagsvisningen: swipe vandret for at gå mellem dage.
- det skal være muligt at gå tilbage til tidligere dage.
- fremad-navigation skal begrænses, så brugeren ikke swiper ind i tomme fremtidige dage.

## 6. Søvn og arbejdstider i kalenderen

### 6.1 Søvnmarkering

Brugeren angiver typiske senge- og stå-op-tider under personlige oplysninger.
I dags- og ugevisning:
- sovetid vises med lysegrå baggrund.
- vågne timer vises på hvid baggrund.

### 6.2 Manuel justering direkte i dagsvisning

På overgangen mellem søvn og vågen:
- brugeren skal kunne holde fingeren kort på grænsen og trække op/ned.
- det justerer sengetid eller stå-op-tid.
- aktivering skal ske relativt hurtigt, cirka efter 0,5 sekund.
- det skal være langt nok til ikke at blive udløst ved et almindeligt swipe.
- det skal ikke kræve samme lange holdetid som ved omarrangering af ikoner.

Efter ændring bør appen kunne spørge, om ændringen gælder kun denne dato eller
standardmønstret.

## 7. Personlige oplysninger

Personlige oplysninger åbnes via brugerens initialer i headeren.

### 7.1 Søvnmønster

Brugeren skal kunne angive normal sengetid og normal stå-op-tid.
Det skal kunne foldes ud, så tider kan angives individuelt for hver ugedag.
Dette er nødvendigt for brugere med skiftende arbejdstider, natarbejde, varierende
søvnrytme.

### 7.2 Skiftende arbejdstider

Tilføj en toggle øverst i det relevante afsnit:
- default: slået fra
- foreslået navn: `Skiftende arbejdstider`

Når slået til:
- brugeren kan registrere natarbejde/skiftehold
- brugeren kan registrere tilhørende søvntider
- disse data bruges i kalenderens søvnvisualisering

### 7.3 Registrering af arbejdstider i kalender

Tilføj mulighed for, at brugeren kan vælge at registrere arbejdsdage og arbejdstider
direkte i kalenderen.

## 8. Opsætningsguide

### 8.1 Generelt

- Første gang brugeren opretter sig, skal der være en fuldskærms opsætningsguide.
- Guiden skal have tydelig progression. Fx: `8 af 10 trin gennemført`.
- Denne progression skal også kunne ses senere på brugerniveau/profil.

Nederst i guiden: `Næste`, mulighed for `Påmind mig senere`, mulighed for `Vis ikke igen`.

### 8.2 Søvnspørgsmål

Guiden skal bl.a. spørge:
- `Har du et fast søvnmønster?` (Ja/Nej)
- Hvis nej: `Skyldes det varierende arbejdstider eller natarbejde?` (Ja/Nej)
- Hvis ja: aktivér funktionalitet for skiftende arbejdstider/natarbejde, og spørg om
  brugeren ønsker at registrere arbejdstider eller søvntider dagligt.

### 8.3 Smartwatch / sundhedsdata

Guiden skal spørge om brugeren ønsker at importere data fra smartwatch/sundhedsapp.
- vis en positiv handling `Opsæt nu`
- ellers fortsætter brugeren blot med `Næste`
- der skal ikke være tre ligeværdige valg
- funktionen skal kunne sættes op senere under personlige oplysninger

### 8.4 Arbejdstider i kalender

Guiden kan også spørge, om brugeren ønsker mulighed for at registrere arbejdstider
direkte i kalenderen.

## 9. Bundmenu

### 9.1 Ikonstørrelse og proportioner

- Genbesøg størrelsen på bundmenuens ikoner. De ser aktuelt for små ud.
- Match proportionerne fra HelloFresh så tæt som muligt.
- Brug referencebillederne fra HelloFresh-projektet, hvis de allerede findes.

### 9.2 Omarrangering

- Langt tryk på et ikon aktiverer redigeringstilstand.
- Interaktionen må gerne føles inspireret af iPhone.
- Aktive ikoner skal kunne trækkes og omarrangeres.

### 9.3 Ubrugte ikoner

Når redigeringstilstand er aktiv:
- åbnes et panel over bundmenuen, som viser ubrugte funktioner/ikoner.
- brugeren kan trække et ikon ned i bundmenuen.
- aktive ikoner kan fjernes med et lille `×`.
- fjernede ikoner flyttes tilbage til listen over ubrugte funktioner.

### 9.4 Visuel inspiration

- Panelet kan hente inspiration fra iOS Quick Access/Control Center.
- Den endelige form på ikonbaggrund skal vurderes ud fra HelloFresh: rund, afrundet
  firkant, eller uden baggrund.
- Vælg den løsning, der bedst matcher det gennemgående HelloFresh-design. Der skal
  ikke blot kopieres en rund form ukritisk.

## 10. Flydende plus-knap / FAB

### 10.1 Funktion

På startsiden findes en flydende plus-knap til at tilføje kalorie-/måltidsregistrering.
Ved langt tryk:
- knappen kan flyttes. Vis ghost/preview under flytning.
- vis tydeligt omrids af mulige snap-positioner.
- knappen kan snappe til venstre eller højre side, og justeres op/ned.
- placeringen gemmes.

### 10.2 Relation til status-hjul

- Status-/kaloriehjulet skal altid være på modsatte side af plus-knappen.
- Flyttes plus-knappen over på modsatte side, skifter status-hjulet automatisk side.
- De to elementer bytter altså plads. Brug gerne en glidende animation.

### 10.3 Visuelt design – HelloFresh-reference

Tidligere instruktioner om at redesigne selve plus-knappen tilsidesættes af denne
reference. Brug HelloFresh-referencebilledet `Kogebog` som visuel reference.

FAB:
- mørk næsten sort baggrund, estimeret omkring `#222222` / `#232323`
- hvidt `+`, centreret præcist, enkelt, relativt tyndt plus
- ingen cirkel omkring plus, ingen outline, ingen gradient, ingen tydelig drop-shadow
- afrundet firkant, cirka 1:1 format
- tydelig, men ikke ekstrem hjørneradius, cirka 20–25 % af knappens bredde
- god luft omkring plusset

Det er kun FAB'ens visuelle design, der kopieres fra HelloFresh. Flytte-/snapfunktionaliteten
i Hello Cal skal bevares.

### 10.4 Inline `+ Ny`

HelloFresh-referencebilledet viser også `+ Ny`. Dette er en separat komponent:
- almindeligt sort `+`, ingen baggrund
- teksten `Ny` ved siden af
- må ikke blandes sammen med FAB-komponenten

## 11. Statistikside

### 11.1 Hovedgraf

Øverst ligger en bred graf på tværs af skærmen. Aktuelt: kalorier, gennemsnit, seneste 7 dage.
Udvid grafen, så flere dataserier kan vises samtidig, fx: kalorier (grøn), vægt (grå
eller lysegrøn), mulighed for yderligere dataserier senere.

### 11.2 Signatur/legend

Nederst til venstre i grafen: lille legend med cirkler/prikker, fx grøn prik = kcal,
grå prik = vægt.
Der skal være en lille pil ned ved legend/ikon — samme princip som øvrige steder i
appen: pilen placeres under ikonet, hvor det giver mening.

### 11.3 Valg af dataserier

Ved tryk åbnes et mindre panel/dropdown (ikke fuldskærm, stort nok til let touch-betjening):
- afkrydsningsfelter for de dataserier, der skal vises, fx vægt, kalorier osv.
- valget skal huskes næste gang.

### 11.4 Statistik-kort

Under grafen findes små statistik-kort i to kolonner, fx kalorier, skridt, protein,
kulhydrat.

Redigering:
- Ved langt tryk går kortet i redigeringstilstand.
- Kortene må gerne vibrere let som ved iPhone-redigering.
- Brugeren kan flytte dem.

Panel med ubrugte kort:
- Åbn et gråt panel over eller under, alt efter hvor der er mest plads.
- ca. 90 % opacitet, baggrunden må gerne kunne anes let.
- panel med ubrugte statistik-kort; begge områder/lister skal kunne scrolles.
- kort kan trækkes ind/ud mellem aktive og ubrugte.

Ekstra elementer i panelet:
- Nederst i ubrugte-elementer: statisk skillelinje, et element/bar `Overskrift`.
- brugeren kan trække en overskrift ind på statistik-siden og udfylde/omdøbe den.
- Formålet: brugeren kan selv sammensætte sin statistikside modulært.

## 12. Statistik-kort – visuel reference fra HelloFresh

Brug kategorifelterne i HelloFresh-referencebilledet `Opdag` som visuel reference:
`Skandinavisk`, `Europæisk`, `Middelhavsretter`, `Asiatisk`.

De afrundede firkanter med billeder skal være designreference for statistik-kortenes
ikonbokse.

Udseende:
- næsten kvadratisk format, tydeligt afrundede hjørner
- flad, rolig baggrund, ingen kraftig skygge
- lys varm beige/grå, estimeret reference: ca. `#EEEAE0`
- ikon centreret, god luft omkring ikon
- samme størrelse/radius/rytme på tværs af kort

Statistik-kort bruger ikoner/grafik i stedet for madbilleder.

Tekst under/ved kortet: meget mørk, semibold/fed, kompakt linjehøjde, samme visuelle
vægt som kategorinavnene i HelloFresh.

Brugerdefinerede sektionsoverskrifter skal følge samme typografiske designprincip,
men i passende større størrelse.

Farveprincip: undgå en ny særskilt tilfældig beige nuance — genbrug en eksisterende
neutral farve i Hello Cal-paletten, hvis den matcher, ellers bruges ca. `#EEEAE0`
som reference.

## 13. Madvareside / opskriftsside

Brug HelloFresh-opskriftsskærmbilledet som designreference.

### 13.1 Overordnet struktur

1. stort hero-billede øverst
2. hovedoverskrift
3. underoverskrift
4. metadata-række
5. nøgleord/kategorier
6. handlingsknapper
7. beskrivelses-/informationssektioner
8. primær CTA nederst

### 13.2 Hovedoverskrift

Stor, fed, mørk, tydelig primær titel. Eksempel: `Asiatisk inspireret kyllingebowl`.

### 13.3 Underoverskrift

Direkte under hovedoverskriften, mindre og lettere, mørk tekst. Eksempel:
`med ingefærris & sesammayo`.

### 13.4 Metadata-række

Små informationsblokke, fx `I alt` → `20 min`, `Protein` → `36.39g`,
`Sværhedsgrad` → `Middel`. Hver blok: lille label, ikon, værdi.

### 13.5 Nøgleord og kategorier

Reference: tagget `Hurtig`. Tags: lille afrundet rektangulær boks/pill, lys varm
beige, mørk tekst, flad styling, ingen kraftig skygge, kompakt padding.
Eksempler: Hurtig, Vegetar, Proteinrig, Morgenmad, Aftensmad.
Estimeret tag-baggrund: ca. `#EAE3D7`.

### 13.6 Handlingsknapper

Sekundære knapper følger HelloFresh: lys/hvid baggrund, tynd mørk border, afrundede
hjørner, ikon + tekst. Eksempel: `Gem`, kurv-ikon som separat kvadratisk/kompakt knap.

### 13.7 Sektionsoverskrifter

Eksempler: `Beskrivelse`, `Allergener`. Stil: mørk, fed, større end brødtekst,
venstrestillet, god luft over.

### 13.8 Brødtekst

Almindelig mørk tekst, høj læsbarhed. `Læs mere` kan bruges ved længere tekst.

### 13.9 CTA

Stor mørk bundknap: næsten sort, hvid tekst, stor bredde, afrundet.
Eksempel: `Lad os lave mad`.

## 14. Produktdetaljer, varedeklaration og accordion

Brug de vedlagte HelloFresh-skærmbilleder som visuel reference.

### 14.1 Foldbare sektioner

Produktinformation kan opdeles i accordion-sektioner, fx: Næringsværdier,
Ingredienser / varedeklaration, Allergener, øvrige produktoplysninger.

HelloFresh-stil:
- ingen separat farvet boks omkring hele sektionen
- direkte på sidens lyse baggrund
- overskrift venstrestillet, fed mørk tekst
- chevron helt til højre
- god lodret luft
- ingen unødige borders/skygger

### 14.2 Chevron – standard

Denne pil skal være standard for fold-ud/fold-ind i Hello Cal.

Lukket:
- chevron peger ned, mørk/sort, enkel streg
- ingen cirkel, ingen baggrund
- relativt kraftig stroke, kompakt ikon

Åben:
- samme ikon roteret 180°, peger op
- samme størrelse og stroke

Undgå: fyldte trekanter, cirkler omkring pil, meget tynde system-chevroner, separat
knapbaggrund.

> Denne chevron er den generelle standard for fold-ud/fold-ind i hele appen — brug
> den samme, konsistente pil andre steder i appen, ikke forskellige pile fra side
> til side. Bemærk: den eksisterende `ChevronRow` i
> [src/components/hf/AccordionCard.tsx](../src/components/hf/AccordionCard.tsx)
> bruger `›` og en tan/beige menu-boks-stil (til Profil/Indstillinger) — det er en
> anden komponent end denne accordion-chevron og skal ikke forveksles med den.

### 14.3 Indhold ved udfoldning

- vises direkte under overskriften
- samme typografiske system som resten af madvaresiden
- klare labels og værdier
- ingen unødige farver
- tabelform eller label/værdi-rækker efter behov

## 15. Generelle designregler

### 15.1 HelloFresh som visuel reference

Hvor dette dokument specifikt henviser til HelloFresh:
- brug projektets eksisterende HelloFresh-referencebilleder, hvis de findes.
- opfind ikke nye visuelle løsninger, hvis referencebilledet tydeligt viser komponenten.
- match proportioner, spacing, hjørneradius, typografisk vægt og visuel ro.

### 15.2 Konsistens

Genbrug: samme grå palette, samme chevrons, samme knapprincipper, samme radiusfamilie,
samme typografiske hierarki.

Undgå: tilfældige nye grånuancer, forskellige chevron-stile, unødigt mange røde
elementer, forskellige kortdesigns for samme type indhold.

## 16. Foreslået opdeling til Codex/agenter

For at mindske risikoen for oversete punkter bør arbejdet opdeles i selvstændige opgaver:

- CAL-01: Månedsvisning og statusmarkeringer
- CAL-02: Månedsstatus, 7-dages status og streak
- CAL-03: Listevisning / ugevisning
- CAL-04: Landskabsvisning og dagsvisning
- CAL-05: Søvnvisualisering og direkte justering
- USR-01: Personlige oplysninger og søvnmønster
- USR-02: Skiftende arbejdstider / natarbejde
- SET-01: Opsætningsguide
- NAV-01: Bundmenu og redigering af ikoner
- FAB-01: Flydende plus-knap og snap-logik
- STA-01: Hovedgraf og valg af dataserier
- STA-02: Modulære statistik-kort
- DES-01: Statistik-kortenes HelloFresh-design
- FOOD-01: Madvareside / opskriftsside
- FOOD-02: Tags, kategorier og metadata
- FOOD-03: Varedeklaration / accordions / chevrons
- DES-02: Fælles farvepalette og komponentkonsistens

Hver agent skal markere hvert punkt som implementeret eller ikke implementeret i
[STATUS.md](STATUS.md), så intet springes over.

## Status

SET-01 (Opsætningsguide) er implementeret 2026-08-27 — se `docs/STATUS.md`.
De øvrige punkter i dette dokument er endnu ikke implementeret (modtaget
2026-08-27). Referencebilleder fra HelloFresh, som der henvises til flere
steder, er endnu ikke lagt ind i repoet — de skal findes/tilføjes, før de
punkter der kræver dem, kan implementeres præcist.
