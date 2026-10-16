# Lidl/Aldi: flere varedetaljer (scripts/lidl-aldi-enrich)

Brugerens krav 2026-10-16. Kører **lokalt på brugerens pc om natten**, ikke på serveren.

## Hvad den gør

1. Læser alle Lidl- og Aldi-filer (`.xlsx`, `.csv`, `.json`) i `inputDir` (filnavn/mappe skal indeholde "lidl" eller "aldi") på dansk og tysk. Sproget læses fra en sprog-kolonne, ellers fra filnavnet ("dansk"/"tysk"/"dk"/"de"); filer uden sprog tages med.
2. Pr. vare: stregkode → Open Food Facts. Giver det 0 resultater: titlen (brand + titelord) → Open Food Facts; et titelfund skal rumme mindst 60 % af vores titelord og vores brand. Giver også det 0 resultater, og varen har et billede (URL eller filsti): **Google Vision `WEB_DETECTION`** — kun da.
3. Det, kilden ved mere om end vores fil (vi har intet, eller teksten er markant længere og rummer ord, vi mangler), skrives til `outputDir\lidl-aldi-nye-fakta.xlsx`: ark **Nye fakta** (butik, vores titel, stregkode, kilde, link og de nye fakta i kolonner ved siden af) og ark **Intet nyt** (varer uden nye fakta og hvorfor).
4. Intet skrives til databasen. `cache.jsonl` i `outputDir` gør, at næste nat fortsætter, hvor den slap; `maxMinutes` (standard 360) stopper kørslen om morgenen.

Vision-fund er kun tekst (bedste gæt, emner, sider) — ikke billeder. Billedsammenligning (>90 %) er ikke med i dette script.

## Opsætning på pc'en (ingen administrator)

1. Kopiér `config.example.json` til `config.local.json` (gitignoreret) og ret `inputDir`, `outputDir` og `visionCredentials` (servicekontofilen; ligger aldrig i git).
2. Prøv: `py -3 -m venv .venv`, `.venv\Scripts\pip install -r requirements.txt`, `.venv\Scripts\python enrich.py --inspect` (viser fundne filer/kolonner/antal), derefter `--limit 20`.
3. Kør én gang `powershell -ExecutionPolicy Bypass -File install-task.ps1` (valgfrit `-At 02:30`). Opgaven `HelloCalLidlAldiEnrich` kører dagligt, også hvis pc'en var slukket (`StartWhenAvailable`).
4. Hver nat kører `run-nightly.ps1`: `git pull --ff-only origin master`, opdaterer `.venv`, kører `enrich.py`. Log: `scripts/lidl-aldi-enrich/logs/`.

Kolonner genkendes på overskrift (titel/name/produkt, EAN/GTIN/stregkode, brand, billede, sprog, ingredienser, allergener, mængde, næringsværdier …, se `ALIASES` i `enrich.py`). Mangler en titel-kolonne, springes filen over med en advarsel.

## Admin → Robotter

Jobbet `lidl-aldi-enrich` står i `src/lib/jobs/registry.ts`, så det kan ses under Robotter/Cron-jobs, men rækken oprettes **slået fra** (`defaultEnabled: false`). Serveren har ingen kode, der kører det; scriptet kører kun på pc'en.

## Test

`cd scripts/lidl-aldi-enrich && python -m unittest test_enrich` (ingen netværk).
