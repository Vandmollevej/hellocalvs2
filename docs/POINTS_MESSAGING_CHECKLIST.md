# Tjekliste: Pointsystem, betaling, besked-automatisering og admin-brugere

Samlet krav-liste fra samtalen 2026-09-02/03, til brug ved slutgennemgang.
Afkryds efterhånden som hvert punkt er bygget OG verificeret i browseren
(ikke kun kodet) — se `AGENTS.md`/`design.md` §12 for verifikationskrav.

## Points — optjening

- [ ] 10 points ved godkendt bruger-oprettet produkt (titel, producent,
      næringsindhold, billede)
- [ ] +5 points ekstra hvis varedeklaration/indholdsfortegnelse er udfyldt
- [ ] +5 points ekstra hvis der er billeder af produktet fra flere vinkler
- [ ] Points tildeles ved admin-godkendelse, ikke ved indsendelse
- [ ] 10 points ved godkendt fejlindberetning ("Indberet fejl")
- [ ] 5 points pr. gennemført "videresend til en ven" (modtager har rent
      faktisk tilføjet produktet/retten til sin egen dag)
- [ ] Loft: maks. 50 videresend-points pr. kalendermåned pr. bruger
- [ ] 300 points ved gennemført "invitér en ven" — til BÅDE afsender og ny
      bruger, ikke direkte en gratis måned
- [ ] Points-saldo og historik vises under Profil → Points

## Misbrugsspærring (videresend til en ven)

- [ ] To brugere der sender frem og tilbage til hinanden mere end én gang
      (en tur-retur) inden for 24 timer bliver automatisk flagget
- [ ] Flag blokerer nye forward-points for begge, indtil admin rydder det
- [ ] Flag er synligt/håndterbart i admin "Advarsler"

## Points — indløsning

- [ ] 300 points kan indløses til 1 gratis abonnementsmåned
- [ ] Indløsning kræver en gemt betalingsmetode, så abonnementet fortsætter
      automatisk til fuld pris efter den gratis måned
- [ ] Lifetime-loft på 12 gratis måneder i alt (uændret fra tidligere regel)

## Bug reports ("Indberet fejl")

- [ ] "Indberet fejl"-indgang i brugermenuen/profilen
- [ ] Banner der reklamerer for 10 points ved godkendt fejlindberetning
- [ ] Admin-fane til gennemgang/godkendelse/afvisning af fejlrapporter
- [ ] 48-timers eskalering til admin, samme mekanisme som produkter

## Produkt-godkendelse (admin)

- [ ] Adskilt visning: bruger-indsendte vs. auto-importerede (AI/API/DB) —
      løst med filter/faner, ikke nye sider
- [ ] "Dato"-kolonne synlig (indsendelsestidspunkt)
- [ ] Unikt login-frit godkendelses-/afvisningslink i admin-mail
- [ ] 48-timers eskalering til admin, hvis et produkt stadig venter

## Bannere og betingelser

- [ ] Begge points-bannere (produkt-opret + fejlindberetning) slutter med "*"
- [ ] Lysegrå "*Læs betingelser"-linje under hvert banner, linket til
      `/betingelser#pointsystem`
- [ ] Ny Betingelser-side i HelloFresh-stil, tilpasset en kalorietæller-app
- [ ] "Betingelser"-rækken i Indstillinger peger på siden

## Besked automatisering (admin-fane)

- [ ] Admin-fane "Besked automatisering" (mail + push samlet)
- [ ] Skabeloner (emne + HTML-krop) redigerbare pr. event, on/off, kanal-valg
- [ ] Events dækket: kontooprettelse, e-mail-verifikation, glemt kodeord,
      invitér en ven, produkt godkendt/afvist, produkt/fejlrapport
      48-timers-eskalering, fejlrapport løst, points tildelt, videresendelse
      modtaget
- [ ] Reel afsendelse forberedt (SMTP via `src/lib/mailer.ts`, Web Push via
      `src/lib/push.ts`), men no-op indtil miljøvariabler er udfyldt
- [ ] Kø/log over afsendte/ventende beskeder til fejlsøgning

## Notifikationspræferencer (bruger)

- [ ] Side hvor brugeren kan slå email/push til/fra pr. kategori
- [ ] Indgang under Profil (Min konto)
- [ ] Indgang under Indstillinger
- [ ] Transaktionelle beskeder (verifikation, glemt kodeord, admin-eskalering)
      kan IKKE slås fra

## Scheduling / infrastruktur

- [ ] 48-timers-tjek er DB-drevet og kører i selve Next.js-processen
      (in-process scheduler), ikke bundet til Synology Task Scheduler
- [ ] Ingen Sydtrafik-infrastruktur eller -konti bruges noget sted i dette
      projekt

## "Invitér en ven"

- [ ] Egen fane under Profil
- [ ] Delbart invite-link med unik kode pr. bruger
- [ ] Ny bruger, der opretter sig via linket, matches til afsenderen
- [ ] Begge parter får 300 points ved gennemført tilmelding (efter samme
      ventetid-regel som i dag, ≥3 måneder)

## Betaling

- [ ] Ny side "Betaling" under Indstillinger
- [ ] Klar til Visa, Apple Pay, Google Pay og MobilePay (udbyder-uafhængig
      forberedelse — ingen konkret PSP kaldt endnu, da der ikke er en
      indløsningsaftale)
- [ ] Database/model klar (Subscription, PaymentMethod) til at blive koblet
      på en rigtig PSP senere
- [ ] Visning af aktiv/inaktiv abonnementsstatus

## Admin "Brugere"

- [ ] Ny admin-side/fane "Brugere" med liste over alle registranter
- [ ] Viser betalingsstatus (aktiv/ikke aktiv)
- [ ] Viser nyhedsbrevs-/kommunikationstilmeldinger pr. bruger
- [ ] "Log ind som bruger"-ikon (impersonation uden password, ny fane, logget
      i revisionsspor)
- [ ] "Ret til at blive glemt"-knap (GDPR-anonymisering, historik bevares)

## Admin — sprog

- [ ] Admin-UI kan skifte mellem dansk og engelsk
- [ ] Admin-brugerens sprogvalg gemmes (default dansk for Peter)

## Verifikation

- [ ] `npm run lint` og `npm run build` grøn
- [ ] Alle nye skærme gennemgået i browseren ved 402×874 (design.md §12)
- [ ] Fuldt videresend-flow testet mellem to testbrugere
- [ ] Fuldt invitér-en-ven-flow testet mellem to testbrugere
