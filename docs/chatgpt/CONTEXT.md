# HELLO CAL — startpakke til ChatGPT

Oprettet 2026-09-13 fra det lokale checkout med HEAD `fb563a2` og eksisterende ikke-committede ændringer. Dette er et navigationskort og en arbejdsvejledning, ikke en ny produktspecifikation eller en påstand om, hvad GitHub/produktion indeholder. Filstier er relative til repositoryets rod.

## Opsætning i ChatGPT-projektet

1. Kopiér teksten fra `docs/chatgpt/PROJECT-INSTRUCTIONS.md` ind i projektets instruktioner.
2. Tilføj denne fil (`CONTEXT.md`) og `docs/chatgpt/HANDOFF-TEMPLATE.md` som projektfiler. De kan uploades nu, også før commit/push.
3. Giv GitHub-forbindelsen adgang til `Vandmollevej/hellocalvs2`. Bed chatten hente de aktuelle kilder til den konkrete opgave. Forbindelsen alene er ikke dokumentation for, at de er læst.
4. Indtil de nye vejledninger er pushet, findes de kun lokalt eller som dine uploads. Hvis GitHub-versionen mangler en nødvendig lokal ændring, vedhæft netop den relevante fil eller lad Codex udforme et aktuelt grundlag.
5. Uden GitHub-adgang: upload også `design.md`, `docs/SPECIFICATION.md`, `docs/DECISIONS.md`, `docs/UI.md` og `docs/STATUS.md`, plus de kildefiler opgaven bruger. Upload kun udvalgte filer; arkivér ikke hele projektmappen til chatten.

En egnet første besked er:

> Læs den vedhæftede CONTEXT.md og hent de relevante projektkilder fra Vandmollevej/hellocalvs2. Fortæl kort hvad du har kunnet læse, og om noget nødvendigt mangler. Løs derefter denne opgave: [opgave]. Følg det eksisterende design og aflever efter HANDOFF-TEMPLATE.md med præcise målfilstier. Resultatet skal kunne integreres lokalt af Codex og afvente commit.

## Produktet og de vigtigste begreber

HELLO CAL er en mobil PWA til kalorie- og måltidsregistrering. V1 retter sig mod telefoner i portræt. Den særlige forside med drejehjul/FAB, madvarer, kalender og statistik er centrale flows. Profil, indstillinger, opskrifter, kropsmål, fotodagbog, grupper og administration har egne områder. Funktionsønsker i specifikationen er ikke alle færdigbyggede.

| Begreb | Betydning for opgaver |
| --- | --- |
| Produkt | En fødevare/ret i kataloget, med næringsgrundlag og evt. stregkode, billeder og kilde. |
| Registrering | Brugerens konkrete indtag på et tidspunkt. Indeholder snapshots; produktændringer må ikke omskrive historiske næringsværdier. |
| Egen ret | Et separat sammensætningsflow. Genbrug eksisterende ingrediens- og mængdelogik. |
| Målvægt | Ønsket vægt; adskilt fra målt vægt og kropsmål i cm. |
| UI-sprog / region | Forskellige valg. UI-tekster findes aktuelt på da/en; region bruges bl.a. til stregkode- og OCR-/talesprog. |
| AI-resultat | Et forslag/estimat med den eksisterende godkendelseslogik, ikke ret til at ændre gemt historik. |
| Offline | Enkelte flows har særskilt kø/synkronisering. Det betyder ikke, at hele appen kan fungere offline. |

Grundregler: database som sandhed; genbrug af eksisterende flows; automatisk lagring frem for en generel Gem-knap; ingen opdigtede helbredsdata, popularitetstal eller aktive integrationer. Følg dokumenterede undtagelser for den enkelte skærm. Krav om tema, tilgængelighed og Dynamic Type skal kontrolleres i den faktiske implementering, ikke antages opfyldt.

## Hvor findes den autoritative viden?

