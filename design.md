# HELLO CAL — bindende visuel designkontrakt og audit

Senest opdateret: 2026-09-02

Dette dokument er den visuelle kontrakt for Hello Cal. Det beskriver de
HelloFresh-mål, farver, typografiske roller, afstande og komponentvarianter,
som skal genbruges. Det beskriver også præcist, hvor den nuværende kode afviger.

Dokumentet ændrer ikke applikationskoden. Afsnittet "Nuværende audit" er en
implementeringsliste, ikke en påstand om at rettelserne allerede er udført.

## 1. Autoritet og afgrænsning

Følgende rækkefølge gælder ved konflikt:

1. Brugerens aktuelle besked og varige produktbeslutninger i
   `docs/DECISIONS.md` og `docs/SPECIFICATION.md`.
2. Produktreglerne i `docs/UI.md`, herunder Hello Cal-specifik adfærd.
3. Denne fil for visuel udførelse: farver, typografi, geometri, afstande,
   radius, ikoner og genbrugelige UI-primitiver.
4. `docs/DESIGN_V2.md` som arbejds- og funktionsliste.
5. Eksisterende kode. Koden er ikke designkilde, når den afviger fra reglerne.

HelloFresh er den visuelle reference, men Hello Cal er ikke en kopi af
HelloFreshs informationsarkitektur. Sider, funktioner og adfærd, der er
bevidst anderledes, skal bevares.

Følgende eksisterende Hello Cal-regler må ikke overskrives af en visuel audit:

- Forsidens drejehjul og den særlige FAB-adfærd.
- Bundmenuens fire Hello Cal-funktioner og den aftalte omarrangering.
- Kalenderens aftalte statussemantik, streak, søvn og arbejdstider.
- Reglen om automatisk lagring og ingen generel "Gem"-knap.
- Registrerings-, kamera-, tale-, statistik- og produktflows, som ikke findes i
  HelloFresh.
- Profilcirklen til venstre og højre side reserveret til luk-handling, hvor
  `docs/UI.md` kræver det.

På Hello Cal-specifikke skærme skal HelloFreshs visuelle primitiver genbruges;
man må ikke opfinde et nyt visuelt system, blot fordi skærmens indhold er nyt.

## 2. Referencegrundlag og målemetode

Primære visuelle kilder ligger i `Hello Fresh inspiration/`:

- `Startside.png`
- `Log-in.png`
- `Log-ind konto.png`
- `Log-ind konto 2.png`
- `Oprettelsesflow.png`
- `Sproglag.png` og `sprog 2.png`
- `IMG_1247.PNG` til `IMG_1253.PNG`
- `Design af liste-visning.png`
- `Liste visning med billeder.png`
- `Sådan skal alle bokse være i farve og billeder vises.jpg`
- `Favoritikon.jpg`

De originale iPhone-screenshots er **1206 × 2622 px**, svarende til
**402 × 874 logiske CSS-pixels ved præcis 3× skalering**. Den tidligere tekstfil
angiver 941 × 2048 og ca. 2,34×, fordi billederne var blevet nedskaleret i en
visning. Det er ikke originalfilernes skala. Alle faste mål i denne kontrakt er
normaliseret med 3 billedpixels = 1 CSS-pixel.

Måleregler:

- Farver tages fra store, ensfarvede områder i original-PNG'erne, ikke fra
  antialiaserede kanter eller JPEG-kompression.
- Geometri måles på 402 × 874-referenceviewporten.
- Tekststørrelser følger den eksisterende typografianalyse, men skalaen er
  korrigeret til originalfilerne.
- Ved implementering accepteres højst ±1 CSS-pixel på faste højder, radius og
  gutters og ±2 CSS-pixels på optisk tekst-/ikoncentrering.
- Farvekoder og typografiske tokens skal være eksakte, ikke "næsten ens".

### 2.1 Officiel web-krydskontrol — 2026-08-31

