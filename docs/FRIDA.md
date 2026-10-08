# FRIDA — Den Danske Fødevaredatabase i HELLO CAL

Samlet opslag for al Frida-behandling. Detaljer og historik: `docs/DECISIONS.md`
(2026-08-27, 2026-09-19, 2026-09-24) og `docs/STATUS.md`.

## Hvad er Frida

DTU Fødevareinstituttets database over danske fødevarers næringsindhold
(frida.fooddata.dk). Bruges i HELLO CAL som **sikker referencedata for generiske
varer** (æble, kylling, mel …) og som **kilde til estimater** (~), når en
mærkevare mangler et felt.

- Licens: CC-BY 4.0. Kildeangivelse (vist på `/madvarer`):
  "Fødevaredata (frida.fooddata.dk), DTU Fødevareinstituttet, Danmarks Tekniske Universitet".
- Ingen offentlig API på Fridas egen side — data hentes fra DTU's Figshare
  (`api.figshare.com`, gruppe-id `18053`, titel "Danish Food Composition Database").

## Import (`scripts/frida-import`, service `frida-agent`)

- Poller Figshare (standard hver 24 t, `FRIDA_AGENT_POLL_INTERVAL_SECONDS`) efter
  nyeste udgivelse og importerer automatisk — ingen manuel download.
- Hver fødevare upsertes som `Product` med `externalSource='FRIDA'`,
  `status='APPROVED'`, ingen stregkode; match på (`externalSource`, `externalId` = Frida FoodID),
  så ny version opdaterer i stedet for at duplikere.
- `frida_import_state` husker senest importerede Figshare-artikel. Markøren
  `[micronutrients-v1]` i `title` udløser én genimport, så mikrodata kommer med.
- Gemmer pr. 100 g: kcal (356), protein (218), kulhydrat (170), fedt (141) samt
  mikrodata i `Product.micronutrientsPer100g` (fedtsyrer, kolesterol, kostfibre,
  sukker, salt, mineraler, vitaminer). ParameterID-mapping står i `agent.py`
  (`MICRO_PARAMS`) og skal holdes i sync med `src/lib/nutrients.ts`.
- Kan styres fra admin-jobs (`src/lib/jobs/registry.ts`, nøgle `frida-import`).
- `scripts/frida-import/data/` er gitignoreret (stort, licenseret) og ikke nødvendigt for tjenesten.

## Brug i appen

| Sted | Hvad |
|---|---|
| `src/lib/generic-ingredient-match.ts` | Fuzzy match (min. score 0,4) af ingrediensnavn mod Frida-navne (første kommasegment foretrækkes). |
| `src/lib/nutrient-resolution.ts` | Næringsstoffer: producentens tal → Frida på generisk vare (sikker) → lånt Frida-estimat (~). Frida-liste cachet 1 t. |
| Generiske ingredienser | Makroer + mikrodata **kopieres** ved oprettelse (`fridaProductId`), så en re-import ikke ændrer allerede loggede tal. |
| Registreringer | Snapshot af næringsstoffer — ændres aldrig bagud. |

## Regler

- Frida-data på selve den generiske vare er **sikre** (ingen ~). Lånt fra nærmeste
  Frida-vare til en mærkevare = **estimeret (~)**; admin-godkendelse fjerner ikke ~.
- Vi beregner aldrig selv en ± — kun producentens ± vises; estimater får kun ~.
- Frida/HelloFresh-importerede varer er aldrig "verified" (kræver rigtigt foto i guided flow).
- Billeder må ikke hentes/rehostes fra Frida-kilden (ingen billeder i datasættet).

## Drift / kendte forhold

- Deployes via `compose.production.yaml` (`frida-agent`) og `.github/workflows/build.yml`.
- Server-filerne i `scripts/frida-import/` ejes af en anden bruger end `Peter`
  (se STATUS.md 2026-08-29) — kør `sudo rm -rf scripts/frida-import` én gang og kopiér igen,
  næste gang `agent.py` skal ændres.

## Ikke bygget endnu

- Frida-AI-beregning af kødandel i sammensatte retter.