| Kilde | Læs den for |
| --- | --- |
| `AGENTS.md` | Arbejdsregler, Next.js-guide, lint/build og hensyn til eksisterende ændringer. |
| `docs/STATUS.md` | Daterede leverancer, begrænsninger, igangværende arbejde og næste opgaver. |
| `docs/DECISIONS.md` | Varige beslutninger og senere ændringer af tidligere krav. |
| `docs/SPECIFICATION.md` | Samlet produktkontrakt. |
| `docs/UI.md` | Navigation, gestures, skærmregler og produktadfærd. |
| `design.md` | Bindende visuel kontrakt i roden — ikke `docs/design.md`. |
| `docs/DESIGN_V2.md`, `docs/UI-KRAVSPEC-2026-08-27.md` | Supplerende kravlister; deres gamle "ikke implementeret"-mærkater kræver kontrol mod nyere status/kode. |
| `docs/DATABASE.md`, `prisma/schema.prisma` | Dataprincipper henholdsvis aktuel model. Migrationer ligger i `prisma/migrations/`. |
| `docs/AI.md` | Kamera, OCR, scanning, analyse og godkendelse. |
| `docs/ADMIN.md` | Administration, godkendelser og fejlrapporter. |
| `docs/BACKEND.md` | Backendprincipper og API-/synkroniseringskrav. |
| `docs/DEPLOYMENT.md` | Drift og environments; læses før ændringer af Docker, CI, Synology eller netværk. |
| `docs/HEALTHKIT_COMPANION.md` | Planen for en separat native integration; ikke bevis for en færdig companion-app. |
| `Fejlretninger/FEJLLISTE.md` | Konkrete fejl og referencekontekst. Kontroller om fejlen allerede er rettet. |

Konflikter løses efter `design.md` §1: brugerens aktuelle instruktion og varige produktbeslutninger, derefter UI-produktregler, visuel kontrakt, supplerende designliste og til sidst eksisterende kode som implementeringsevidens. Senere udtrykkelige beslutninger kan overhale ældre tekst. Denne startpakke overtrumfer ingen af de oprindelige kilder.

**Kendt dokumentationsfælde:** `docs/STATUS.md` er en lang historik. Både "Current checkpoint" og "Next work" indeholder ældre påstande, mens nyere daterede poster beskriver færdige løsninger. Eksempelvis er kropsmål dokumenteret som bygget 12. september. Den gamle rod-README er en Next.js-startskabelon og henviser til `app/page.tsx`; den aktuelle app ligger i `src/app`. Brug det verificerede kort nedenfor og aktuelle filer.

## Design, som nye sider skal følge

Læs `design.md` §3–6 for farver, tekstroller, afstande, radius og komponenter; §8 for forbud mod vilkårlig sidestyling; §12 for visuel kontrol. §9 er et **foreslået CSS-blueprint**, ikke en garanti for eksisterende klasser. Slå hver valgt klasse/token op i `src/app/globals.css`, og læs komponentens faktiske props, før den bruges.

- HelloFresh er visuel reference; Hello Cals særlige navigation og produktflows bevares.
- Originale billeder findes i `Hello Fresh inspiration/`. Referenceviewport er 402 × 874 CSS-pixels (1206 × 2622 originalbilleder ved 3×). Ved billedbaseret arbejde skal chatten faktisk have adgang til det relevante billede.
- Standard vandret gutter er 16 px. 32 px er en navngivet editorial-variant. Afstandsskala: 4, 8, 12, 16, 24, 32, 40, 48 px.
- Brug navngivne farver/typografiske roller. Brandgrøn og appbargrøn er forskellige kontekster, ikke frit udskiftelige nuancer.
- Genbrug padding fra skærm/kort/controls, så indholdet ikke får dobbelt gutter. Safe area håndteres af de relevante fælles containere.
- Generel font er SF Pro/systemfont jf. kontrakten; en importeret font i layoutet er ikke en ny designbeslutning.
- Favorit er bookmark. Ikoner og tilbage-/lukplacering følger de aktuelle komponenter og produktbeslutninger.
- Nye centraliserede varianter dokumenteres i `design.md`; genbrug ikke en sidebestemt undtagelse som ny standard.

