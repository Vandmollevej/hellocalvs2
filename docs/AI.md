# AI, billedgenkendelse, OCR og scanning — HELLO CAL

Se [SPECIFICATION.md](SPECIFICATION.md) for det samlede overblik.

## Grundprincipper

- AI må **aldrig** gætte — den skal altid spørge brugeren eller markere, at information mangler.
- Brugeren skal som udgangspunkt kun godkende, ikke indtaste. AI foreslår, brugeren retter med få tryk eller stemme.
- AI bruges kun når nødvendigt. Resultater caches, og dyre AI-kald undgås, når data allerede findes i HELLO CALs egen database.
- Brugeren skal aldrig vælge mellem hurtig/grundig analyse eller se tekniske indstillinger — appen vælger altid selv strategien ("brugeren tager stilling til resultatet, aldrig til teknologien").
- AI ændrer aldrig en allerede gemt registrering automatisk — kun nye registreringer påvirkes af senere modelforbedringer.
- Brugerens rettelser kan kun bruges til AI-forbedring med et separat, eksplicit opt-in (spørges ikke ved hver rettelse) — vist som en dialog første gang brugeren retter en analyse. Fejlrapporter/træningsdata sendt til admin sløres automatisk for ansigter/personoplysninger.

## Naturligt sprog

- Dansk taleinput til madlogning, fx "to skiver rugbrød med lidt smør og et tykt lag roastbeef" — AI omsætter til mængder, som brugeren kan rette.
- AI lærer brugerens typiske portionsstørrelser over tid (fx "lidt smør" = 8 g).
- Naturligt sprog bruges bredt i appen — også til mål, vægtnoter, dagbog og egne noter, ikke kun madlogning.

## Intelligent kameravisning

- Én fælles kameravisning — brugeren vælger ikke selv scanningstype. AI afgør selv, om motivet er en tallerken, en stregkode, en flaske/dåse, et menukort eller et glas.
- AI foreslår automatisk en beskæring (autocrop) om det mest sandsynlige objekt; ved flere objekter (fx tallerken + glas) analyseres kun det valgte objekt, brugeren kan flytte beskæringen.
- Live-overlay guider brugeren under scanning (fx "Ret billedet op", "Hold stille", "For mørkt") og forsvinder, når billedet er korrekt — som ved scanning af et betalingskort. Billedet tages automatisk, når kvaliteten er god nok; en manuel udløser findes som backup.
- For måltider vises en fast, hvid rund tallerken-kontur set ovenfra ved kameraets åbning; den fader delvist ud, når kameraet er aktivt, og bliver tydeligere, hvis tallerkenen er forkert placeret. Ingen dynamisk tilpasning til oval/firkantet tallerken.
- Ingen grøn/gul/rød kvalitetsindikator eller procentmåler i kameravisningen — kun korte tekstbeskeder.
- En lokal, billig kvalitetsscreening (under 1 sekund) kører først og afviser ubrugelige billeder (skråt, flere tallerkener, uskarpt, dækket mad) før dyre AI-tokens bruges. Ved dårligt billede vises "Billedet er uklart og kan tage længere tid" med "Tag nyt billede" (anbefalet) / "Fortsæt alligevel".
- Maksimal analysetid (ca. 5-10 sekunder). Ved overskridelse afbrydes analysen, samme billede vises igen med problematiske områder markeret, og der foreslås et nyt billede.

## Måltidsanalyse

- Kun én tallerken pr. billede er tilladt — appen giver en fejl ved flere tallerkener/måltider. Buffet/tapas er droppet helt fra v1.
- Standard er ét billede taget lige oppefra af måltidet. AI kan bede om et nærbillede, hvis den er usikker på et specifikt område.
- AI opdeler måltidet i ingredienser med estimeret gram pr. ingrediens, men viser det samlet som én ret for brugeren — ingredienserne er tilgængelige ved åbning/redigering.
- Visuel analyseproces: en hvid kontur tegnes rundt om ingredienserne (Pinterest-stil), og ingredienslisten bygges live med en sløret placeholder for resten.
- Usikre ingredienser markeres med farve og viser 1-3 forslag nedenunder. Brugeren kan vælge et forslag, søge, eller redigere manuelt. AI kan også markere et usikkert område direkte på billedet med et overlay og spørgsmålet "Hvad er dette?", med søgeforslag mens brugeren skriver.
- Manuel rettelse af en AI-markering ("Ret markering") understøttes med tegneværktøj, viskelæder og zoom.
- Mængdejustering sker via en slider og et inputfelt side om side, synkroniseret.
- Automatisk beskæring/baggrundsfjernelse af tallerkenen sker via en segmenteringsmaske (ikke vektorbaseret). Bestik, servietter og tallerkenkant fjernes automatisk fra analyseområdet.
- Saucer, dressing og olie registreres som separate ingredienser. Skjulte fedtstoffer (stegeolie, smør) estimeres og vises i en særskilt sektion nederst, markeret som AI-estimat — kan justeres eller fjernes.
- AI skal automatisk forsøge at afgøre, om en ingrediens er tilberedt eller rå, og vælge næringsdata derefter.
- Der er altid en to-trins proces: AI-analyse, derefter brugergodkendelse. Måltidet oprettes først ved "Gem" — annullering kasserer alt. Hvert måltid startes altid manuelt; appen opretter aldrig selv et nyt måltid automatisk.

