# Tjekliste: Pointsystem, betaling, besked-automatisering og admin-brugere

Samlet krav-liste fra samtalen 2026-09-02/03, til brug ved slutgennemgang.

**Status pr. 2026-09-03: al funktionalitet nedenfor er kodet, type-tjekket
(`tsc --noEmit`), lintet (`npm run lint`) og bygget (`npm run build`) grønt.
INGEN af punkterne er browser-verificeret endnu** — denne arbejdsstation har
ikke lokal database-adgang (se `docs/STATUS.md`), så de to nye migrationer
(`prisma/migrations/20260902020000_*`, `.../20260902030000_*`,
`.../20260902040000_*`) er hånd-skrevet og kun schema-valideret, ikke kørt
mod en rigtig database endnu. `[x]` betyder derfor "kodet", ikke "afprøvet i
browseren" — sæt kun `[x]` → reelt afkrydset/streget efter en live
gennemgang på `hellocal.packroff.dk`/`adminhellocal.packroff.dk` efter
deploy, jf. `AGENTS.md`/`design.md` §12.

## Points — optjening

- [x] 10 points ved godkendt bruger-oprettet produkt (titel, producent,
      næringsindhold, billede)
- [x] +5 points ekstra hvis varedeklaration/indholdsfortegnelse er udfyldt
- [x] +5 points ekstra hvis der er billeder af produktet fra flere vinkler
- [x] Points tildeles ved admin-godkendelse, ikke ved indsendelse
- [x] 10 points ved godkendt fejlindberetning ("Indberet fejl")
- [x] 5 points pr. gennemført "videresend til en ven" (modtager har rent
      faktisk tilføjet produktet/retten til sin egen dag)
- [x] Loft: maks. 50 videresend-points pr. kalendermåned pr. bruger
- [x] 300 points ved gennemført "invitér en ven" — til BÅDE afsender og ny
      bruger, ikke direkte en gratis måned
- [x] Points-saldo og historik vises under Profil → Points

## Misbrugsspærring (videresend til en ven)

- [x] To brugere der sender frem og tilbage til hinanden mere end én gang
      (en tur-retur) inden for 24 timer bliver automatisk flagget
- [x] Flag blokerer nye forward-points for begge, indtil admin rydder det
- [x] Flag er synligt/håndterbart i admin "Advarsler"

## Points — indløsning

- [x] 300 points kan indløses til 1 gratis abonnementsmåned
- [x] Indløsning kræver en gemt betalingsmetode, så abonnementet fortsætter
      automatisk til fuld pris efter den gratis måned
- [x] Lifetime-loft på 12 gratis måneder i alt (uændret fra tidligere regel)

## Bug reports ("Indberet fejl")

- [x] "Indberet fejl"-indgang i brugermenuen/profilen
- [x] Banner der reklamerer for 10 points ved godkendt fejlindberetning
- [x] Admin-fane til gennemgang/godkendelse/afvisning af fejlrapporter
- [x] 48-timers eskalering til admin, samme mekanisme som produkter

## Produkt-godkendelse (admin)

- [x] Adskilt visning: bruger-indsendte vs. auto-importerede (AI/API/DB) —
      løst med filter/faner, ikke nye sider
- [x] "Dato"-kolonne synlig (indsendelsestidspunkt)
- [x] Unikt login-frit godkendelses-/afvisningslink i admin-mail
- [x] 48-timers eskalering til admin, hvis et produkt stadig venter

## Bannere og betingelser

- [x] Begge points-bannere (produkt-opret + fejlindberetning) slutter med "*"
- [x] Lysegrå "*Læs betingelser"-linje under hvert banner, linket til
      `/betingelser#pointsystem`
- [x] Ny Betingelser-side i HelloFresh-stil, tilpasset en kalorietæller-app
- [x] "Betingelser"-rækken i Indstillinger peger på siden

## Besked automatisering (admin-fane)

- [x] Admin-fane "Besked automatisering" (mail + push samlet)
- [x] Skabeloner (emne + HTML-krop) redigerbare pr. event, on/off, kanal-valg
- [x] Events dækket: kontooprettelse, e-mail-verifikation, glemt kodeord,
      invitér en ven, produkt godkendt/afvist, produkt/fejlrapport
      48-timers-eskalering, fejlrapport løst, points tildelt, videresendelse
      modtaget
- [x] Reel afsendelse forberedt (SMTP via `src/lib/mailer.ts`, Web Push via
      `src/lib/push.ts`), men no-op indtil miljøvariabler er udfyldt