| Eksisterende kilde | Anvendelse / vigtig detalje |
| --- | --- |
| `src/components/HfScreen.tsx` | Standard wrapper med header, scrollindhold, valgfri footer og allerede indbygget BottomNav. Props: title, icon, children, onBack, footer, titleClassName. Tilføj ikke endnu en bundmenu. |
| `src/components/hf/ScreenHeader.tsx` | Fælles appbar; læs aktuelle slots og varianter. |
| `src/components/hf/AccordionCard.tsx` | Eksporterer AccordionCard og ChevronRow; rækker kan have href eller onClick. |
| `src/components/hf/TextField.tsx` | Felt med label og variant auth/standard. |
| `src/components/hf/HfChevron.tsx` | Fælles chevron. |
| `src/components/hf/CalorieBadge.tsx` | Eksisterende kcal-badge til opskrifter. |
| `src/components/hf/NotchedTextField.tsx` | Særlig feltvariant; brug kun i dokumenteret kontekst. |
| `src/components/BottomNav.tsx`, `src/components/PhoneFrame.tsx` | Global navigation og desktop-præsentationsramme. |
| `src/components/icons/` | Egne ikoner; projektet bruger også @tabler/icons-react. |

Reference-sider: `src/app/profile/recipes/page.tsx` for opskriftsgrid, `src/app/profile/weight-calibration/page.tsx` for vægtregistrering og `src/app/profile/body-measurements/page.tsx` for kropsmål. Disse er læsekilder, ikke tilladelse til at kopiere eventuelle eksisterende design- eller logikfejl.

## Mappestruktur og placering

Stack ved udarbejdelsen: Next.js 16.2.12 App Router, React 19.2.4, TypeScript strict, Tailwind 4, Prisma 7 og PostgreSQL. Kontroller `package.json` ved senere arbejde. Importalias `@/` peger på `src/` via `tsconfig.json`.

| Sti | Indhold |
| --- | --- |
| `src/app/page.tsx` | Forside på `/`. |
| `src/app/<route>/page.tsx` | En egentlig side på `/<route>`. |
| `src/app/profile/`, `src/app/settings/` | Profil- og indstillingsområder; vælg ud fra det eksisterende flow, ikke navnet alene. |
| `src/app/admin/` | Administrationssider med særskilt navigation. |
| `src/app/api/<resource>/route.ts` | Server-endpoints. Ikke page.tsx. |
| `src/app/layout.tsx` | Global CSS, LocaleProvider, PhoneFrame og OfflineQueueBanner. Genopret ikke providers på hver side. |
| `src/app/globals.css` | Globale styles, tokens og fælles klasser. |
| `src/components/`, `src/components/hf/` | Delte komponenter og HelloFresh-primitiver. |
| `src/lib/` | Beregninger, dataadgang, integrationer og forretningslogik. |
| `src/i18n/LocaleProvider.tsx`, `src/i18n/index.ts` | Sprogprovider og oversættelsesfunktioner. |
| `src/i18n/locales/da.json`, `src/i18n/locales/en.json` | Appens tekster. Begge skal opdateres ved nye nøgler. |
| `src/lib/admin-i18n.ts` | Særskilt admin-oversættelse; læs ved admin-opgaver. |
| `prisma/schema.prisma`, `prisma/migrations/` | Model og versionsstyrede migrationer. |
| `public/` | Statiske offentlige assets. Aldrig private brugerfotos eller nøgler. |
| `scripts/` | Import- og driftsværktøjer; ikke nye UI-sider. |
| `docs/` | Specifikationer, status og beslutninger. |

Eksempler på nuværende routes:

| URL | Fil |
| --- | --- |
| `/foods` | `src/app/foods/page.tsx` |
| `/calendar` | `src/app/calendar/page.tsx` |
| `/statistics` | `src/app/statistics/page.tsx` |
| `/profile/recipes` | `src/app/profile/recipes/page.tsx` |
| `/profile/body-measurements` | `src/app/profile/body-measurements/page.tsx` |
| `/add/[id]` | `src/app/add/[id]/page.tsx` — tilføj et produkt |
| `/registration/[id]` | `src/app/registration/[id]/page.tsx` — eksisterende registrering |
| `/product/create` | `src/app/product/create/page.tsx` |
| `/api/body-measurements` | `src/app/api/body-measurements/route.ts` |