Den offentlige [HelloFresh Danmark-forside](https://www.hellofresh.dk/) er
kontrolleret i en frisk browservisning ved både 1280 × 720 og 402 × 874 px.
[HelloFreshs danske login](https://www.hellofresh.dk/login) er desuden målt for
felter, knapper og states. Værdierne nedenfor er aflæst som browserens endelige
computed styles og kontrolleret mod sidens indlæste CSS-regler; de er ikke
estimeret fra et skærmbillede.

Websitet er **sekundær evidens**. Appskærmbillederne er stadig primær autoritet
for Hello Cal, fordi HelloFreshs marketingwebsite og app bruger forskellige
fontfamilier og enkelte kontekstuelle farver. Et webfund må derfor:

- bekræfte en app-token eller en generel designfamilie;
- dokumentere en særskilt webtilstand;
- aldrig automatisk overskrive en direkte måling fra appen.

#### Bekræftede fælles værdier

| Rolle | Officiel webmåling | Konklusion for Hello Cal |
| --- | --- | --- |
| Primær tekst | `#242424` | Bekræfter `--hf-color-text` 1:1. |
| Mørk action/CTA | `#232323` | Bekræfter `--hf-color-action` 1:1. |
| Brandgrøn | `#067A46` | Bekræfter brand-tokenen 1:1 på links, badges og branddetaljer. |
| Varm sideflade | `#FAF8F3` | Bekræfter page-tokenen 1:1 på navigation, sektioner og loginfelter. |
| Sekundær tekst | `#656565` | Bekræfter secondary-tokenen 1:1. |
| Auth-feltkant | `#7D7561` | Bekræfter field-border-tokenen 1:1. |
| Primær knap | 48 px høj, radius 8 px, `#232323`, hvid label | Bekræfter standardknappens højde, radius og farver. |
| Sekundær knap | 48 px høj, radius 8 px, 1 px indvendig `#232323` kant | Bekræfter secondary-varianten. |
| Auth-felt | 48 px høj, radius 4 px, 12 px intern padding | Bekræfter authfeltets kompakte radiusfamilie og højde. |
| Ikon-hit-area | 44 × 44 px på luk-/ikonhandling | Bekræfter minimumsmålet i ikonknapkontrakten. |
| Afstandssystem | gentagne 4, 8, 12, 16, 24, 32 og 48 px | Bekræfter den valgte 4/8-baserede spacingfamilie. |

Websitets primære knap bruger 16/24 px Roboto bold og 24 px horisontal
padding. Det bekræfter 24 px line-height og den brede CTA-familie, men ændrer
ikke appens direkte målte 17 px knaplabel eller app-padding. Web og app skal
ikke blandes inden i samme komponentvariant.

#### Dokumenterede web/app-afvigelser

| Område | Officielt website | Målt appreference / bindende regel |
| --- | --- | --- |
| Displayfont | Agrandir Tight | SF Pro/systemfont i den målte iOS-app. |
| Brødtekst og knapper | Roboto | SF Pro Text/systemfont i appen. |
| Marketing-hero-grøn | `#056835` | Ikke en generel appgrøn; appens brand er `#067A46`, nyere appbar `#35784A`. |
| Webknap hover | `#353535` | Kun web/hover-state; må ikke erstatte appens hvilende `#232323`. |
| Webknap active | `#4B4B4B` | Kun web/pressed-state, hvis en web-hover/active-variant senere besluttes. |
| Webknap disabled | `#ADADAD` | Appens målte disabled-token forbliver `#A6A29F`. |
| Felt hover/focus | `#615C50` / `#4A463D` | Kan bruges som navngivne interaktionsstates; basekanten er fortsat `#7D7561`. |
| Apple web-login | `#000000`, 40 px, radius 4 px | Appens social-login-reference styrer Hello Cal: `#232323`, 48 px. |
| Facebook web-login | `#29487D`; hover `#166FE5`; active `#1877F2` | Appreferencens `#00178C` forbliver auth-appvarianten. |
| Google login | Ikke vist på den aktuelle danske web-login | `#4285F4` kommer fortsat fra den direkte appreference. |

Websitets responsive typografiskala bruger bl.a. 32/40 px til mobil-H1,
24/32 px til mobil-H2 og 20/24 px til mindre overskrifter. Det understøtter
hierarkiet og de navngivne størrelsesroller, men font, weight og appens direkte
målte line-height forbliver bindende. Claude må ikke skifte hele Hello Cal til
Agrandir/Roboto med henvisning til webkontrollen.

## 3. Fast farvepalette

Referencerne bruger to dokumenterede grønne kontekster. De må ikke blandes til
en tredje, vilkårlig mellemfarve.

| Foreslået token | Eksakt værdi | Brug |
| --- | --- | --- |
| `--hf-color-page` | `#FAF8F3` | Standard sidebaggrund |
| `--hf-color-surface` | `#FFFFFF` | Felter, modaler og lyse overflader |
| `--hf-color-card` | `#EEE9DF` | Kort, kategori-fliser og indstillingsgrupper i de nyere appskærme |
| `--hf-color-nav` | `#DFD9CC` | Bundnavigation og nyere fast action-bar |
| `--hf-color-nav-legacy` | `#E0D9CB` | Kun de ældre referenceflows, hvor denne farve måles direkte |
| `--hf-color-brand` | `#067A46` | Login, onboarding, loader og brand-header |
| `--hf-color-appbar` | `#35784A` | Nyere HelloFresh-appbar: Kogebog, Opdag og Indstillinger |
| `--hf-color-progress-dark` | `#035624` | Aktiv progress-tekst |
| `--hf-color-progress` | `#007838` | Aktiv progress-linje, når referenceflowet kræver den |
| `--hf-color-text` | `#242424` | Primær tekst |
| `--hf-color-action` | `#232323` | Primær knap, aktive nav-elementer og mørke ikoner |
| `--hf-color-action-hover` | `#353535` | Officiel web-hover for mørk CTA; kun enheder med hover |
| `--hf-color-action-active` | `#4B4B4B` | Officiel web-pressed-state for mørk CTA |
| `--hf-color-secondary-hover` | `#E3E3E3` | Officiel web-hover for secondary-knap |
| `--hf-color-secondary-active` | `#D2D2D2` | Officiel web-pressed-state for secondary-knap |
| `--hf-color-text-secondary` | `#656565` | Sekundær tekst og inaktive nav-labels |
| `--hf-color-inactive` | `#828282` | Inaktiv progress og tydeligt nedtonede elementer |
| `--hf-color-placeholder` | `#C1C0BE` | Placeholder-tekst |
| `--hf-color-disabled` | `#A6A29F` | Deaktiveret plus/minus og tilsvarende controls |
| `--hf-color-line` | `#AFADAA` | Standardseparator og nav-toplinje |
| `--hf-color-field-border` | `#7D7561` | Feltkant i auth-/checkout-referencerne |
| `--hf-color-field-hover` | `#615C50` | Officiel web-hover for authfeltets kant |
| `--hf-color-field-focus` | `#4A463D` | Officiel web-focus for authfeltets kant |
| `--hf-color-white` | `#FFFFFF` | Tekst/ikoner på mørke flader |
| `--hf-color-google` | `#4285F4` | Google social login |
| `--hf-color-facebook` | `#00178C` | Facebook social login |

Projektets allerede besluttede `--hf-lime: #A3E635` til positive
Hello Cal-markeringer og de eksisterende røde statusbetydninger bevares som
Hello Cal-undtagelser. De skal fortsat have navngivne semantiske tokens. Der må
ikke bruges Tailwind-standarder som `red-500`, `red-600` og `red-700` direkte.

### Farveregler

- En side eller komponent må aldrig indeholde en ny hex-, rgb- eller
  Tailwind-standardfarve, hvis en semantisk token dækker rollen.
- `opacity-*` må ikke bruges som en genvej til at gætte en tekstfarve. Brug den
  korrekte token, medmindre referencen udtrykkeligt er en transparent overlay.
- `#17794A` er ikke en målt referencefarve. Den må ikke være fælles
  HelloFresh-grøn.
- `#F3EFE2`, `#EAE3D1` og `#1A1A17` er ikke 1:1 med de målte side-, kort- og
  actionfarver.
- Brand-header og nyere appbar er to navngivne varianter; Claude må aldrig
  "harmonisere" dem til en ny tredje grøn.
- `#056835` er målt på websitets marketing-hero, men er ikke en generel
  HelloFresh-appfarve. Den må kun indføres som en særskilt marketingvariant,
  hvis Hello Cal faktisk får en tilsvarende flade.
- Hover- og active-farverne ovenfor må kun bruges til deres navngivne state.
  De er ikke alternative mørke gråtoner til statisk tekst, ikoner eller kort.

## 4. Typografisk system

### 4.1 Fontfamilie

Primær UI-font er SF Pro/systemfont:

```css
-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif
```

- Display-roller bruger SF Pro Display først.
- Brødtekst, inputs, knapper, links og labels bruger SF Pro Text først.
- Tilladte weights er 400, 600 og 700.
- Italic anvendes ikke i referencegrundlaget.
- Geist må ikke være standardfont i den brugerrettede app. En adminflade kan
  kun afvige, hvis det besluttes eksplicit.

### 4.2 Bindende tekstroller

| Klasse/token | Størrelse / line-height | Weight | Farve | Justering | Brug |
| --- | --- | --- | --- | --- | --- |
| `.hf-type-hero` | 32 / 38 px | 700 | tekst eller brandgrøn | venstre | Stor start-/marketingoverskrift |
| `.hf-type-page-title` | 24 / 29 px | 700 | tekst | centreret | Primær indholdsoverskrift, alle skærme |
| `.hf-type-nav-title` | 20 / 24 px | 700 | hvid | centreret | Appbar-titel |
| `.hf-type-section-title` | 20 / 24 px | 700 | tekst | venstre | Sektionstitel |
| `.hf-type-category-title` | 18 / 22 px | 700 | `#464646` | centreret | Kategorikort |
| `.hf-type-body-lg` | 20 / 29 px | 400 | tekst | venstre | Stor introduktionstekst |
| `.hf-type-body` | 17 / 25 px | 400 | tekst | venstre | Standard UI- og brødtekst |
| `.hf-type-body-sm` | 15 / 22 px | 400 | tekst | venstre | Sekundær brødtekst |
| `.hf-type-caption` | 13 / 18 px | 400 | sekundær/inaktiv | venstre | Generelle captions |
| `.hf-type-progress-active` | 13 / 18 px | 600 | `#035624` | venstre | Aktivt trin i progress-indikator |
| `.hf-type-progress-inactive` | 13 / 18 px | 400 | `#828282` | venstre | Inaktivt trin i progress-indikator |
| `.hf-type-label` | 12 / 16 px | 400 | tekst | venstre | Floating input-label |
| `.hf-type-button` | 17 / 24 px | 700 | kontekst | centreret | Primær/sekundær knap |
| `.hf-type-input` | 17 / 24 px | 400 | tekst | venstre | Inputværdi |
| `.hf-type-placeholder` | 16 / 24 px | 400 | placeholder | venstre | Placeholder |
| `.hf-type-tab` | 12 / 16 px | 400 | action/sekundær | centreret | Bundnavigation. Aktiv/inaktiv adskilles KUN på farve, aldrig vægt (bekræftet mod `Startside.png`: "Bestil" har samme vægt som "Opdag"/"Kogebog"/"Profil"). |

En side må ikke vælge `text-[15px]`, `text-sm`, `font-medium` eller en vilkårlig
line-height for en ny overskrift. Den skal vælge en af rollerne. Hvis ingen
rolle passer, skal kontrakten udvides én gang centralt før siden bygges.

## 5. Afstands- og geometri-system

### 5.1 Basisskala

Kun følgende generelle afstande må bruges: **4, 8, 12, 16, 24, 32, 40 og
48 px**. Særlige mål må kun ligge i en navngiven komponenttoken.

| Token/klasse | Mål | Brug |
| --- | --- | --- |
| `--hf-gutter` / `.hf-page-gutter` | 16 px | Vandret viewport-gutter |
| `--hf-space-inline` | 8 px | Tæt ikon/tekst |
| `--hf-space-control` | 12 px | Mellem beslægtede controls |
| `--hf-space-block` | 16 px | Mellem almindelige blokke |
| `--hf-space-section` | 32 px | Mellem selvstændige sektioner/kortgrupper |
| `--hf-space-hero` | 32 px | Hero-medie til næste typografiblok |
| `--hf-space-major` | 48 px | Kun store sceneskift, ikke standard paragraph-margin |

Sider må ikke selv sammensætte tilfældige `mt-*`, `mb-*`, `gap-*`-kæder for at
skabe vertikal rytme. Brug en navngiven stack eller komponentens interne gap.

### 5.2 Paddingkontrakt

Padding og afstand mellem søskendeblokke er to forskellige ting:

- **Padding** er luft inde i en skærm, et kort eller en control.
- **Gap/margin** er afstand mellem selvstændige blokke.
- En side må ikke kompensere for forkert intern padding med ekstra `mx-*`,
  `mt-*` eller `mb-*`.

De målte referencer giver følgende genbrugelige paddingroller:

| Token/klasse | Padding | Målt/anbefalet brug |
| --- | --- | --- |
| `--hf-padding-screen` / `.hf-inset-screen` | 16 px vandret | Standardgutter på auth, onboarding, Opdag, Indstillinger, grids og de fleste appskærme. Kildemål: x=48 ved 3×. |
| `--hf-padding-editorial` / `.hf-inset-editorial` | 32 px vandret | Kun editoriale hero-/featurelayouts som Kogebog-referencen, hvor indhold starter ved x=96 i 3×-filen. Må ikke blive ny standardgutter. |
| `--hf-padding-appbar` | 16 px vandret | Venstre/højre appbar-slots; vertikal placering styres af appbarhøjde og safe area. |
| `--hf-padding-card` | 16 px på alle sider | Almindelige tekst-, statistik-, promo- og formular-kort. |
| `--hf-padding-row-inline` | 16 px vandret | Standardrække i indstillinger, produktliste og accordion. |
| `--hf-padding-row-block` | centreret i 48 px række | Normalt ca. 14 px over/under et 20 px ikon. Brug fast rækkehøjde frem for `py-4`, som gør rækken 56 px. |
| `--hf-padding-field-inline` | 16 px vandret | Input og søgefelt. |
| `--hf-padding-field-block` | 12 px vertikalt i 48 px felt | 24 px line-height centreret i 48 px control. Højden er autoritativ. |
| `--hf-padding-button-inline` | mindst 16 px vandret | CTA-label og eventuelt ikon; vertikal padding afledes af 48/40 px knaphøjde. |
| `--hf-padding-compact` | 12 px vandret | Små dropdowns, chips og kompakte inline-controls. |
| `--hf-padding-modal` | 16 px | Modal-/sheet-indhold og modalheader. |
| `--hf-padding-actionbar` | 16 px top og vandret | Bund-actionbar; bundpadding er `max(16px, env(safe-area-inset-bottom))`. |
| `--hf-padding-bottom-nav` | 8 px top | Bundpadding kommer fra safe area; labels og ikoner må ikke skabe ekstra sidepadding. |
| `--hf-padding-image-contain` | 12 px | Kun produktbilleder med `object-contain`, når varen skal have luft fra billedrammen. Hero-/madbilleder har ingen intern padding og bruger crop. |

Specialmål, der ikke må bruges generelt:

- Landeoversigtens fuldbredde række har ca. 10 px fra viewport til flag og
  ca. 14 px fra flagets højre kant til landenavnet. Det tilhører
  `CountryRow`, ikke den generelle sidegutter.
- Indstillingsreferencen bekræfter 16 px kortgutter: kortet starter ved x=16,
  ikonets optiske venstrekant omkring x=35, og labelen ved x=68. Med et
  20 px ikon svarer det til ca. 16 px intern inset og 16 px ikon/label-gap.
- To-kolonne onboarding-grid bruger 16 px ydre gutter og 16 px mellem
  kolonnerne; hver kolonne er ca. 177 px bred ved 402 px viewport.
- Google-login har en separat ikonzone på ca. 47 px. Den er en intern del af
  `SocialLoginButton`, ikke almindelig knap-left-padding.

Bindende paddingregler:

1. `.hf-screen__content` ejer standardgutteren. Børn må ikke lægge endnu en
   16/20 px sidepadding ovenpå, medmindre de er en dokumenteret inset-variant.
2. `.hf-card` ejer sin interne padding. En side må ikke både bruge `p-4` på
   kortet og `px-4` på en generisk indre wrapper uden en dokumenteret grund.
3. Controls med fast højde centreres vertikalt. Der må ikke bruges `py-4` på
   et felt eller en knap og derefter accepteres den resulterende 54-57 px
   højde.
4. `p-5`/`px-5` = 20 px er ikke en standard i referencegrundlaget. Det bruges
   kun, hvis en konkret målt variant dokumenteres her.
5. `px-6` = 24 px er ikke en sidegutter. Det kan bruges internt i en bred CTA
   eller specialcontrol, men aldrig til at flytte hele skærmens alignment.
6. Safe-area-padding må kun tilføjes af appbar, actionbar eller bundnavigation.
   Sider må ikke hardcode ekstra top-/bundpadding for at simulere statusbar.
7. Når et ikon ser optisk forskudt ud, justeres ikonets viewbox/komponent — ikke
   hele rækkens padding på én enkelt side.

### 5.3 Radiusfamilie

| Token | Mål | Brug |
| --- | --- | --- |
| `--hf-radius-xs` | 4 px | Auth-felter og små kontroller fra ældre flows |
| `--hf-radius-sm` | 8 px | Indstillingskort, søgefelt, standardknap |
| `--hf-radius-md` | 12 px | Kategori-/målkort og større billedkort |
| `--hf-radius-fab` | 14 px | Hello Cal FAB, jf. eksisterende beslutning |
| `--hf-radius-round` | 9999 px | Kun cirkler, pills og ikonknapper, der faktisk er runde |

`rounded-xl`, `rounded-2xl` eller `rounded-full` må ikke sættes direkte i en
side for et standardkort, felt eller en standardknap. Det er netop den praksis,
som har skabt de nuværende forskelle.

## 6. Bindende komponentprimitiver

Navnene er kontrakten for en senere kodeimplementering. Eksisterende
komponenter kan udvides eller erstattes, men siderne skal ende med at bruge
disse roller frem for egne styles.

### 6.1 Skærm og appbar

**`.hf-screen` / `HfScreen`**

- Fylder altid den tilgængelige viewport: `height: 100%`, `min-height: 0`.
- Består af appbar, én scroll-container og fast bundnavigation/actionbar.
- Kort indhold og fejl-/loading-state må ikke trække bundnavigationen op.
- Kun `.hf-screen__scroll` må være den almindelige vertikale scroll-container.
- Indholdsgutter er 16 px.

**`.hf-appbar` / `ScreenHeader`**

- Variant `brand`: `#067A46`.
- Variant `main`: `#35784A`.
- Titel: `.hf-type-nav-title`, 20/24, hvid.
- Den synlige appbar-række er 52 px plus reel `env(safe-area-inset-top)`; der
  må ikke hardcodes `pt-9` som simuleret statusbar på alle platforme.
- Titel, venstre handling og højre handling ligger i tre faste slots, så titlen
  ikke flytter sig, når én side får et ikon.
- Hello Cal-reglen om profil venstre/luk højre har forrang på appskærme.

### 6.2 Knapper

**`.hf-button`** er obligatorisk baseklasse. En knap sammensættes af højst én
variant fra hver af disse tre akser:

1. **Udseende** (præcis én): `--primary`, `--brand`, `--secondary`, `--ghost`,
   `--danger`, `--danger-secondary` eller `--text`.
2. **Størrelse** (højst én): standard 48 px, `--compact` 40 px eller `--small`
   36 px. `--small` må kun bruges til lokale værktøjs-/filterhandlinger, aldrig
   til en hoved-CTA.
3. **Layout/form** (valgfri): `--full`, `--pill` eller `--icon`. `--pill` og
   `--icon` er indbyrdes eksklusive.

`--fab` er en komplet, produktbestemt undtagelse, som selv fastlægger
udseende, størrelse og form. Den kombineres kun med `.hf-button`, ikke med
andre modifiers.

De faste udseender er:

- `--primary`: `#232323`, hvid tekst; standard hoved-CTA i HelloFresh-flowet.
- `--brand`: `#067A46`, hvid tekst; kun en dokumenteret brand-/onboarding-CTA.
- `--secondary`: transparent/hvid overflade, 1 px `#232323` kant og `#242424`
  tekst.
- `--ghost`: ingen flade eller kant; bruges til diskrete selvstændige
  handlinger med normal hit area.
- `--text`: inline teksthandling med understregning; må ikke bruges som
  erstatning for en hoved- eller sekundær CTA. Farve er altid `#242424`
  (primær tekst) — der findes ikke en separat grå/dæmpet linkvariant, heller
  ikke til "gå tilbage"-lignende handlinger.
- `--danger`: Hello Cal-undtagelsens danger-token som flade med hvid tekst.
- `--danger-secondary`: transparent flade med danger-kant og danger-tekst.

De faste former er:

- Standard: højde 48 px, radius 8 px, 16 px horisontal padding og 17/24 bold
  tekst.
- `--compact`: højde 40 px, 12 px horisontal padding og 15/20 semibold tekst.
- `--small`: højde 36 px, 12 px horisontal padding og 13/18 semibold tekst.
- `--pill`: kun til filter-/modekontroller og altid sammen med `--compact` eller
  `--small`; aldrig som standard CTA.
- `--icon`: 44 × 44 px hit area, 24 × 24 px synligt ikon og ingen lokal
  padding. En mindre synlig ikonknap skal stadig bevare 44 × 44 px hit area.
- `--fab`: 56 × 56 px, radius 14 px, Hello Cal positive-flade og mørkt ikon;
  kun til den centrale tilføj-handling.
- `--full`: fylder den tilgængelige bredde. Ved 402 px viewport og standard
  16 px gutter bliver bredden 370 px.

Indhold og states er ligeledes låst:

- Ikoner bruger `.hf-button__icon`; ikon/label-gap er 8 px og må ikke ændres på
  siden.
- Label bruger `.hf-button__label`. Loading bruger `aria-busy="true"` og
  `.hf-button__spinner`; knappen beholder samme bredde og højde.
- Disabled styres med native `disabled` eller `aria-disabled="true"`, ikke en
  sideopfundet opacity-klasse. Geometrien ændres aldrig i disabled/loading.
- Mørk primary bruger kun de officielt målte webstates på en web-enhed:
  `#353535` ved hover og `#4B4B4B` ved active. Secondary bruger `#E3E3E3` og
  `#D2D2D2`. Mobile hvilestates forbliver uændrede.
- Ikonknapper skal have et `aria-label`. Links, der navigerer, skal fortsat
  renderes semantisk som links, men kan bruge samme klasser.
- En knaprække bruger `.hf-button-group`; sider må ikke skabe nye gaps og
  breddeforhold med lokale flex-/margin-klasser.

Primære CTA'er er 370 px brede ved 402 px viewport (16 px gutter på hver side).
Knaptekst må ikke falde til 12, 13, 14 eller 15 px, blot fordi knappen er på en
anden side.

Tilladte kombinationer:

| Formål | Klasser |
| --- | --- |
| Hoved-CTA | `.hf-button .hf-button--primary .hf-button--full` |
| Brand-CTA | `.hf-button .hf-button--brand .hf-button--full` |
| Sekundær CTA | `.hf-button .hf-button--secondary .hf-button--full` |
| Kompakt lokal handling | `.hf-button .hf-button--secondary .hf-button--compact` |
| Filter/mode | `.hf-button .hf-button--secondary .hf-button--small .hf-button--pill` |
| Diskret handling | `.hf-button .hf-button--ghost` |
| Inline teksthandling | `.hf-button .hf-button--text` |
| Bekræft destruktiv handling | `.hf-button .hf-button--danger` |
| Afvis/alternativ destruktiv | `.hf-button .hf-button--danger-secondary` |
| Ikonhandling | `.hf-button .hf-button--ghost .hf-button--icon` |
| Central tilføj-knap | `.hf-button .hf-button--fab` |

Social login er en separat primitive i afsnit 6.3. Bundnavigation, appbar-
slots, kalenderceller, valgkort og swipe-actions er heller ikke almindelige
`.hf-button`-varianter; de skal eje deres geometri i deres respektive
komponenter.

### 6.3 Social login

**`.hf-social-button` / `SocialLoginButton`**

- 370 × 48 px ved referenceviewport, radius 4-8 px efter den valgte authvariant.
- Google: `#4285F4` baggrund og separat hvid ikonzone som i referencen.
- Apple: `#232323` baggrund.
- Facebook: `#00178C` baggrund.
- Label: 17/24, 700 (bold, bekræftet mod `Log-in.png`: samme vægt som
  "Fortsæt"/"Næste"-knapperne), hvid og optisk centreret uafhængigt af
  ikonbredden.
- Providerikon, ikonzone og tekstplacering er komponentinternt; de må ikke
  bygges på ny på login-siden.

### 6.4 Felter

**`.hf-field` / `TextField`**

- Højde 48 px i standard/authvariant.
- Font 17/24; placeholder 16/24 `#C1C0BE`.
- Kant 1 px `#7D7561` i reference-authvarianten.
- Radius 4-8 px efter navngiven variant; ikke 12 eller 16 px som standard.
- Horisontal padding 16 px.
- Authvarianten er den officielle kompakte feltform: radius 4 px, 12 px intern
  padding, hover-kant `#615C50` og 2 px focus-kant `#4A463D`.
- Floating label 12/16, weight 400.
- Label, felt, hjælpetekst og fejltekst har faste interne gaps; siden må ikke
  styre dem med individuelle margins.

### 6.5 Søgefelt

**`.hf-search` / `SearchField`**

- Højde ca. 48 px, radius 8 px, ikke automatisk pill.
- 1 px kant i neutral/feltfarve, hvid eller sidefarvet baggrund efter målt
  variant.
- Søgeikon 24 × 24, stroke 2.25, 12 px afstand til tekst.
- Input følger `.hf-type-input`.

### 6.6 Kort og rækker

**`.hf-card`**

- Standard indstillings-/listekort: `#EEE9DF`, radius 8 px.
- Kategori-/målkort: `#EEE9DF`, radius 12 px.
- Standard kortgruppe-gap: 32 px.
- To-kolonne kategori-grid: 16 px gutter/gap; målkort ca. 177 × 82 px ved
  402 px viewport.

**`.hf-row`**

- Standardhøjde 48 px.
- Horisontal padding 16 px.
- Venstre ikon 20 × 20 eller 24 × 24 efter én navngiven variant.
- Ikon til label: 16 px optisk afstand.
- Label: 17/25 standard; mindre tekst kræver en eksplicit kompakt variant.
- Separator: 1 px `#AFADAA`/navngiven line-token.

### 6.7 Chevron og dropdown-pil

**`HfChevron`** er den eneste almindelige chevronkomponent:

- SVG, aldrig teksttegnene `›`, `>`, `⌄` eller en CSS-borderpil.
- `right`: 20 × 20 viewbox, stroke 2.5, round cap/join, `#232323`.
- `down`: samme ikon roteret 90 grader; åben/lukket tilstand må ikke skifte
  stroke, farve eller dimension.
- `compact`: 16 × 16, stroke 2.25, kun i små dropdowns.
- Ingen cirkel eller baggrund omkring en almindelig række-chevron.
- Terms/accordion-actionen fra checkout er en særskilt 32 × 32 cirkulær
  ikonknap; den må ikke forveksles med række-chevronen.

### 6.8 Favorit/bookmark

**`.hf-favorite-button` / `FavoriteButton`**

- Bookmark, ikke stjerne.
- 44 × 44 px rund mørk/translucent overlay-knap på billeder.
- 24 × 24 hvid outline-bookmark, ens stroke på alle kort.
- Standardplacering: 8 px fra top og højre billedkant.
- Samme komponent bruges i alle billedkort.

### 6.9 Hero-cirkel

**`.hf-hero-circle` / `WelcomeHeroMedia`**

- 180 × 180 px ved 402 px viewport.
- Centreret horisontalt.
- 32 px layoutafstand fra landevælger-blokken.
- 32 px layoutafstand til hero-overskriftsblokken.
- Hero-overskrift bruger 32/38; de to farvelinjer er én typografiblok.
- Standardafstand fra hero-overskrift til brødtekst er 24-32 px, ikke 48 px.

### 6.10 Fast actionbar og bundnavigation

**`.hf-actionbar`**

- Baggrund `#DFD9CC` eller den eksplicit valgte legacyvariant.
- Ca. 80 px høj i checkoutreferencen, 16 px padding og 12 px knapgap.
- Knapper 48 px høje; tilbageknap og primær handling bruger samme radius.
- Fast i bunden og påvirkes ikke af kort indhold.

**`.hf-bottom-nav` / `BottomNav`**

- Fast i bunden på alle aftalte appskærme.
- Baggrund `#DFD9CC`, 1 px topkant `#AFADAA`.
- Label 11-12/16.
- Aktiv farve `#232323`; inaktiv farve `#656565`.
- Ikonfamilie, størrelse og stroke defineres centralt; sider må ikke levere
  egne navikoner.
- Loading, fejl og tomme lister må ikke flytte, klippe eller skjule menuen.

### 6.11 Kamera-auto-genkendelse og produkt-oprettelse

Hello Cal-specifikke primitiver uden HelloFresh-reference (jf. §1), tilføjet
2026-09-02 til det guidede kamera-auto-flow (`/kamera/opret`) og opret-siden
(`/produkt/opret`):

**`NumberedBadge`** — 28 px cirkel-badge, `--hf-color-brand`-baggrund, hvid
`.hf-type-button`-tal, positioneret `-8px`/`-8px` så den overlapper det
øverste venstre hjørne af en 1:1-boks uden at dække dens indhold.

**`HfBarcodeIcon`** — SVG-stregkode (bjælker af varierende bredde) med et
mock-cifferlag under, brugt som placeholder-ikon og som prompt-illustration i
stregkode-trinnet. Farve arves via `currentColor`.

**`ScanningOverlay`** — gråtonet (`bg-black/55`) fuld-overlay med en 3 px
lodret hvid/gennemsigtig linje (`.hf-scan-line`, `globals.css`) der animerer
frem og tilbage over billedet, plus en statuslabel nederst. Vises mens et
billede analyseres automatisk (OCR/lokalt match/AI-fallback).

**Produkt-medie-grid (`CreateProductMediaGrid`)** — statisk 2×2-grid under
produkt-masterdata på opret-siden: 1 stregkode, 2 næringsindhold,
3 indholdsfortegnelse, 4 produktbilleder (selv underopdelt i 1 hovedbillede +
3 valgfrie sidebilleder). Hver boks er `--hf-color-card`, radius 12 px
(`--hf-radius-md`), med et `NumberedBadge` i hjørnet og viser enten sit
ikon/label eller brugerens (evt. auto-beskårne) foto.

**Banner-kort ved forgæves tilføj-forsøg** — vises kun når opret-siden nås
via `?fromFailedAdd=1`: et grønt kort (`--hf-color-brand`, hvid tekst) med
teksten "Produktet er endnu ikke registreret...", direkte efterfulgt af et
gult kort med grøn kant (`#FDF3D3` baggrund, `--hf-color-brand` kant, mørk
`--hf-color-text`) med "Opret produktet og optjen 10 points." Sidstnævnte er
rent visuelt — der findes intet pointsystem i datamodellen endnu.

## 7. Referenceproportioner, som skal bevares

### Velkomst/start

- Viewport-gutter: 16 px.
- Lille flag på startsiden: ca. 24 × 18 px.
- Hero-medie: ca. 180 × 180 px.
- Referencebilledets hero løber fra y=563 til y=1101 i 3×-filen.
- Første hero-tekstink starter omkring y=1226; cirkel-til-tekst-rytmen svarer
  til en 32 px layoutafstand med fontens indre luft.
- Primær knap: 370 × 48 px; 12 px mellem primær og sekundær knap.

### Login

- Gutter: 16 px.
- Stor landeflagvariant: ca. 35 × 26 px.
- Socialknapper: 370 × 48 px.
- Google `#4285F4`, Apple `#232323`, Facebook `#00178C`.
- Standard login-/inputtekst: 17 px.
- Primær footer-CTA kan bruge den målte 40 px compactvariant; den må ikke
  vokse tilfældigt til 54-57 px.

### Landeoversigt

- Flad, fuldbredde liste med ca. 56 px rækker og 1 px separator.
- Flag ca. 36 × 27 px.
- Landenavn 17/25, regular.
- Valgt land markeres med checkmark; typografi og baggrund ændres ikke.
- Ingen mellemrum mellem rækker og ingen individuelt afrundede landekort.

### Indstillinger

- Gutter: 16 px.
- Kortbredde: 370 px.
- Standardrække: 48 px.
- Kortradius: ca. 8 px.
- Mellem separate kortgrupper: 32 px.
- Kortfarve: `#EEE9DF`; side: `#FAF8F3`.
- Række-chevron er mørk, enkel og uden baggrund.

### Onboarding/checkout

- Progressområde er en fælles komponent, ikke sideindhold.
- Indholdsoverskrift 24/29; beskrivelse 17/25.
- Hero-billede går edge-to-edge, når referencevarianten gør det.
- To-kolonne valgkort: 16 px gap, ca. 177 px bredde og 82 px højde.
- Sticky actionbar og dens knapper følger afsnit 6.10.

## 8. Forbud mod side-specifik stilopfindelse

Når Claude eller en anden agent bygger en side, gælder følgende:

- Ingen nye pile/chevrons. Brug `HfChevron`.
- Ingen ny overskriftsstørrelse. Brug en `.hf-type-*`-rolle.
- Ingen ny knapgeometri. Brug `.hf-button` med navngiven variant.
- Ingen ny feltgeometri. Brug `TextField`/`.hf-field`.
- Ingen ny kort-radius eller kortfarve. Brug `.hf-card`-variant.
- Ingen direkte `text-[Npx]`, `rounded-*`, hex/rgb eller Tailwind-farvenavne i
  brugerrettede sider, når designprimitive findes.
- Ingen `mt-*`/`mb-*` til at reparere en genbrugelig komponents interne rytme.
  Ret komponenten eller dens navngivne variant centralt.
- Ingen native select-pil eller browser-spinner, men erstatningen skal være den
  fælles ikonkomponent — ikke endnu en håndtegnet pil.
- Ingen visuelt tomme billedfelter, hvis produktet har et billede. Billedkort
  bruger en fælles `ProductImage` med fast aspect ratio og `object-fit`-regel.
- En ny variation skal først dokumenteres her med navn, anvendelse og mål.

## 9. Foreslået CSS-blueprint — ikke implementeret

Dette afsnit er et konkret forslag til, hvordan kontrakten kan omsættes til
CSS. Det er **ikke** den nuværende kode og må ikke omtales som implementeret,
før CSS, komponenter og sider faktisk er migreret og visuelt verificeret.

Next.js-guiden for den installerede version anbefaler globale styles til reelt
globale regler, Tailwind til almindelig styling og CSS Modules til afgrænset
komponentstyling. Derfor er den foreslåede opdeling:

- Tokens, Tailwind theme-mapping, app-root og fælles primitives i
  `src/app/globals.css` eller CSS-filer importeret præcis én gang derfra.
- Komponentspecifikke animationer og state-regler i komponentens CSS Module,
  hvis de ikke er fælles.
- Ingen kopier af tokenværdier i CSS Modules eller JSX.
- Ingen `@apply`-kæder med side-specifikke Tailwindværdier. De semantiske
  klasser nedenfor skal have almindelige CSS-egenskaber og ét ansvar.

### 9.1 Foreslåede tokens og Tailwind-mapping

```css
:root {
  /* Målt HelloFresh-palette */
  --hf-color-page: #faf8f3;
  --hf-color-surface: #ffffff;
  --hf-color-card: #eee9df;
  --hf-color-nav: #dfd9cc;
  --hf-color-nav-legacy: #e0d9cb;
  --hf-color-brand: #067a46;
  --hf-color-appbar: #35784a;
  --hf-color-progress-dark: #035624;
  --hf-color-progress: #007838;
  --hf-color-text: #242424;
  --hf-color-action: #232323;
  --hf-color-action-hover: #353535;
  --hf-color-action-active: #4b4b4b;
  --hf-color-secondary-hover: #e3e3e3;
  --hf-color-secondary-active: #d2d2d2;
  --hf-color-text-secondary: #656565;
  --hf-color-inactive: #828282;
  --hf-color-placeholder: #c1c0be;
  --hf-color-disabled: #a6a29f;
  --hf-color-line: #afadaa;
  --hf-color-field-border: #7d7561;
  --hf-color-field-hover: #615c50;
  --hf-color-field-focus: #4a463d;
  --hf-color-white: #ffffff;
  --hf-color-google: #4285f4;
  --hf-color-facebook: #00178c;

  /* Bevidste Hello Cal-undtagelser */
  --hf-color-positive: #a3e635;
  --hf-color-danger: #a3271f;
  --hf-color-overlay: rgb(35 35 35 / 40%);

  /* Fontfamilier */
  --hf-font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display",
    "SF Pro Text", sans-serif;
  --hf-font-text: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;

  /* Afstand */
  --hf-space-1: 4px;
  --hf-space-2: 8px;
  --hf-space-3: 12px;
  --hf-space-4: 16px;
  --hf-space-6: 24px;
  --hf-space-8: 32px;
  --hf-space-10: 40px;
  --hf-space-12: 48px;

  /* Layout og controls */
  --hf-gutter: 16px;
  --hf-gutter-editorial: 32px;
  --hf-control-height: 48px;
  --hf-control-height-compact: 40px;
  --hf-row-height: 48px;
  --hf-appbar-row-height: 52px;

  /* Radius */
  --hf-radius-xs: 4px;
  --hf-radius-sm: 8px;
  --hf-radius-md: 12px;
  --hf-radius-fab: 14px;
  --hf-radius-round: 9999px;
}

@theme inline {
  --color-hf-page: var(--hf-color-page);
  --color-hf-surface: var(--hf-color-surface);
  --color-hf-card: var(--hf-color-card);
  --color-hf-nav: var(--hf-color-nav);
  --color-hf-brand: var(--hf-color-brand);
  --color-hf-appbar: var(--hf-color-appbar);
  --color-hf-text: var(--hf-color-text);
  --color-hf-action: var(--hf-color-action);
  --color-hf-secondary: var(--hf-color-text-secondary);
  --color-hf-inactive: var(--hf-color-inactive);
  --color-hf-line: var(--hf-color-line);
  --color-hf-positive: var(--hf-color-positive);
  --color-hf-danger: var(--hf-color-danger);
  --font-hf-display: var(--hf-font-display);
  --font-hf-text: var(--hf-font-text);
}
```

Under migration kan gamle tokennavne pege på de nye roller, men kun når
semantikken er den samme. `--hf-tan-dark` må eksempelvis ikke fortsætte som en
blanding af separator, footer og hoverfarve; de roller skal skilles ad.

### 9.2 Foreslået app-root og typografiklasser

```css
@layer base {
  .hf-app-root,
  .hf-app-root *,
  .hf-app-root *::before,
  .hf-app-root *::after {
    box-sizing: border-box;
  }

  .hf-app-root {
    min-height: 100%;
    background: var(--hf-color-page);
    color: var(--hf-color-text);
    font-family: var(--hf-font-text);
    font-size: 17px;
    line-height: 25px;
  }

  .hf-app-root button,
  .hf-app-root input,
  .hf-app-root select,
  .hf-app-root textarea {
    font: inherit;
    color: inherit;
  }
}

@layer components {
  .hf-type-hero {
    margin: 0;
    font-family: var(--hf-font-display);
    font-size: 32px;
    font-weight: 700;
    line-height: 38px;
  }

  .hf-type-page-title {
    margin: 0;
    font-family: var(--hf-font-display);
    font-size: 24px;
    font-weight: 700;
    line-height: 29px;
    text-align: center;
  }

  .hf-type-nav-title {
    margin: 0;
    font-family: var(--hf-font-display);
    font-size: 20px;
    font-weight: 700;
    line-height: 24px;
  }

  .hf-type-section-title {
    margin: 0;
    font-family: var(--hf-font-display);
    font-size: 20px;
    font-weight: 700;
    line-height: 24px;
    text-align: left;
  }

  .hf-type-category-title {
    margin: 0;
    color: #464646;
    font-family: var(--hf-font-display);
    font-size: 18px;
    font-weight: 700;
    line-height: 22px;
    text-align: center;
  }

  .hf-type-body-lg {
    margin: 0;
    font-family: var(--hf-font-text);
    font-size: 20px;
    font-weight: 400;
    line-height: 29px;
  }

  .hf-type-body {
    margin: 0;
    font-family: var(--hf-font-text);
    font-size: 17px;
    font-weight: 400;
    line-height: 25px;
  }

  .hf-type-body-sm {
    margin: 0;
    font-family: var(--hf-font-text);
    font-size: 15px;
    font-weight: 400;
    line-height: 22px;
  }

  .hf-type-caption {
    margin: 0;
    color: var(--hf-color-text-secondary);
    font-family: var(--hf-font-text);
    font-size: 13px;
    font-weight: 400;
    line-height: 18px;
  }

  .hf-type-progress-active {
    margin: 0;
    color: var(--hf-color-progress-dark);
    font-family: var(--hf-font-text);
    font-size: 13px;
    font-weight: 600;
    line-height: 18px;
  }

  .hf-type-progress-inactive {
    margin: 0;
    color: var(--hf-color-inactive);
    font-family: var(--hf-font-text);
    font-size: 13px;
    font-weight: 400;
    line-height: 18px;
  }
}
```

`.hf-app-root` skal placeres omkring den brugerrettede app, ikke ukritisk på
adminlayoutet. På den måde kan admin migreres separat uden at blokere
designsystemet.

### 9.3 Foreslået skærm, gutters, stacks og appbar

```css
@layer components {
  .hf-screen {
    display: flex;
    min-height: 0;
    height: 100%;
    flex: 1 1 auto;
    flex-direction: column;
    overflow: hidden;
    background: var(--hf-color-page);
  }

  .hf-screen__scroll {
    min-height: 0;
    flex: 1 1 auto;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .hf-inset-screen {
    padding-inline: var(--hf-gutter);
  }

  .hf-inset-editorial {
    padding-inline: var(--hf-gutter-editorial);
  }

  .hf-stack-page {
    display: flex;
    flex-direction: column;
    gap: var(--hf-space-4);
    padding: var(--hf-space-4) var(--hf-gutter);
  }

  .hf-stack-sections {
    display: flex;
    flex-direction: column;
    gap: var(--hf-space-8);
  }

  .hf-appbar {
    display: grid;
    min-height: calc(
      var(--hf-appbar-row-height) + env(safe-area-inset-top, 0px)
    );
    flex: 0 0 auto;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    align-items: center;
    padding: env(safe-area-inset-top, 0px) var(--hf-gutter) 0;
    color: var(--hf-color-white);
  }

  .hf-appbar--brand {
    background: var(--hf-color-brand);
  }

  .hf-appbar--main {
    background: var(--hf-color-appbar);
  }

  .hf-appbar__slot {
    display: flex;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
  }

  .hf-appbar__title {
    overflow: hidden;
    color: var(--hf-color-white);
    font-family: var(--hf-font-display);
    font-size: 20px;
    font-weight: 700;
    line-height: 24px;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
```

Hvis en Hello Cal-side kræver venstrejusteret titel, skal det være en navngiven
appbarvariant. Man må ikke opnå det ved at ændre grid, padding eller tomme
spacerbredder direkte i siden.

### 9.4 Foreslåede knapper og social login

```css
@layer components {
  .hf-button {
    position: relative;
    display: inline-flex;
    height: var(--hf-control-height);
    align-items: center;
    justify-content: center;
    gap: var(--hf-space-2);
    padding-inline: var(--hf-space-4);
    border: 0;
    border-radius: var(--hf-radius-sm);
    font-family: var(--hf-font-text);
    font-size: 17px;
    font-weight: 700;
    line-height: 24px;
    text-align: center;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  }

  /* Layoutmodifier: ændrer kun bredde. */
  .hf-button--full {
    width: 100%;
  }

  /* Udseendemodifiers: vælg præcis én pr. almindelig knap. */
  .hf-button--primary {
    background: var(--hf-color-action);
    color: var(--hf-color-white);
  }

  .hf-button--brand {
    background: var(--hf-color-brand);
    color: var(--hf-color-white);
  }

  .hf-button--secondary {
    border: 1px solid var(--hf-color-action);
    background: transparent;
    color: var(--hf-color-text);
  }

  .hf-button--ghost {
    background: transparent;
    color: var(--hf-color-text);
  }

  .hf-button--text {
    height: auto;
    min-height: 44px;
    padding-inline: 0;
    background: transparent;
    color: var(--hf-color-text);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .hf-button--danger {
    background: var(--hf-color-danger);
    color: var(--hf-color-white);
  }

  .hf-button--danger-secondary {
    border: 1px solid var(--hf-color-danger);
    background: transparent;
    color: var(--hf-color-danger);
  }

  @media (hover: hover) {
    .hf-button--primary:hover {
      background: var(--hf-color-action-hover);
    }

    .hf-button--secondary:hover {
      background: var(--hf-color-secondary-hover);
    }
  }

  .hf-button--primary:active {
    background: var(--hf-color-action-active);
  }

  .hf-button--secondary:active {
    background: var(--hf-color-secondary-active);
  }

  /* Størrelsesmodifiers: vælg højst én; standard er 48 px. */
  .hf-button--compact {
    height: var(--hf-control-height-compact);
    padding-inline: var(--hf-space-3);
    font-size: 15px;
    font-weight: 600;
    line-height: 20px;
  }

  .hf-button--small {
    height: 36px;
    padding-inline: var(--hf-space-3);
    font-size: 13px;
    font-weight: 600;
    line-height: 18px;
  }

  /* Formmodifiers: pill og icon må ikke kombineres indbyrdes. */
  .hf-button--pill {
    border-radius: var(--hf-radius-round);
  }

  .hf-button--icon {
    width: 44px;
    min-width: 44px;
    height: 44px;
    padding: 0;
  }

  /* Komplet produktrolle: må ikke kombineres med andre modifiers. */
  .hf-button--fab {
    width: 56px;
    min-width: 56px;
    height: 56px;
    padding: 0;
    border-radius: var(--hf-radius-fab);
    background: var(--hf-color-positive);
    color: var(--hf-color-action);
  }

  .hf-button__icon {
    width: 24px;
    height: 24px;
    flex: none;
  }

  .hf-button__label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hf-button__spinner {
    position: absolute;
    inset: 50% auto auto 50%;
    width: 20px;
    height: 20px;
    border: 2px solid currentcolor;
    border-right-color: transparent;
    border-radius: var(--hf-radius-round);
    transform: translate(-50%, -50%);
    animation: hf-button-spin 700ms linear infinite;
  }

  .hf-button[aria-busy="true"] {
    cursor: wait;
  }

  .hf-button[aria-busy="true"] .hf-button__label,
  .hf-button[aria-busy="true"] .hf-button__icon {
    visibility: hidden;
  }

  .hf-button--primary:disabled,
  .hf-button--primary[aria-disabled="true"],
  .hf-button--brand:disabled,
  .hf-button--brand[aria-disabled="true"],
  .hf-button--danger:disabled,
  .hf-button--danger[aria-disabled="true"],
  .hf-button--fab:disabled,
  .hf-button--fab[aria-disabled="true"] {
    background: var(--hf-color-disabled);
    color: var(--hf-color-white);
  }

  .hf-button--secondary:disabled,
  .hf-button--secondary[aria-disabled="true"],
  .hf-button--danger-secondary:disabled,
  .hf-button--danger-secondary[aria-disabled="true"] {
    border-color: var(--hf-color-disabled);
    background: transparent;
    color: var(--hf-color-disabled);
  }

  .hf-button--ghost:disabled,
  .hf-button--ghost[aria-disabled="true"],
  .hf-button--text:disabled,
  .hf-button--text[aria-disabled="true"] {
    color: var(--hf-color-disabled);
  }

  .hf-button:disabled,
  .hf-button[aria-disabled="true"] {
    cursor: not-allowed;
    pointer-events: none;
  }

  .hf-button:focus-visible,
  .hf-field:focus-visible,
  .hf-search:focus-within {
    outline: 2px solid var(--hf-color-action);
    outline-offset: 2px;
  }

  .hf-button-group {
    display: flex;
    gap: var(--hf-space-3);
  }

  .hf-button-group--stacked {
    flex-direction: column;
  }

  .hf-button-group--equal > .hf-button {
    flex: 1 1 0;
    min-width: 0;
  }

  .hf-social-button {
    display: grid;
    width: 100%;
    height: var(--hf-control-height);
    grid-template-columns: 47px minmax(0, 1fr) 47px;
    align-items: center;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: var(--hf-radius-sm);
    color: var(--hf-color-white);
    font-family: var(--hf-font-text);
    font-size: 17px;
    font-weight: 700;
    line-height: 24px;
  }

  .hf-social-button--google {
    background: var(--hf-color-google);
  }

  .hf-social-button--apple {
    background: var(--hf-color-action);
  }

  .hf-social-button--facebook {
    background: var(--hf-color-facebook);
  }

  .hf-social-button__icon {
    display: flex;
    width: 47px;
    height: 100%;
    align-items: center;
    justify-content: center;
  }

  .hf-social-button--google .hf-social-button__icon {
    background: var(--hf-color-white);
  }

  .hf-social-button__label {
    grid-column: 2;
    text-align: center;
  }
}

@keyframes hf-button-spin {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hf-button__spinner {
    animation-duration: 1400ms;
  }
}
```

Providerknappen bør stadig være en React-komponent, så ikonzone, label og
tilgængeligt navn ikke kan afvige mellem sider.

#### Obligatorisk brugsmønster

```tsx
<button
  type="button"
  className="hf-button hf-button--primary hf-button--full"
>
  <SaveIcon className="hf-button__icon" aria-hidden="true" />
  <span className="hf-button__label">Gem</span>
</button>
```

Claude må i anvendelsen ovenfor ikke tilføje `h-*`, `min-h-*`, `px-*`, `py-*`,
`rounded-*`, `text-*`, `font-*`, `gap-*`, `bg-*`, `border-*` eller lokale
disabled-/loading-farver. Hvis en legitim knap ikke kan beskrives med de
tilladte modifiers, skal den nye variant først dokumenteres og implementeres
centralt.

### 9.5 Foreslåede felter og søgefelt

```css
@layer components {
  .hf-field {
    width: 100%;
    height: var(--hf-control-height);
    padding: 12px var(--hf-space-4);
    border: 1px solid var(--hf-color-field-border);
    border-radius: var(--hf-radius-sm);
    background: var(--hf-color-surface);
    color: var(--hf-color-text);
    font-family: var(--hf-font-text);
    font-size: 17px;
    font-weight: 400;
    line-height: 24px;
  }

  .hf-field--auth {
    padding-inline: var(--hf-space-3);
    border-radius: var(--hf-radius-xs);
    background: var(--hf-color-page);
  }

  @media (hover: hover) {
    .hf-field--auth:hover:not(:focus) {
      border-color: var(--hf-color-field-hover);
    }
  }

  .hf-field--auth:focus {
    border-width: 2px;
    border-color: var(--hf-color-field-focus);
    outline: 0;
  }

  .hf-field::placeholder,
  .hf-search__input::placeholder {
    color: var(--hf-color-placeholder);
    opacity: 1;
  }

  .hf-field-label {
    display: block;
    margin: 0 0 var(--hf-space-1);
    color: var(--hf-color-text);
    font-family: var(--hf-font-text);
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
  }

  .hf-field-group {
    display: flex;
    flex-direction: column;
    gap: var(--hf-space-1);
  }

  .hf-form-stack {
    display: flex;
    flex-direction: column;
    gap: var(--hf-space-4);
  }

  .hf-search {
    display: flex;
    width: 100%;
    height: var(--hf-control-height);
    align-items: center;
    gap: var(--hf-space-3);
    padding-inline: var(--hf-space-4);
    border: 1px solid var(--hf-color-line);
    border-radius: var(--hf-radius-sm);
    background: var(--hf-color-surface);
  }

  .hf-search__icon {
    width: 24px;
    height: 24px;
    flex: 0 0 auto;
    color: var(--hf-color-action);
  }

  .hf-search__input {
    min-width: 0;
    height: 100%;
    flex: 1 1 auto;
    padding: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--hf-color-text);
    font-family: var(--hf-font-text);
    font-size: 17px;
    line-height: 24px;
  }
}
```

Fejl-, help- og success-tekst skal tilføjes som navngivne underkomponenter;
de må ikke styles med `text-red-600` eller en tilfældig opacity på siden.

### 9.6 Foreslåede kort, grids, rækker og chevrons

```css
@layer components {
  .hf-card {
    background: var(--hf-color-card);
    color: var(--hf-color-text);
  }

  .hf-card--settings,
  .hf-card--standard {
    padding: var(--hf-space-4);
    border-radius: var(--hf-radius-sm);
  }

  .hf-card--choice {
    display: flex;
    min-height: 82px;
    align-items: center;
    padding: var(--hf-space-4);
    border-radius: var(--hf-radius-md);
    font-family: var(--hf-font-display);
    font-size: 18px;
    font-weight: 700;
    line-height: 22px;
  }

  .hf-card--choice[aria-pressed="true"] {
    box-shadow: inset 0 0 0 2px var(--hf-color-action);
  }

  .hf-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--hf-space-4);
  }

  .hf-row {
    display: flex;
    width: 100%;
    height: var(--hf-row-height);
    align-items: center;
    gap: var(--hf-space-4);
    padding-inline: var(--hf-space-4);
    border: 0;
    background: transparent;
    color: var(--hf-color-text);
    text-align: left;
  }

  .hf-row + .hf-row {
    border-top: 1px solid var(--hf-color-line);
  }

  .hf-row__icon {
    display: flex;
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
  }

  .hf-row__label {
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
    font-family: var(--hf-font-text);
    font-size: 17px;
    font-weight: 400;
    line-height: 25px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hf-chevron {
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
    color: var(--hf-color-action);
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2.5;
  }

  .hf-chevron--down {
    transform: rotate(90deg);
  }

  .hf-chevron--up {
    transform: rotate(-90deg);
  }

  .hf-chevron--compact {
    width: 16px;
    height: 16px;
    stroke-width: 2.25;
  }
}
```

CSS kan standardisere SVG'ens størrelse og stroke, men selve pathen skal også
komme fra én `HfChevron`-komponent. CSS-koden gør ikke teksttegnet `›`
acceptabelt.

### 9.7 Foreslået hero, billeder og favorit

```css
@layer components {
  .hf-hero-circle {
    width: 180px;
    height: 180px;
    margin-inline: auto;
    overflow: hidden;
    border-radius: var(--hf-radius-round);
  }

  .hf-hero-circle + .hf-hero-copy {
    margin-top: var(--hf-space-8);
  }

  .hf-product-image {
    display: block;
    width: 100%;
    height: 100%;
    padding: var(--hf-space-3);
    object-fit: contain;
    object-position: center;
  }

  .hf-food-image {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    object-fit: cover;
    object-position: center;
  }

  .hf-favorite-button {
    position: absolute;
    top: var(--hf-space-2);
    right: var(--hf-space-2);
    display: flex;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: var(--hf-radius-round);
    background: rgb(35 35 35 / 72%);
    color: var(--hf-color-white);
  }

  .hf-favorite-button > svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
  }
}
```

### 9.8 Foreslået actionbar og bundnavigation

```css
@layer components {
  .hf-actionbar {
    display: flex;
    flex: 0 0 auto;
    gap: var(--hf-space-3);
    padding: var(--hf-space-4) var(--hf-gutter)
      max(var(--hf-space-4), env(safe-area-inset-bottom, 0px));
    border-top: 1px solid var(--hf-color-line);
    background: var(--hf-color-nav);
  }

  .hf-bottom-nav {
    display: grid;
    min-height: calc(59px + env(safe-area-inset-bottom, 0px));
    flex: 0 0 auto;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    padding: var(--hf-space-2) 0 env(safe-area-inset-bottom, 0px);
    border-top: 1px solid var(--hf-color-line);
    background: var(--hf-color-nav);
  }

  .hf-bottom-nav__item {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: var(--hf-space-1);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--hf-color-text-secondary);
  }

  .hf-bottom-nav__item[aria-current="page"] {
    color: var(--hf-color-action);
  }

  .hf-bottom-nav__icon {
    width: 24px;
    height: 24px;
    flex: 0 0 auto;
  }

  .hf-bottom-nav__label {
    overflow: hidden;
    max-width: 100%;
    font-family: var(--hf-font-text);
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
```

Dette løser ikke alene BottomNav-komponentens drag/reorder-state. Den adfærd
skal bevares, men normaltilstanden, empty-state og error-state skal ende med de
samme fire grid-slots og den samme højde.

### 9.9 Midlertidige legacy-aliaser

For at undgå en risikabel totalomskrivning kan de eksisterende variabler pege
på korrekte nye tokens i en kort migrationsperiode:

```css
:root {
  --hf-green: var(--hf-color-brand);
  --hf-cream: var(--hf-color-page);
  --hf-tan: var(--hf-color-card);
  --hf-black: var(--hf-color-action);
  --hf-white: var(--hf-color-white);
  --hf-gray-dark: var(--hf-color-text-secondary);
  --hf-gray: var(--hf-color-inactive);
  --hf-gray-border: var(--hf-color-line);
}
```

Disse aliaser er kun en overgang. De kan ikke udtrykke forskellen mellem
brand-header og appbar eller mellem card, nav og separator. Komponenterne skal
derfor migreres til de nye semantiske navne, før aliaserne fjernes.

### 9.10 Claude-migrationsregler

Claude skal migrere efter komponenttype, ikke med global søg/erstat på alle
Tailwindklasser:

| Nuværende mønster | Foreslået mål |
| --- | --- |
| `px-5` på auth-/velkomstside | `.hf-inset-screen` |
| `rounded-xl bg-hf-black py-4 text-[15px]` | `.hf-button .hf-button--primary` |
| `rounded-xl border ... px-4 py-3.5 text-[15px]` | `.hf-field` i `TextField` |
| `rounded-2xl bg-hf-tan p-4` | Relevant `.hf-card`-variant |
| `gap-3 px-4 py-4` på indstillingsrække | `.hf-row` |
| Teksttegnet `›` | `<HfChevron direction="right" />` |
| `text-[15px] font-medium` som standardlabel | `.hf-type-body` eller `.hf-row__label` |
| `red-500`/`red-600`/`red-700` | Semantisk danger-token/komponent |
| `pt-9` som statusbar | Appbar med `env(safe-area-inset-top)` |
| Sideplaceret `BottomNav` efter kort indhold | `.hf-screen` med fast nav-slot |

Rækkefølge for CSS-implementeringen:

1. Indfør tokens og `.hf-app-root` uden at slette legacyvariabler.
2. Implementér app-shell, appbar og bundnav; verificér alle fire content-states.
3. Implementér knap, felt, søgning, kort, række og `HfChevron`.
4. Migrér én skærmfamilie ad gangen og genindlæs den eksisterende appvisning.
5. Fjern først en legacyklasse/-variabel, når søgning viser nul brugerrettede
   forekomster, eller de resterende forekomster er dokumenterede undtagelser.
6. Kør lint og build efter kodeændringer; sammenlign derefter en frisk visning
   med 402 × 874-referencen.

## 10. Nuværende audit — konkrete afvigelser

Auditten er udført mod koden og en frisk lokal visning ved 402 × 874 px den
2026-08-30. Databaseafhængige sider viste enkelte loading-/fejltilstande; de er
markeret som sådan. Ingen appkode er ændret som del af auditten.

### Kritiske systemafvigelser

| ID | Placering | Nuværende afvigelse | Mål / foreslået fælles løsning |
| --- | --- | --- | --- |
| DES-001 | `src/app/globals.css:4-29` | Kernepaletten bruger bl.a. `#F0F0EE`, `#17794A`, `#F3EFE2`, `#EAE3D1` og `#1A1A17`. Ingen af dem er 1:1 med de tilsvarende målte flader. | Erstat rollerne med paletten i afsnit 3; behold kun dokumenterede Hello Cal-undtagelser. |
| DES-002 | `src/app/layout.tsx:2-29` | Hele body bruger Geist via `font-sans`. Kun elementer med `.hf-heading`/`.hf-*` får systemfont. Live computed style på login viste Geist på normal tekst, labels, knapper og inputs. | Gør SF Pro-stack til standard for brugerappen eller brug en fælles `.hf-app`-root. |
| DES-003 | Hele `src/` | Der findes mindst 9 direkte pixel-fontstørrelser: 48× `15px`, 34× `13px`, 23× `12px`, 17× `14px`, 12× `11px`, 10× `10px`, 3× `16px`, 3× `17px`, 2× `30px`, 1× `20px`. | Erstat med de navngivne typografiroller i afsnit 4. |
| DES-004 | Hele `src/` | Radius er spredt på mindst 64× `rounded-2xl`, 39× `rounded-xl`, 37× `rounded-md`, 22× `rounded-lg` og 56× `rounded-full`. | Lås standardelementer til radiusfamilien 4/8/12/14/full via komponentvarianter. |
| DES-005 | `src/app/globals.css:100-126` og knapbrug på sider | `.hf-btn-primary`/secondary bestemmer ikke højde, padding eller tekststørrelse og bruger altid pill-radius. Sider leverer derfor egne 12/13/14/15 px labels og forskellige højder. | Én `.hf-button` med primary/secondary/compact/pill/icon-varianter og faste mål. |
| DES-006 | `src/components/HfScreen.tsx:16-24` | Skærmshellen ser korrekt ud i længere sider, men live viste bundnav oppe ved y≈303 på `/soeg`, y≈153 på `/profil` og helt uden for viewporten på `/kamera?mode=produkt`. | Gør `.hf-screen` til en verificeret viewport-shell; nav/actionbar skal være fast for loading, error, empty og long-content. |
| DES-007 | `src/components/hf/ScreenHeader.tsx:14-40` | Fælles header er 84 px i livevisningen, bruger `pt-9`, `#17794A`, venstrejusteret titel/ikon og avatar til højre. Det konflikter både med de målte headerfarver og Hello Cal-reglen om profil venstre/luk højre. | Slotbaseret `.hf-appbar`, safe-area-token og brand/main-varianter. |
| DES-033 | `velkommen`, `logind`, `tilmeld`, `logind/land` samt gentagne `p-5`/`px-5` | Auth-/velkomstsiderne bruger 20 px viewport-padding (`px-5`), mens den målte standardgutter er 16 px. Andre skærme bruger 16 px, så venstre tekstlinje og kontrolbredde skifter mellem routes. `py-4` gør samtidig rækker, felter og knapper højere end referencekontrollerne. | `.hf-inset-screen` 16 px, `.hf-inset-editorial` 32 px kun til målte featurelayouts samt de faste card/row/field/button-paddingroller i afsnit 5.2. |

### Komponentafvigelser

| ID | Placering | Nuværende afvigelse | Mål / foreslået fælles løsning |
| --- | --- | --- | --- |
| DES-008 | `src/components/hf/AccordionCard.tsx:4-5` | Standardkort bruger `rounded-2xl` = 16 px og nuværende tanfarve. Reference-Indstillinger er ca. 8 px og `#EEE9DF`. | `.hf-card--settings`, radius 8, eksakt card-token. |
| DES-009 | `src/components/hf/AccordionCard.tsx:24-32` | Række er 56 px (`py-4`), label 15 px medium, og chevron er teksttegnet `›`. Reference er ca. 48 px, 17 px regular og ens SVG-chevron. | `.hf-row` + `HfChevron`. |
| DES-010 | `src/app/globals.css:145-163` | `.hf-search` er en fuld pill med den forkerte border-/baggrundspalette og 15 px input. | `SearchField`: 48 px høj, radius 8, 17 px input og fælles søgeikon. |
| DES-011 | `src/app/globals.css:128-143` | `.hf-chip` har 17,6 px radius og egne paddings. Mål-/kategorikortene i referencen er ca. 12 px radius og følger 16 px grid. | `.hf-card--choice` med fast grid, mål og selected-state. |
| DES-012 | `src/components/BottomNav.tsx:18-20` og nav-markup | Aktive/inaktive/borderfarverne er faktisk tæt på de målte værdier, men baggrunden kommer fra den forkerte `--hf-tan`; geometri og synlighed varierer pr. route. | Behold de korrekte navfarver, flyt dem til tokens, og brug `.hf-bottom-nav` med `#DFD9CC`. |
| DES-013 | Chevronbrug i `src/app/kalender/page.tsx`, `src/app/profil/*`, `DailyList`, `StatChart`, `StatPeriodPicker` m.fl. | Chevronstørrelserne spænder mindst over 14, 15, 16, 18, 19, 20, 24 og 26 px; strokes er både default, 2.5 og 3.5. | Tre tilladte ikonvarianter: right 20/2.5, down via rotation, compact 16/2.25; back er en separat nav-ikonrolle. |
| DES-014 | `src/app/settings/integrationer/page.tsx`, `src/app/stemme/page.tsx`, `DailyList.tsx`, `SwipeableRow.tsx` | Direkte `red-500`, `red-600`, `red-700`, `text-white` og `bg-black/40` omgår designpaletten. | Navngivne success/warning/danger/overlay-tokens; ingen frameworkfarver i produktsider. |

### Skærmspecifikke afvigelser

| ID | Skærm / placering | Hvad matcher ikke | Fælles løsning |
| --- | --- | --- | --- |
| DES-015 | Velkomst, `src/app/velkommen/page.tsx:27-63` | Live: gutter 20 px mod 16; cirkel 176 mod ca. 180; hero 30/31.5 mod 32/38; body 15/24 mod 20/29; 48 px heading→body-gap er for stort; CTA'er ca. 55-57 px høje, 12 px radius og 362 px brede mod 48 px, ca. 8 px og 370 px. Farver er også forkerte. | `WelcomeHeroMedia`, `.hf-type-hero`, `.hf-type-body-lg`, `.hf-button` og 16 px gutter. |
| DES-016 | Velkomstens cirkelafstand | Live cirkelboks sluttede ved y≈355 og overskriftsboks startede y≈387: 32 px layout-gap. Det er tæt på den målte reference og skal bevares som navngiven regel, ikke genmåles pr. ændring. Den samlede blok ligger dog højere pga. header/gutter/størrelse. | Lås `WelcomeHeroMedia` til 180 px og `gap-after: 32px`; justér kun via komponenten. |
| DES-017 | Login, `src/app/logind/page.tsx:7-62` | Live knapper/felt er 362 px brede, ca. 55-57 px høje, radius 12 og 15 px Geist. Reference: 370 × 48, 4-8 px radius, 17 px SF Pro. | Fælles auth-shell, `.hf-field`, `.hf-social-button`, `.hf-button`. |
| DES-018 | Google login, `src/app/logind/page.tsx:35-38` | Nuværende Googleknap er hvid med tynd kant og løst ikon. Reference er `#4285F4` med separat hvid ikonzone. | `SocialLoginButton provider="google"`. |
| DES-019 | Apple login, `src/app/logind/page.tsx:40-43` | Nuværende baggrund er `#242424`; reference-action er `#232323`. Tekst og geometri er også for små/store. | `SocialLoginButton provider="apple"`. |
| DES-020 | Login-land, `src/app/logind/page.tsx:22-32` | Label 15 px, land 16 px, flag 22 × 16 og tekst-chevron. Reference: 17 px, stor flagvariant ca. 35 × 26 og fælles chevron. | `CountryPickerRow size="large"`. |
| DES-021 | Landeoversigt, `src/app/logind/land/page.tsx:34-65` | Nuværende liste har 20 px sidegutter, 10 px mellemrum, afrundede individuelle rækker og selected tan-baggrund. Referencen er flad, fuldbredde, ca. 56 px pr. række, separator, 36 × 27 flag og uændret baggrund. | `CountryList` + `CountryRow`; selected vises kun med checkmark. |
| DES-022 | Tilmeld, `src/app/tilmeld/page.tsx:53-91` | Felter er 52,5 px, radius 12, 15 px tekst; labels 14 px/600. Det følger hverken authfeltets 17 px tekst/faste geometri eller floating-label-rollen. | `AuthForm`, `TextField` og fælles sticky CTA. |
| DES-023 | Indstillinger, `src/app/settings/page.tsx` | Live: 16 px radius mod ca. 8, 16 px gruppemellemrum mod 32, 56 px rækker mod 48, 15 px labels mod 17 og tekst-chevron. Side/card/appbarfarver er alle forkerte. | `.hf-settings-stack`, `.hf-card--settings`, `.hf-row`, `HfChevron`. |
| DES-024 | Madvarer, `src/app/madvarer/page.tsx:135-197` | 16 px kort-radius bruges på hero/resultatblok; search er pill; listetekst 15 px; den nuværende tan er forkert. | Hero/list/search-varianter af fælles kort-, række- og feltprimitiver. |
| DES-025 | Søg, `src/app/soeg/page.tsx:108-153` | Samme afvigelser som Madvarer. Desuden stod bundnav ved y≈303 i frisk loading-state i stedet for viewportbunden. | Brug de samme primitives og reparér shellen centralt, ikke siden. |
| DES-026 | Profil, frisk fejlstate | Bundnav stod ved y≈153 umiddelbart efter fejlteksten. Det viser, at empty/error-layout ikke reserverer viewportens resterende højde. | Fælles `.hf-screen__scroll { flex: 1 1 auto; min-height: 0 }` og nav som `flex: none`. |
| DES-027 | Kalender, frisk månedsvisning | Den lokale 402 × 874-visning viste kun de to sidste navpunkter nederst, mens de fire var synlige på andre routes. Dette er en konkret route-/state-inkonsistens, ikke en HelloFresh-afvigelse. | `BottomNav` skal have én verificeret fire-slot-layouttilstand på alle routes. |
| DES-028 | Kamera, `src/app/kamera/page.tsx:270-430` | Ved 402 × 874 fyldte indholdet viewporten, mens bundnav ikke var synligt trods DOM-navigation. Kort og kamera-preview bruger generelt 16 px radius. | Shellens scroll/nav-kontrakt samt navngivet `CameraHero`-radiusvariant. |
| DES-029 | Stemme, `src/app/stemme/page.tsx:767-833` | Appbarens titel er tom i idle-state, så der vises en grøn bjælke med kun avatar. Komponenter bruger mange lokale radius-, tekst- og røde standardfarver. | Giv headeren en varig titelvariant og brug `VoiceInput`, `TranscriptField`, `ExpandableFoodRow` og semantiske statusfarver. |
| DES-030 | Statistik, `src/app/statistik/page.tsx`, `StatCardsGrid.tsx` | Kort bruger 16 px radius og forkert tan; labels varierer mellem 11, 12, 13, 15 og frameworkstørrelser. | `StatCard` bygget på `.hf-card`, `.hf-type-caption` og `.hf-type-section-title`. |
| DES-031 | Energifordeling på `tilfoej`, `stemme`, `registrering` | Samme sektionsnavn renderes som 15 px flere steder, mens referencehierarkiet har en 20 px section-title. | Én `MacroSection` med fælles heading, gap og `MacroSliderBar`. |
| DES-032 | Avatar/headerplacering på HfScreen-sider | Live Madvarer/Statistik viste avatar til højre. `docs/UI.md` reserverer højre side til luk og placerer profil venstre på appskærme. | Headerens slots skal følge produktreglen, også når HelloFresh-referenceheaderen er centreret. |

## 11. Prioriteret senere implementeringsrækkefølge

Dette er ikke udført i denne audit, men rækkefølgen reducerer omarbejde:

1. Ret tokens og appens font-root.
2. Implementér `.hf-screen`/appbar/bundnav og verificér loading, error, empty og
   long-content ved 402 × 874.
3. Implementér `HfChevron`, knap-, felt-, søge-, kort- og rækkeprimitiver.
4. Migrér auth/velkomst/landeliste, fordi de har de tydeligste 1:1-referencer.
5. Migrér Indstillinger, Madvarer og Søg.
6. Migrér Statistik, Kalender, Stemme, Kamera og øvrige specialskærme uden at
   ændre deres aftalte adfærd.

## 12. Obligatorisk kontrol for hver fremtidig UI-ændring

Før en ændring:

- Find den eksisterende primitive i denne fil.
- Hvis den ikke findes, dokumentér én ny central variant før siden styles.
- Tjek `docs/DECISIONS.md`, `docs/SPECIFICATION.md` og `docs/UI.md` for
  produktundtagelser.

Efter en ændring:

- Genindlæs den eksisterende appvisning i samme vindue og samme størrelse.
- Kontroller ved 402 × 874 og mindst én smallere mobilbredde.
- Kontroller normal, loading, error, empty, disabled, selected og expanded state,
  når de findes.
- Mål computed font, line-height, farve, højde, radius, gutter og block-gap.
- Sammenlign med den relevante reference og denne fil.
- Bekræft at bundnav/actionbar stadig er fast.
- Kør `npm run lint` og før checkpoint også `npm run build`.

En ændring er ikke visuelt verificeret, hvis agenten kun har læst JSX/CSS,
set en separat mock eller kigget på en ikke-genindlæst side.
