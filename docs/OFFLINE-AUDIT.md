# Offline-audit (2026-10-07)

Brugerens spørgsmål: "Vis mig alle de steder offline-besked bliver vist. Har du forberedt noget overhovedet? Og tænkt i de scenarier? Fx ved produktsøgning?"

**Ærligt svar før denne gennemgang:** der fandtes kun ét sted med en rigtig offline-besked (oprettelse af ny vare). Alle andre skærme viste en generisk "kunne ikke hente …"-fejl eller *ingenting*, og ingen skærm skelnede mellem "ingen forbindelse" og "serverfejl". Det er rettet nedenfor med ét fælles hook og én fælles banner.

## Fælles byggesten (nyt)

| Fil | Hvad |
| --- | --- |
| `src/lib/use-online-status.ts` | `useOnlineStatus()` (lytter på `online`/`offline`), `useConnectionMessage()` (giver "Ingen forbindelse …" i stedet for skærmens almindelige fejltekst, når enheden er offline) og `isNetworkFailure()` |
| `src/components/OfflineQueueBanner.tsx` | Banneret øverst i hele appen viser nu "Du er offline — nogle funktioner virker ikke" på alle skærme (monteret i `src/app/layout.tsx:73`); står der varer i offline-køen, vises begge i samme bånd |
| `offline.*` i `src/i18n/locales/*.json` | Tekster på alle 7 sprog (`message`, `banner`, `barcodeLookup`) |

## Hvor offline-besked vises i dag

| Sted (fil:linje) | Hvornår | Hvordan |
| --- | --- | --- |
| `src/components/OfflineQueueBanner.tsx:49` | Altid når enheden er offline (alle sider) | Bånd øverst: "Du er offline — nogle funktioner virker ikke" (+ antal ventende oprettelser) — **nyt** |
| `src/app/product/create/page.tsx:204-241` | Opret vare uden net (eller upload fejler på netværket) | Varen gemmes på enheden (`offline-product-queue.ts`, IndexedDB) og sendes automatisk, når nettet er tilbage; skærmen siger det |
| `src/app/search/page.tsx:229` | **Produktsøgning** uden net | Teksten "Ingen forbindelse — det her kræver internet …" i stedet for "Madvarer kunne ikke hentes" — **nyt** |
| `src/app/foods/page.tsx:296` | Madvarer-siden kan ikke hentes | Samme offline-tekst — **nyt** |
| `src/components/camera/ProductCaptureFlow.tsx:1104` | **Stregkode læst, men opslag fejler** uden net | "Stregkoden blev læst, men du har ingen forbindelse. Prøv igen, når du er online." — **nyt** |
| `src/components/add/AddProductView.tsx:667` | **Gem registrering** uden net | Offline-tekst i stedet for generisk "kunne ikke gemme" — **nyt** |
| `src/components/DailyList.tsx:214` | Dagens liste / slet registrering uden net | Offline-tekst — **nyt** |
| `src/app/camera/page.tsx:409` | **Tallerken-scan** (AI-analyse) uden net | Offline-tekst — **nyt** |
| `src/app/my-scans/page.tsx:123` | Mine indscanninger | Offline-tekst — **nyt** |
| `src/app/profile/recipes/page.tsx:114,274,288` | Opskrifter (Mine / Delt) | Offline-tekst — **nyt** |
| `src/app/create-dish/page.tsx:326` | Søg ingrediens til ret | Offline-tekst (stod før som "ingen resultater", hvilket var misvisende) — **nyt** |

## Steder der håndterer fravær af net uden besked (bevidst tavse)

| Sted | Adfærd |
| --- | --- |
| `src/i18n/LocaleProvider.tsx:49` | Beholder sidst kendte sprog (localStorage) |
| `src/components/AuthGate.tsx:54` | Offline/serverfejl sender ikke brugeren til login (kun klart "ikke logget ind" gør) |
| `src/components/family/FamilyStatusProvider.tsx:80` | Beholder sidste kendte familiestatus |
| `src/app/search/page.tsx:130,153` + `src/app/favorites/page.tsx:44,50` | Seneste/favoritter bliver tomme uden besked (dækket af det globale banner) |

## Hvad der **ikke** virker offline (kendte huller, ikke bygget)

- Ingen service worker / PWA-cache: appen kan ikke åbnes helt uden net, kun allerede indlæste sider virker.
- Registreringer (`/api/registrations`) lægges **ikke** i kø offline — brugeren får offline-besked og må prøve igen. Kun nye varer køes. At køe registreringer kræver en beslutning om konfliktløsning (snapshot-semantik) og er ikke lavet.
- Etiket-/ingrediens-læsning (OCR/AI) i kamera-flowet fejler uden net og viser flowets almindelige fejl; det globale banner forklarer hvorfor.