## Genkendelse af tidligere retter

- Ingen separat restaurantprofil — gemte retter fra historikken genbruges i stedet.
- Genkendelse af en tidligere ret vises som et simpelt overlay med billede, titel og en kort ingrediensliste, med Ja/Nej — kun det mest sandsynlige match vises, ikke flere alternativer.
- Matchkrav: ca. 90 % af ingredienserne skal matche, ingen manglende hovedingrediens, og portionsstørrelsen skal være rimelig.
- Ved en større rettelse af analysen vises et diskret "Gem som ny ret?"-forslag nederst (i stil med iPhone Fotos-appens forslag), ikke en forstyrrende popup.
- Personlig mængdelæring: hvis brugeren ændrer samme ingrediens til samme mængde i mindst 50 % af tilfældene (min. 5 registreringer), foreslås den nye mængde fremover, markeret med en "Foreslået"-chip. Læring sker kun pr. ingrediens, ikke for kombinationer eller hele retter.

## Rester (før/efter)

- Skærmen deles i FØR (aktiv) og EFTER (grå illustration) ved registrering af rester. Efter at et måltid er gemt, vises et kort "Har du rester?".
- Slutresultatet viser en redigerbar procent spist samt en gem-knap.
- Er der ikke taget et EFTER-billede efter 30-60 minutter, sendes én enkelt push-påmindelse pr. måltid.

## Ny vare via stregkode

- Ved ukendt stregkode tager brugeren tre billeder: forside, stregkode og næringsdeklaration (guidet firetrins-flow, se [UI.md](UI.md)).
- AI udtrækker navn, brand, nettoindhold, portioner, kalorier og makroer via OCR. Brugeren skal aktivt godkende, før produktet gemmes som kandidat til den fælles database (admin-godkendelse følger, se [ADMIN.md](ADMIN.md)).

## Drikkevarer

- Drikkevarer skal altid fotograferes separat fra mad — appen viser en fejlbesked, hvis en drik ses sammen med mad på samme billede.
- Vand registreres via det normale flow; AI vurderer glasstørrelse og fyldningsgrad (ikke kun kapacitet) for at beregne mængden.
- AI genkender mærkevarer visuelt på flasker (farve, form, logo) og bruger OCR som ekstra bekræftelse; på dåser er OCR den primære kilde.
- AI foreslår ikke automatisk en light/sukkerfri-variant generelt, men kan genkende rødvin/hvidvin i et glas og foreslå det. Ved tvivl (fx en mørk sodavand) vises et valg mellem sandsynlige muligheder (fx Cola / Cola Zero / Pepsi).

## Restaurantretter og menukort

- Restaurantretter uden officielle data estimeres af AI ud fra menutekst/billede og mærkes tydeligt "AI-estimat – ikke officielle ernæringsdata". Brugeren skal godkende og kan tilføje/fjerne/ændre ingredienser.
- Scan af menukort: OCR læser menukortet, men brugeren vælger/fotograferer kun den bestilte ret (ikke hele kortet som en liste). Menukort-billedet og OCR-dataene bruges kun som midlertidig kontekst og slettes automatisk, så snart måltidet er gemt — intet gemmes permanent.
- Tavlemenu/kridttavle behandles på samme måde som et trykt menukort.
- AI gætter automatisk på tilvalg/fravalg (fx ekstra ost, ingen løg) ved at kombinere menutekst og billede; brugeren spørges kun, hvis AI er usikker.
- Beskæring af menukort-billedet foreslås automatisk (justerbar ramme, Pinterest-stil); AI opdeler menukortet i blokke/retter og vælger automatisk den mest fokuserede ret. Brugeren kan justere eller slette og tage et nyt billede.
- QR-kode-menuer og digital menuintegration er udskudt til en senere version.

## Klassificering af måltidstype

- AI foreslår automatisk måltidstype (morgenmad/frokost/aftensmad/snack) baseret på brugerens hverdags- vs. weekend-tidsprofil, tidspunkt, fødevaretype og historik.
- Hvert produkt har vægtede måltidskategori-sandsynligheder ud fra anonymiserede brugsdata (fx havregryn = 96 % morgenmad), kombineret med brugerens egne rettelser over tid.
- Brugeren kan oprette egne faste måltidstyper samt engangsbetegnelser. Ordet "snack" undgås som fast kategori.

## Produkt- og ingrediensbilleder

- En agent søger automatisk efter eller genererer et transparent PNG-billede til produkter; usikre eller dårlige billeder sendes til admin-kontrol.
- Kun generiske råvarer (tomat, løg, ris, kyllingebryst) får AI-genererede billeder — ikke emballerede produkter, færdigretter eller brugerens egne retter. Alle godkendte råvarebilleder følger en fast stilguide: transparent baggrund, samme kameravinkel/lys/stil/skalering, ingen skygger, ét motiv pr. billede.
- Brugeroprettede ingrediensbilleder får status "Afventer godkendelse", indtil admin har godkendt dem.
- AI kobler aldrig automatisk et billede til en eksisterende opskrift — brugeren opretter selv opskriften.
