# PII-adskillelse: e-mail, navn og telefon væk fra øvrige data

Brugerens spørgsmål: "Vil man kunne adskille e-mail, navn og telefon ud af databasen og over på sig egen, så kun med den rigtige krypteringsnøgle kan skabe sammenhængen mellem denne data og øvrig data ved hackerangreb? Eller hvordan opnår man den største sikkerhed?"

**Kun en anbefaling — intet er bygget.** Strengt vault gælder kun admin (DECISIONS: "Strict security = admin only"); almindelige app-brugere beholder normalt login (e-mail/adgangskode, Face ID, Google/Apple/Facebook).

## Kort svar

Ja, det kan lade sig gøre — og et stort skridt er allerede taget. I dag (`docs/DECISIONS.md` 2026-10-04) er `User.email` og `User.displayName` AES-256-GCM-krypteret felt for felt (`USER_DATA_KEY`), og login slår op via `User.emailHash` (HMAC-SHA256 med `USER_EMAIL_HASH_KEY`). En hacker, der kun stjæler databasen, får altså ikke navn/e-mail i klartekst. **Det, der mangler, er:** (1) telefonnummeret (`User.phone`, `prisma/schema.prisma:72`, og telefonfeltet i tabellen ved linje 494) er ikke krypteret på samme måde, (2) navn/e-mail ligger stadig på samme række som sundhedsdata og brugerens `id`, så sammenhængen er "en række" — og begge nøgler ligger i samme miljøfil på samme server som databasen.

## Mulighederne (fra mindst til mest sikker)

| # | Model | Hvad det giver | Pris / ulempe |
| --- | --- | --- | --- |
| A | **Nu:** felt-kryptering på samme række (e-mail, navn) | Database-dump alene er ubrugelig for navn/e-mail | Samme række, samme server som nøglen. Telefon mangler. Hacker med server-adgang (app-processen) får både data og nøgle |
| B | A + **telefon krypteret** + `phoneHash` (blind index) | Lukker det åbne hul i A | Lille ændring, samme mønster som e-mail |
| C | **Pseudonymisering / PII-vault**: egen tabel `user_identity` (`userId` → krypteret e-mail/navn/telefon + blind indexes). `User` får kun et tilfældigt `pseudonymId` og ingen PII | Sundhedsdata og identitet ligger i adskilte tabeller; en dump af de øvrige tabeller er anonym. Kobling kræver både identitets-tabellen **og** nøglen | Alt der i dag læser `user.email`/`displayName` (ca. 56 filer, i dag skjult af `src/lib/prisma.ts`-udvidelsen) skal gennem ét identitetslag. Mails, support, faktura skal slå op eksplicit |
| D | C + **separat database/skema med egen database-bruger**, som appen kun når via et lille identitets-modul (helst egen container) | Selv SQL-injektion i appen når ikke identiteten; kompromitteret app-bruger kan ikke `SELECT` på vault-tabellen | Ekstra container på Synology, to forbindelser, to backups |
| E | D + **envelope encryption med nøgle-hierarki** (se nedenfor) | Hver bruger har sin egen datanøgle; sletning = slet nøglen ("crypto-shredding", GDPR-sletning bliver ægte) | Mere kode og nøgle-drift |
| F | E + **nøgle i hardware/ekstern KMS** (HSM, cloud-KMS) | Nøglen forlader aldrig hardwaren | Kræver cloud/ekstern tjeneste — ikke muligt kun med Synology uden ekstra service; ikke anbefalet endnu |

## Anbefaling (konkrete trin)

Stop ved **D + envelope encryption (E)** for admin- og betalings-/CPR-nær data, og ved **B → C** for almindelige brugere. Gør det i denne rækkefølge, ét trin ad gangen, hvert trin deployes og verificeres før næste:

