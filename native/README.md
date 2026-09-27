# Hello Cal — native widgets

Færdig kildekode til hjemmeskærm-widgets (se `docs/WIDGETS.md`). Koden er
skrevet på Windows og er **ikke kompileret endnu** — den bygges første gang,
når der er en Mac (iPhone) / Android Studio (Android). Designet svarer til
forhåndsvisningen på `/widgets` i web-appen.

Begge platforme henter alt fra `GET /api/widgets/snapshot` med brugerens
personlige enhedstoken og gemmer seneste svar lokalt, så widgets virker offline.

## iPhone — `ios/HelloCalWidgets/`

Kræver: Mac med Xcode 16+, Apple Developer-konto, iOS 17+.

1. I Hello Cal-app-projektet: **File → New → Target → Widget Extension**, navn
   `HelloCalWidgets`, fravælg "Include Configuration App Intent".
2. Slet de genererede Swift-filer og træk alle filer fra `ios/HelloCalWidgets/` ind
   i targetet.
3. **Signing & Capabilities** på både app og widget-target:
   - App Groups: `group.dk.packroff.hellocal`
   - Keychain Sharing: `dk.packroff.hellocal.shared`
4. App-targetet: tilføj URL-skemaet `hellocal` (Info → URL Types) og route
   `hellocal://<sti>` til samme skærm som web-stien.
5. I appen efter login: `DeviceTokenStore.write(token)`; efter hver registrering:
   `WidgetCenter.shared.reloadAllTimelines()`.

Widgets: Tilføj (lille), Hurtig-tilføj (mellem, vælg 4 knapper), Statistik-graf
(mellem, vælg graf — læg flere i en Smart Stack), Statistik-boks (lille, vælg
boks), Seneste registreringer (mellem/stor).

## Android — `android/widgets/`

Kræver: Android Studio, minSdk 26. Modulet er et Android-bibliotek.

1. Kopiér `android/widgets` ind i Android-projektet og tilføj `include(":widgets")`
   i `settings.gradle.kts` og `implementation(project(":widgets"))` i appen.
   Projektet skal have Kotlin-plugins `compose` og `serialization`.
2. Appens hovedaktivitet skal have et intent-filter for `hellocal://`
   (`<data android:scheme="hellocal" />`, action VIEW, category DEFAULT + BROWSABLE)
   og route stien til den rigtige skærm.
3. I appen efter login: `DeviceTokenStore.write(context, token)` og
   `WidgetRefresh.schedule(context)`; efter hver registrering:
   `WidgetRefresh.now(context)`.

Widgets: Tilføj (1×1), Hurtig-tilføj (4×1, bredere = flere knapper, vælg op til
5), Statistik-graf (4×2, swipe op/ned mellem graferne), Statistik-boks (2×2, vælg
boks), Seneste registreringer (4×2, træk i højden for flere rækker).

Ikonerne i `res/drawable` er genereret fra de samme Tabler-ikoner som web-appen
(MIT); vægt og gryde er appens egne PNG'er.
