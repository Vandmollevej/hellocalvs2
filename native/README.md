# Hello Cal — native apps (Android + iPhone)

Hello Cal er en **helt native** app (docs/DECISIONS.md 2026-10-07). Alle skærme
er skrevet én gang i Kotlin med Compose Multiplatform (`shared/`) og kompileres
til både Android og iPhone. Der er altså to steder at rette en skærm: webappen
(`src/`) og `native/shared/`.

| Mappe | Indhold |
| --- | --- |
| `shared/` | Alle skærme, tema, tekster, API-klient (Android + iPhone) |
| `androidApp/` | Android-appen (MainActivity, deep links, widgets, Health Connect) |
| `iosApp/` | iPhone-appen (`project.yml` → `xcodegen generate`) |
| `android/widgets`, `android/healthconnect` | Android-widgets og Health Connect-synk |
| `ios/HelloCalWidgets` | iPhone-widgets (WidgetKit) |
| `parity/` | Hvilken native skærm der svarer til hvilken web-side |

Byg: GitHub Actions (`.github/workflows/native.yml`) bygger Android-APK'en og
iPhone-appen (simulator) ved hvert push, der rører `native/`. APK'en ligger som
artefakt på kørslen. Lokalt: `gradle -p native :androidApp:assembleDebug`
(kræver JDK 17 + Android SDK).

## Hold web og native i takt

Der er tre mekanismer, så en rettelse ikke kun lander ét sted:

1. **Genereret fra web — rettes aldrig i hånden.** `node scripts/native/sync.mjs`
   læser `src/app/globals.css` (farver, mål, `.hf-type-*`), `src/i18n/locales/*.json`
   (alle tekster), de Tabler-ikoner web bruger og app-ikonet, og skriver
   `HcTokens.kt`, `HcTokens.swift`, `hc_tokens.xml`, `TablerData.kt` og
   `composeResources/files/locales/*.json`. Ændrer du et token, en tekst eller et
   ikon på web, så kør scriptet og commit resultatet.
2. **Paritets-manifest.** `parity/screens.json` har én række pr. web-side:
   `ported` (native skærm findes), `pending` (mangler) eller `web-only`
   (admin/partner/butiks-scanner). For hver porteret skærm gemmer
   `parity/accepted.json` et fingeraftryk af web-filerne, skærmen er bygget af:
   siden plus alle komponenter, den importerer, rekursivt.
   - `node scripts/native/parity.mjs` viser, hvilke native skærme der er bagud.
   - `--port <rute> <fil.kt>`: ny skærm porteret.
   - `--accept <rute>`: ændringen er overført.
   - `--register`: nye web-sider tilføjes som `pending`.
3. **Automatisk håndhævelse.**
   - Claude Code-hooken i `.claude/settings.json` stopper en session, der har
     ændret web-UI uden at overføre ændringen til native.
   - CI-jobbet "Web ↔ native in step" fejler på GitHub, hvis noget er ude af takt.

Kun UI tæller (`src/app/**` undtagen `api/`, og `src/components/**`).
Forretningslogik i `src/lib` når native via de samme `/api`-ruter som web.

## Telefon-funktioner (platform)

Alt der kræver telefonen selv, går gennem ét lag:
`shared/src/commonMain/.../platform/Device.kt`. Skærmene kalder `Device.*`
(suspend-funktioner) eller områdets lille facade (`CaptureHooks`,
`FoodPlatform`, `OnboardingHooks`, `ProfileNativeBridge`, `SettingsImportMedia`,
`SettingsSupportHooks`), som sender videre til `Device`. Platformene
implementerer `DevicePlatform` (callback-baseret, så Swift kan implementere den
direkte) og sætter `Device.platform` ved opstart.

| Funktion | Android (`androidApp/.../device/AndroidDevice.kt`) | iPhone (`iosApp/HelloCal/IosDevice.swift`) |
| --- | --- | --- |
| Tag foto (JPEG, maks. 1600 px) | `TakePicture` + FileProvider, EXIF-rotation | `UIImagePickerController` |
| Vælg fotos / filer (også video) | Systemets fotovælger (`PickVisualMedia`) | `PHPickerViewController` |
| Video → billeder (hvert 1,2 s, maks. 900 px, dubletter fjernes i fælles kode) | `MediaMetadataRetriever` | `AVAssetImageGenerator` |
| Tekstgenkendelse (OCR) | ML Kit Text Recognition (i appen, offline) | Vision `VNRecognizeTextRequest` |
| Stregkode/QR live | Google code scanner (Play-tjenester) | Egen AVFoundation-scanner |
| Stregkode i foto | ML Kit Barcode (Play-tjenester) | Vision `VNDetectBarcodesRequest` |
| Tale → tekst | `SpeechRecognizer` | `SFSpeechRecognizer` + `AVAudioEngine` |
| Del | `ACTION_SEND`-vælger | `UIActivityViewController` |
| Bekræft ejer (billeddagbog) | `BiometricPrompt` (fingeraftryk/ansigt/kode) | `LAContext` (Face ID/Touch ID/kode) |
| App i baggrunden | `MainActivity.onStop` | `didEnterBackgroundNotification` |
| App tilbage i forgrunden (fx efter Stripe-portalen) | `MainActivity.onStart` | `willEnterForegroundNotification` |

