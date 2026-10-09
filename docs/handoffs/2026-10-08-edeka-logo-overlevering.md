# Overlevering 2026-10-08: Edeka-logo genkøring og restpunkter

Til den session, som brugeren starter fra profilen peter@packroff.dk, når der er nye credits.

## Status

Alle opgaverne fra "Overdragelse fra Claude til Claude" er bygget og pushet til master. Det dækker UI-rettelser, smartvægt, flows, hjælpecenter, offline og scan, admin, retter, halvcirkel og Tilføj-menu.

## Det eneste der mangler: Edeka-logoet

- Edeka-logoet viser kun det gule hjerte. Rettelsen ligger i `scripts/image-agent/cutout.py` (commit e745004e) og virker kun på nye billeder.
- Admin har nu knapperne "Erstat logo" og "Genkør logo" på hvert brand-kort (commit e9e333cf). Se Admin, Varedatabase, Brands.
- Genkør virker kun, hvis logoet stammer fra et fritlægningsjob. Er det uploadet manuelt, skal "Erstat logo" bruges med den rigtige PNG.

## Trin

1. Bekræft at seneste commit på origin/master er deployet og at billedrobotten kører den nye `cutout.py`. Genstart den, hvis den ikke redeployes automatisk.
2. Brugeren logger selv ind som admin i browser-ruden. Log aldrig ind for brugeren og tast aldrig adgangskoder.
3. Åbn Admin, Varedatabase, Brands, søg "Edeka" og tryk "Genkør logo".
4. Vent nogle minutter, genindlæs og kontroller at både gult hjerte og blåt felt er med.
5. Viser kortet "Logoet stammer ikke fra et fritlægningsjob", så brug "Erstat logo".

## Ikke verificeret

- Knapperne er ikke prøvet, og siden er ikke set. Python findes ikke på arbejdsmaskinen, så `cutout.py` er ikke kørt.
- En samlet build blev ikke kørt lokalt, fordi Prisma-klienten var forældet. GitHub-buildet er den første rigtige kontrol.
- Halvcirklen, Tilføj-menuen og logoændringerne er ikke set på en telefon.

## Regler for denne session

- Ingen screenshots, medmindre brugeren beder om det.
- Svar på dansk, kort. Åbn med "Klar til arkivering" eller "IKKE klar til arkivering".
- Ingen login til GitHub på denne konto.