1. **Telefon (B):** krypter `User.phone` (og telefonfeltet i tabellen ved `schema.prisma:494`) som e-mail; tilføj `phoneHash` (HMAC-SHA256, normaliseret E.164, egen nøgle `USER_PHONE_HASH_KEY`) til opslag/dublet-tjek. Udvid `src/lib/prisma.ts`-udvidelsen og backfill-scriptet `scripts/encrypt-user-data/backfill.cjs`.
2. **Nøgle-hierarki (E):** ét rod-nøgle (KEK) som i dag, men gem pr. bruger en tilfældig datanøgle (DEK), krypteret med KEK, i vault-tabellen. PII krypteres med brugerens DEK. Rotation af KEK = gen-kryptér kun DEK'erne (ikke alle felter). Sletning af en bruger = slet DEK'en.
3. **Vault-tabel (C):** opret `user_identity(userId, emailEnc, nameEnc, phoneEnc, emailHash, phoneHash, dekEnc)`. `User` mister `email`/`displayName`/`phone`, får `pseudonymId`. Læs/skriv kun via ét modul (`src/lib/identity/*`), så resten af koden aldrig rører PII direkte. Opslag ved login: `emailHash` → `userId`.
4. **Adskilt skema og database-bruger (D):** vault-tabellen i eget Postgres-skema, med en rolle kun identitets-modulet bruger; app-rollen for øvrige data har ingen rettigheder dér. På Synology: samme Postgres-container er acceptabelt som første skridt; egen container senere.
5. **Nøglehåndtering på Synology:**
   - Nøgler (`USER_DATA_KEY`, `USER_EMAIL_HASH_KEY`, nye `USER_PHONE_HASH_KEY`, KEK) ligger i dag i `/deploy/.env.production`. Flyt dem til **Docker secrets** (filer med 0400, ikke miljøvariabler, så de ikke vises i `docker inspect`/procesliste) og læs dem ved opstart.
   - **Aldrig** nøgler i samme backup som databasen: database-backup på ét sted, nøgle-backup (kryptér med adgangskodemanager/offline USB) et andet. Uden nøglen er backupen ubrugelig — det er hensigten, men test gendannelse mindst én gang.
   - Synology-volumen med databasen og nøgle-filen bør ligge på hver sin krypterede delt mappe, så en stjålet disk ikke giver begge.
   - Nøgle-rotation: planlæg årlig KEK-rotation (trin 2 gør den billig). Log aldrig nøgler eller dekrypterede værdier.
6. **Blind index (opslag uden dekryptering):** behold HMAC-hash til e-mail/telefon (allerede indført for e-mail). Brug en **separat nøgle pr. felt**, og gem kun hashen — ikke en ren SHA-256 (kan brute-forces for telefonnumre, som har få mulige værdier; HMAC med hemmelig nøgle kan ikke).
7. **Admin (streng vault):** admin-konti får, ud over ovenstående, Face ID/passkey + TOTP (findes), IP-begrænsning (findes, DECISIONS 2026-09-29), og dekryptering af PII kun via en logget "vis"-handling (hvem, hvornår, hvorfor) — aldrig bulk-eksport. Almindelige app-brugere berøres ikke af vault-flowet.

## Hvad det beskytter mod — og hvad det ikke gør

| Angreb | A (nu) | C/D/E |
| --- | --- | --- |
| Stjålet database-dump / backup | Navn/e-mail beskyttet, telefon **ikke** | Alt PII beskyttet; øvrige data er anonyme |
| SQL-injektion i appen | PII krypteret, men appen kan dekryptere | D: app-rollen kan ikke læse vault-tabellen |
| Fuld server-kompromittering (app + nøgle) | Alt kan læses | Stadig kan appen dekryptere det, den skal bruge — kun F (KMS/HSM) eller begrænset adgang pr. container hjælper; D/E begrænser omfanget og gør det synligt i logs |
| Ond admin/intern | Kan læse via app | Logget, begrænset "vis"-handling |

Ingen løsning på en enkelt server beskytter fuldt mod en angriber, der overtager selve app-processen — målet er at gøre en **database-lækage** værdiløs og at begrænse og logge adgang.

## Beslutning der kræves fra brugeren, før noget bygges

- Skal trin 1 (telefon) laves med det samme som lille, sikker forbedring? (Anbefalet: ja.)
- Skal hele vault-adskillelsen (trin 3–4) laves, vel vidende at den rører ~56 filer bag `prisma.ts`-udvidelsen? (Anbefalet: ja, som eget checkpoint efter trin 1–2, med migration og backfill.)
