# Projektopdeling — afklaring

Dato: 2026-09-14. Samtalenoter, ikke en implementeringsstatus.

## Formål og næste skridt

Brugeren ønsker mindre, fokuserede arbejdsprojekter med henvisninger til de
rette mapper, data og designregler. Afklaringen kom for langt ned i nye
funktioner; brugeren har stoppet dette spor. Næste skridt er at kortlægge
eksisterende kode og afhængigheder og aftale projekt- og mappegrænser, før
yderligere funktionsafklaring eller implementering.

Områder drøftet: Hello Cal, admin, medarbejdernes produktoprettelsesapp samt
integrationer (ifølge brugeren endnu ikke udviklet). Analyse, points,
onboarding og indstillinger skal også kunne håndteres fokuseret.

Forslag, ikke endeligt vedtaget: afgrænsede områder i samme repository,
kort fælles indgang, områdespecifik dokumentation og arkiveret historik.
Fælles datakontrakter og designkomponenter skal have tydeligt ejerskab.
Separate repositories, apps, databaser, fysiske mapper og drift er endnu
ikke besluttet. Ingen kode eller mapper er flyttet som del af denne afklaring.

## Bekræftede behov til senere brug

### Medarbejderadgang og produktoprettelse

- Ansatte/oprettelsesbrugere oprettes manuelt i admin og får unik adgang
  til medarbejderappen via e-mail og adgangskode.
- Appen forventes at bruge tung behandling via OpenAI API.
- Et menupunkt fotograferer en hel varehylde. Overlay viser oprettede
  produkter og usikre produkter. Tryk på et produkt åbner normal oprettelse;
  det oprindelige hyldebillede opdateres automatisk efter oprettelsen.
- Oprettelsen har fire bokse: stregkode, ingredienser, energi og
  produktbilleder (op til fire produktbilleder), samt SEND.
- Indsendelser skal kunne gemmes lokalt og sendes/behandles i baggrunden,
  så medarbejderen straks kan fortsætte.
- Produkter bliver direkte tilgængelige i Hello Cal uden forudgående
  admin-godkendelse. Manglende/usikre data blokerer ikke tilgængelighed.

### Datakvalitet og rettelse

- Manglende/usikre data giver udråbstegn i hyldeoverlay og på adminlisten
  under nye produktoprettelser.
- Advarsel om et mangelfuldt produkt må først dukke op efter afsluttet
  aktuel produktoprettelse; forløbet må ikke afbrydes.
- Rettelse bruger samme oprettelsesskærm, med producent, vægt, varenavn og
  eventuelt forsidebillede øverst til identifikation.
- For både almindelige brugere og ansatte får korrekt udfyldte bokse et
  overlay med 60 % opacitet og flueben (stregkode, energifordeling,
  indhold og produktbilleder).
- Produktrettelse har kommentarfelt og knappen »Accepter fejl og indberet«.
  Admin får fejlbeskeden; arbejdet accepteres i mellemregningen til
  aflønning, mens produktet fortsat er mangelfuldt.

### Ansatte og aflønning

- Fanen »Ansatte« viser ansatte/oprettelsesbrugere og deres scanninger/
  oprettelser fordelt pr. måned samt en total.
- Oversigten skal vise antal oprettede produkter og penge til udbetaling.
- Betaling er et fast beløb pr. produkt. Kun fødevareprodukter kan
  godkendes til aflønning; andre varer afvises.
- Admin kan afvise med årsag i et skærmoverlay med forudbestemte
  årsagsknapper og et valgfrit kommentarfelt.
- Produktets datakvalitet og arbejdets accept til aflønning skal holdes
  adskilt, så accepterede fejl ikke skjuler mangelfulde produktdata.

## Ikke afklaret — må ikke antages

- Håndtering af en stregkode, der allerede findes, og betaling for
  supplering/rettelse af eksisterende produkter.
- Satsens størrelse og om den varierer mellem ansatte.
- Automatisk kontra manuel vurdering af, om varen er en fødevare.
- Konkrete faste afvisningsårsager. Eksempler foreslået af assistenten
  blev ikke valgt af brugeren.
- Tekniske kriterier for »korrekt udfyldt«, datamodel, API-grænser,
  synkronisering og udbetalingsregistrering.

Disse spørgsmål parkeres, mens projektopdelingen afklares.