Ikke slået til endnu (kræver eksterne konti/opsætning, svarer `"unsupported"`):

- **Passkeys/Face ID-login:** Android kræver `/.well-known/assetlinks.json` på
  hellocal.packroff.dk med appens signeringscertifikat + `androidx.credentials`;
  iPhone kræver Associated Domains (`webcredentials:hellocal.packroff.dk`) og
  `apple-app-site-association` på serveren.
- **Push (login-godkendelse):** Android kræver et Firebase-projekt
  (`google-services.json`) og FCM på serveren; iPhone kræver Push
  Notifications-capability og en APNs-nøgle på serveren.

## Widgets og Health Connect

Widget-kildekoden er beskrevet i `docs/WIDGETS.md`. Designet svarer til
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

## Android — `android/healthconnect/`

Kræver: Android Studio, minSdk 26 (Health Connect findes på Android 9+; på
Android 14+ er det en del af systemet, ellers appen "Health Connect" fra Play
Butik). Modulet er et Android-bibliotek uden UI og bruger
`androidx.health.connect:connect-client:1.1.0`. Backend-kontrakten står i
`docs/HEALTHKIT_COMPANION.md`.

1. Kopiér `android/healthconnect` ind i Android-projektet og tilføj
   `include(":healthconnect")` i `settings.gradle.kts` og
   `implementation(project(":healthconnect"))` i appen. Projektet skal have
   Kotlin-pluginet `serialization`.
2. Manifestet i modulet flettes ind i appen. Det erklærer alle Health
   Connect-tilladelser, `<queries>` for Health Connect og den krævede
   forklaringsskærm (`PermissionsRationaleActivity`, der åbner
   `/privatlivspolitik`) — både for Android 13 og ældre
   (`ACTION_SHOW_PERMISSIONS_RATIONALE`) og Android 14+
   (`VIEW_PERMISSION_USAGE`). Fjern en tilladelse fra manifestet, hvis typen
   ikke skal bruges.
3. I appen efter login: `DeviceTokenStore.write(context, token)` (samme token
   og samme krypterede lager som widgets). Hent valgene med
   `HelloCalApi.export(context, null).settings` (uden `since` flyttes intet), og bed om adgang med
   `PermissionController.createRequestPermissionResultContract()` og
   `HealthConnectPermissions.forSettings(settings, HealthConnectClient.getOrCreate(context))`
   — kun de typer, brugeren har slået til på Health Connect-siden i web-appen.
   Kald derefter `HealthConnectScheduler.schedule(context)` (hver time) og
   `HealthConnectScheduler.now(context)`; kald `now` igen, når brugeren har
   ændret valg eller givet nye tilladelser, og når appen åbnes.
4. Baggrundslæsning kræver `READ_HEALTH_DATA_IN_BACKGROUND`. `forSettings`
   beder kun om den, når telefonen understøtter det. Uden den læser modulet
   kun, mens appen er åben; skrivning til Health Connect sker også i
   baggrunden.
5. Før udgivelse: Google Play kræver Health Connect-erklæringen (Play Console →
   App-indhold → Sundhedsapps / Health apps), hvor hver tilladelse i manifestet
   begrundes. Uden den afvises appen.

Hvad modulet gør (`HealthConnectSync.run`): henter valg og data fra
`export`, læser de slåede-til typer fra Health Connect (første gang 30 dage
tilbage, derefter fra sidste læsning minus én dag), sender dem til `ingest` i
bidder af højst 500, skriver Hello Cal-registreringer, vand, vejninger og
træning til Health Connect (Hello Cal-id som `clientRecordId`, så intet
skrives to gange) og gemmer til sidst cursor og læsetidspunkt. Mangler en
tilladelse, springes typen over. Data, Hello Cal selv har skrevet, sendes
aldrig tilbage.

Smartvægte og ure: Samsung Health, Renpho, Eufy, Xiaomi (Mi Fitness / Zepp
Life) og Garmin Connect skriver til Health Connect, når brugeren slår deling
til Health Connect til i den app. Derefter kommer deres data ind i Hello Cal
gennem dette modul; hver post sendes med appens pakkenavn som `origin`, så
Hello Cal kan vise, hvilken app dataene kom fra.
