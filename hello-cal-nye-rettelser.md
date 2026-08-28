# Hello Cal – nye rettelser og implementeringskrav

Dette dokument indeholder **kun de nye rettelser og ændringer** fra den seneste gennemgang. Tidligere løsninger, som modsiger disse punkter, skal tilsidesættes.

---

# 1. Plus-knap / FAB

## 1.1 Visuelt design
- Der skal **ikke** være nogen synlig boks, ramme eller baggrund omkring plusset.
- Boksen, der tidligere blev vist, var kun en midlertidig størrelsesreference.
- Plusset skal stå frit og beholde den størrelse, som blev godkendt i referencevisningen.
- Flytte- og snapfunktionaliteten skal fortsat virke på plus-knappens interaktionsområde.

## 1.2 Flytning
- Ved langt tryk skal plus-knappen kunne flyttes.
- Der skal vises ghost/preview under flytning.
- Snap-positioner skal vises tydeligt med et diskret omrids.
- Plus-knappen skal kunne flyttes mellem venstre og højre side samt op og ned.
- Placeringen skal gemmes.

## 1.3 Tekst må ikke markeres under drag
Når plus-knappen flyttes:
- brugerinitialerne øverst må ikke blive tekstmarkeret.
- tekst/tal på drejehjulet må ikke blive tekstmarkeret.
- øvrig tekst i UI'et må ikke blive markeret.
- Brug `user-select: none` eller tilsvarende i drag-tilstand.

---

# 2. Drejehjul

## 2.1 Grøn cirkel skal bevares
- Den grønne cirkel omkring drejehjulet må **ikke** fjernes.
- Den grønne cirkel er en fast del af drejehjulets visuelle design.
- Kun tekstens placering, størrelse, geometri og animation skal ændres.

## 2.2 Hjulet skal ligne et reelt drejehjul
- Værdierne skal være tydeligt forskudt i en kurve.
- Hjulet skal visuelt have dybde og rotation.
- Værdier længere fra centerpositionen skal ligge mere forskudt.
- Teksten må gerne være venstrestillet, men **hele hjulets geometri må ikke flyttes mod venstre** af den grund.

## 2.3 Forstørrelseseffekt
- Den aktive/centrale værdi er referencepunktet.
- Jo tættere en værdi kommer på aktiv position, desto større skal teksten blive.
- Jo længere væk værdien er, desto mindre skal teksten blive.
- Effekten skal føles som en let magnifier/fisheye-effekt.

## 2.4 Animation
- Når brugeren swiper/drejer, skal værdierne fysisk animere op/ned.
- Det må ikke bare være et pludseligt skift af tal.
- Bevægelsen skal følge fingeren kontinuerligt.
- Når brugeren slipper, skal hjulet snap'e naturligt til næste værdi.

## 2.5 Anretningsanalyse-ikon
På drejehjulet skal ikonet for anretningsanalyse være:
- en tallerken
- med kniv og gaffel ved siden af
- ikke blot løst bestik

---

# 3. Madliste

## 3.1 Billeder
- Billeder i madlisten ligger i bokse.
- Billederne skal derfor **centreres inde i boksen**.
- De skal ikke venstrestilles.

## 3.2 Tid
- Feltet/teksten `Oprettet` skal fjernes helt.
- `Kl.` skal beholdes som tidsangivelse.

## 3.3 Kalorier
Primær visning:
- kalorier skal altid vises **pr. 100 g**.

Eksempel:
- `245 kcal / 100 g`

Sekundær visning:
- hvis varen naturligt indtages som en enhed, må der under primærværdien stå fx:
  - `Pr. stk.: 246 kcal`

`Pr. stk.` er supplement og må aldrig erstatte værdien pr. 100 g.

## 3.4 Chevron til detaljer
- Hver madvare i listen skal have en lille chevron/pil helt ude i højre side.
- Pilen skal tydeligt vise, at rækken kan åbnes.
- Hele rækken skal være klikbar, ikke kun pilen.
- Brug samme enkle chevron-stil som resten af Hello Cal/HelloFresh.
- Ingen cirkel eller særskilt baggrund omkring pilen.

---

# 4. Bundmenu

- Bundmenuen skal være **100 % statisk/fixed**.
- Den må aldrig swipe eller scrolle med sideindholdet.
- Kun indholdet over bundmenuen må bevæge sig.
- Bundmenuen skal altid blive stående på samme position nederst på skærmen.

---

# 5. Statistik – redigering af kort

## 5.1 Ny redigeringsmodel
Den tidligere løsning med flyvende paneler, skillelinjer og prik-håndtag skal droppes.

Brug i stedet:
- **iPhone-lignende UX**
- **HelloFresh/Hello Cal-design**

iPhone bruges som reference for interaktion. HelloFresh bruges som reference for farver, kortform, typografi, spacing og visuel stil.

## 5.2 Ingen prik-håndtag
- Fjern drag-prikker/håndtag ude i siden.
- De må ikke bruges i mobilappen.
- Brug direkte drag på selve kortet.

## 5.3 Flytning af aktive kort
Ved langt tryk:
- kortet går i redigeringstilstand.
- kortet skal kunne trækkes direkte.
- det kort, der flyttes, skal følge fingeren hele tiden.
- øvrige kort skal animere og flytte sig naturligt for at gøre plads.
- ingen pludselige spring uden animation.

## 5.4 Tekstmarkering
I redigeringstilstand:
- tekst må ikke kunne markeres ved et uheld.
- brug `user-select: none` eller tilsvarende.