Ældre dokumenter kan bruge danske route-navne. Find altid den aktuelle route før ændringer. En hypotetisk ny profilside på `/profile/<aftalt-navn>` skal have `src/app/profile/<aftalt-navn>/page.tsx` og en målrettet navigationsændring i den relevante eksisterende menu. Opret ikke eksempelsiden eller en ny hovedfane uden en opgave.

## Kode- og datakontrakt før en ny side

1. Fastslå sideformål, URL, indgang, tilbage/luk og de eksisterende UI-primitiver.
2. Læs det relevante endpoint: HTTP-metode, JSON-felter, svarform, fejl og adgangskontrol. Læs modellen og eksisterende beregninger. Gæt ikke et endpoint eller en komponent-prop.
3. Hold serverhemmeligheder og Prisma på serversiden. Undersøg både brugeridentitet og ejerskab; `src/lib/demo-user.ts` findes stadig i nogle endpoints og er ikke produktionsautentifikation. Admin har egne auth-moduler. En eksisterende demo-route er ikke sikkerhedsskabelon for en ny funktion.
4. Brug `useTranslation` fra `@/i18n/LocaleProvider` til klienttekster og opdater da/en. Hold forretningsberegninger i `src/lib/`; genbrug fx `daily-totals.ts` og relevante domænemoduler.
5. Beskriv loading, tomme data, fejl, gemmefejl og lange tekster. Implementer korrekt autosave uden dubletter eller datatab. Manglende værdier er ikke automatisk nul.
6. Læs relevant guide i `node_modules/next/dist/docs/` før kode skrives. Hvis den ikke er tilgængelig via GitHub, kræves den lokale kontrol hos Codex, før koden kaldes integrationsklar.
7. Aftal ikke en ny arkitektur, databaseændring eller ekstern integration som skjult del af en ren layoutopgave. Dokumenter nødvendige afhængigheder åbent.

## Aflevering og "afventer commit"

**Uden lokal skriveadgang:** ChatGPT leverer en patch og/eller nye filer med præcise målfilstier samt udfyldt HANDOFF-TEMPLATE. Resultatet er endnu ikke lagt i appen. Codex sammenholder det med de aktuelle lokale filer og integrerer. Hvis et ZIP bruges som transport, indeholder det kun opgavens filer og afleveringsnotat, aldrig hele checkoutet.

**Med lokal skriveadgang:** Efter integration ligger en ny side direkte i den korrekte `src/app/...`-mappe. Git viser den som untracked eller modified indtil commit. Det er det, "afventer commit" betyder her; der behøves ingen særlig ventemappe. Lokale ændringer kan påvirke en kørende udviklingsserver allerede før commit.

Læg ikke ekstra `.tsx`-udkast under fx `drafts/` i repoet: `tsconfig.json` inkluderer bredt `**/*.tsx`, så de kan påvirke build. Aflever uintegrerede forslag som Markdown/patch eller filer uden for checkoutet. Overskriv aldrig en delt fil automatisk med ChatGPTs ældre GitHub-kopi.

Codex skal registrere udgangspunktets `git status`, bevare eksisterende arbejde, gennemgå ændringerne, køre `npm run lint` og `npm run build` og opdatere `docs/STATUS.md`. Nye varige produkt-/arkitekturbeslutninger skrives i `docs/DECISIONS.md`. UI verificeres jf. `design.md` §12. Ingen commit, push eller deploy er en del af standardafleveringen.

Hvis brugeren senere beder om commit, vælges kun de relevante ændringer. Især delte filer som `globals.css`, locale-filer, schema og status kan indeholde andres arbejde. Brug ikke en ukritisk samlet staging af projektmappen.

## Vedligeholdelse

Opdater denne startpakke ved ændret mappestruktur, stack, designkilde eller arbejdsform. Den daglige fremdrift hører fortsat i STATUS, og beslutninger i DECISIONS. Efter ændringer skal uploadede kopier udskiftes manuelt; repo-filer bliver først tilgængelige via GitHub efter commit og push. En vellykket build siger ikke, at migrationer er anvendt, at eksterne integrationer virker, eller at noget er deployed.