- [x] Kø/log over afsendte/ventende beskeder til fejlsøgning
- [ ] `ACCOUNT_CREATED`/`EMAIL_VERIFICATION`/`PASSWORD_RESET` er kun skabeloner
      endnu — der er intet reelt kald til `queueMessage()` fra
      register/login/glemt-kodeord-flowet (glemt kodeord findes slet ikke
      endnu). Kun eskalerings-/godkendelses-/points-/forward-events er
      faktisk koblet på.

## Notifikationspræferencer (bruger)

- [x] Side hvor brugeren kan slå email/push til/fra pr. kategori
- [x] Indgang under Profil (Min konto)
- [x] Indgang under Indstillinger
- [x] Transaktionelle beskeder (verifikation, glemt kodeord, admin-eskalering)
      kan IKKE slås fra

## Scheduling / infrastruktur

- [x] 48-timers-tjek er DB-drevet og kører i selve Next.js-processen
      (in-process scheduler), ikke bundet til Synology Task Scheduler
- [x] Ingen Sydtrafik-infrastruktur eller -konti bruges noget sted i dette
      projekt

## "Invitér en ven"

- [x] Egen fane under Profil
- [x] Delbart invite-link med unik kode pr. bruger
- [x] Ny bruger, der opretter sig via linket, matches til afsenderen
- [x] Begge parter får 300 points ved gennemført tilmelding (efter samme
      ventetid-regel som i dag, ≥3 måneder)

## Betaling

- [x] Ny side "Betaling" under Indstillinger
- [x] Klar til Visa, Apple Pay, Google Pay og MobilePay (udbyder-uafhængig
      forberedelse — ingen konkret PSP kaldt endnu, da der ikke er en
      indløsningsaftale)
- [x] Database/model klar (Subscription, PaymentMethod) til at blive koblet
      på en rigtig PSP senere
- [x] Visning af aktiv/inaktiv abonnementsstatus
- [ ] INGEN reel korttilføjelse endnu (bevidst) — siden viser kun status +
      understøttede metoder. Rå kortfelter er IKKE bygget med vilje: rigtig
      kortindtastning skal gå gennem en PSP's egne sikre/hostede felter, når
      en indløsningsaftale findes, se `docs/DECISIONS.md`.

## Admin "Brugere"

- [x] Ny admin-side/fane "Brugere" med liste over alle registranter
- [x] Viser betalingsstatus (aktiv/ikke aktiv)
- [x] Viser nyhedsbrevs-/kommunikationstilmeldinger pr. bruger
- [x] "Log ind som bruger"-ikon (impersonation uden password, ny fane, logget
      i revisionsspor)
- [x] "Ret til at blive glemt"-knap (GDPR-anonymisering, historik bevares)

## Admin — sprog

- [x] Admin-UI kan skifte mellem dansk og engelsk
- [x] Admin-brugerens sprogvalg gemmes (default dansk for Peter)
- [ ] Kun navigationen + overskrifterne på de NYE sider (produkter, brugere,
      fejlrapporter, besked automatisering) er oversat. Det ældre admin-UI
      (Oversigt, Billedforslag, Advarsler, Søg, Passkeys' indhold) er stadig
      kun dansk — separat opfølgningsopgave, ikke kerne-infrastrukturen.

## Kendt arkitektur-forudsætning fundet undervejs

- [x] Regulære brugere havde INGEN rigtig login-session (kun en delt
      `getDemoUser()`) — umuligt at bygge points/forward/notifikationer
      korrekt på. Byggede rigtig session (`src/lib/user-auth.ts`,
      `/api/auth/login`, `/api/auth/logout`, register sætter nu cookien).
      `/login`-siden var en permanent deaktiveret mockup — nu et rigtigt
      login-form. `POST`/`GET /api/registrations` foretrækker nu sessionen
      og falder tilbage til demo-brugeren uændret, hvis ingen session findes.

## Verifikation

- [x] `npm run lint` grøn
- [x] `npm run build` grøn (Turbopack, alle nye ruter kompilerer)
- [ ] Alle nye skærme gennemgået i browseren ved 402×874 (design.md §12) —
      **afventer deploy**, ingen lokal database til at teste imod
- [ ] Fuldt videresend-flow testet mellem to testbrugere — **afventer deploy**
- [ ] Fuldt invitér-en-ven-flow testet mellem to testbrugere — **afventer deploy**
- [ ] De tre hånd-skrevne migrationer kørt og verificeret med
      `prisma migrate deploy` på Synology-instansen