## 5.5 Fjernelse af kort
- Aktive kort skal have et lille `×` eller minus-ikon i redigeringstilstand.
- Ved fjernelse flyttes kortet til samlingen af uudnyttede kort.
- Kortet må ikke slettes permanent.

## 5.6 Ingen “Færdig”-knap
- Der skal **ikke** være nogen `Færdig`-knap.
- Redigeringstilstand afsluttes ved at trykke uden for de redigerbare kort.
- Redigeringstilstand afsluttes også naturligt ved navigation væk fra siden.
- Ændringer gemmes løbende med det samme.

## 5.7 Tryk udenfor skal virke
- Et tap på et tomt område uden for de redigerbare kort skal straks afslutte redigeringstilstanden.
- Dette skal fungere konsekvent.

---

# 6. Separat side med uudnyttede statistik-kort

Tilføj en separat side/visning til uudnyttede statistik-kort.

## 6.1 Formål
- Ingen flyvende overlay-løsning.
- Ingen blanding af aktive og inaktive kort i samme rodede editor.
- Brugeren åbner en separat visning med alle uudnyttede kort.

## 6.2 Gruppeopdeling
Ubrugte kort skal grupperes tydeligt.

### Energi og makrofordeling
- Kalorier
- Protein
- Kulhydrat
- Fedt

### Kulhydrattyper og fibre
- Stivelse
- Fibre
- Sukkerarter
- øvrige relevante kulhydratdata

### Vitaminer
- Vitamin A
- B-vitaminer
- Vitamin C
- Vitamin D
- Vitamin E
- Vitamin K

### Mineraler
- Calcium
- Jern
- Magnesium
- Kalium
- Zink

### Aktivitet og øvrige data
- Skridt
- Vand
- Vægt
- øvrige relevante målinger

## 6.3 Visuel stil
- Følg HelloFresh/Hello Cal-design.
- Ikke mørk iOS-look.
- Ikke glas-look.
- Ikke iOS-farver.
- Kun selve interaktionsprincippet må hente inspiration fra iPhone.

---

# 7. Statistik – dropdown ved graf

- Pilen til dropdown skal stå **direkte ved siden af teksten `Kalorier`**.
- Den må ikke ligge ude i hjørnet eller et sted, hvor relationen er uklar.
- Det skal straks være tydeligt, at `Kalorier` er et dropdown-valg.
- Klik på både teksten og pilen skal åbne dropdown.
- Samme princip bruges ved tilsvarende dropdown-labels.

---

# 8. Statistik – smartere graf med mål som midterlinje

Grafen skal ændres fra rå værdier til **afvigelse fra brugerens mål**.

## 8.1 Midterlinje
- Midten af grafen = brugerens mål.
- Midterlinjen markeres tydeligt som `Mål` / `0`.

## 8.2 Kalorier
Eksempel:
- mål: 1550 kcal
- indtag: 1200 kcal
- grafværdi: `-350 kcal`

Farver:
- under kaloriemål = grøn
- over kaloriemål = sort/mørk

Eksempel:
- 1550 mål
- 1800 indtag
- `+250 kcal` over midterlinjen i sort/mørk

## 8.3 Vægt
Grafen viser afvigelse fra målvægt.

Eksempel:
- målvægt: 110 kg
- faktisk vægt: 120 kg
- grafværdi: `+10 kg`

Farver:
- vægt under målet = lysegrøn
- vægt over målet = grå

Grafen skal altså kommunikere: **Hvor langt er brugeren fra sit mål?** – ikke blot den rå værdi.

---

# 9. Stregkodescanning

Stregkodescanning virker aktuelt ikke og skal rettes.

Krav:
- kameraet skal kunne aflæse stregkoden stabilt.
- efter scanning skal produktdata forsøges hentet automatisk.
- hvis produktet findes, vises data.
- hvis produktet ikke findes, vises tydelig fallback til manuel oprettelse.
- funktionen må ikke fejle tavst.

---

# 10. Foto/scanning af næringsdeklaration

Funktionen til at tage billede af næringsindhold virker aktuelt ikke og skal rettes.

Krav:
- brugeren skal kunne tage et billede af næringsdeklarationen.
- appen skal forsøge at aflæse værdierne automatisk.
- aflæste værdier skal vises til kontrol før lagring.
- brugeren skal kunne rette hvert felt manuelt.
- tydelig fejltilstand ved manglende aflæsning.
- ingen tavs fejl.

---

# 11. Overordnede UX-regler for disse rettelser

- Mobilinteraktion skal føles som en rigtig mobilapp.
- Ingen desktop-prægede drag-håndtag/prikker.
- Ingen browseragtig tekstmarkering under drag.
- Ingen elementer, der “flyver rundt” uden animation.
- Direkte manipulation skal følge fingeren.
- Redigeringstilstand skal kunne afsluttes intuitivt med tap udenfor.
- HelloFresh/Hello Cal bestemmer visuelt design.
- iPhone bruges kun som reference for velkendt mobil-UX, hvor det er nævnt.

---

# 12. Opsætningsguide – progressionslinje i toppen

Reference: HelloFresh-skærmbillede med trin-indikator øverst (prikker + linje mellem "Om dig", "Betaling", "Vælg Måltider").

- Under opsætningsguiden skal en tilsvarende progressionslinje vises **i toppen** af skærmen.
- Linjen viser hvilket trin brugeren er på (prik/linje fyldt for gennemførte/aktive trin, grå for kommende).
- Aktivt trins label fremhæves (fx grøn tekst).
- Indsættes ved næste build af opsætningsguiden.
