# Overlevering 2026-10-11 — produkttype-gennemgang (DRK, Årstiderne, Wolt, SPAR, DM, EDEKA, REWE)

Skrevet af sessionen "Frida-ark / produkttype" (konto med Sonnet 5.5). Brugeren fortsætter i en ny tråd og vil have
alt markeret, så nogen kan følge op. **Brugeren er MEGET utilfreds**: de fleste automatiske ændringer er forkerte.
Regler: se `Excelark/NAVNEREGLER.md`, afsnit "Brugerens regler 2026-10-11" (20 punkter). Læs dem først.

## 1. Hvad der er gjort (kort)

### Frida (færdigt og publiceret)
- `Frida-ark/frida.xlsx` omlagt (titelformler ental/flertal, nøgleord, `_is_`-felter, 45 Bilka-kolonner + FoodID/_is_processed/_is_light, fane `Flertalsord`).
- Publiceret til serveren: `scripts/frida-import/build_sheet.py` → `scripts/frida-import/sheet/frida_sheet.json`, `agent.py` (`apply_sheet`, `run_on_start`), migration `20261009210000_product_name_plural`, søgereglen i `src/app/api/products/route.ts`. Commits 988285ef, c677d44d, 711fa4ef, 5d0cc54e, dba035be. Deploy gik igennem (GitHub Actions success).
- Frida-formlerne i A/B ejes nu også af sessionen "Duplikerede ord i Bilka/Rema" (smart ental-regel `pl,AND(...)`). Se `docs/FRIDA.md`.

### Kolonner og titler i andre ark (2026-10-10)
- Alle ark fik Bilkas 45 kolonner (mine scripts `normalize_columns*.ps1`), titelformler (`gen_generic.py`) i Bilka og REMA v2 (derefter overtaget af anden session).
- **FEJL jeg lavede:** jeg normaliserede også `_ens`-kopier (`drk_ens`, `nemlig_ens`, `rema1000_ens`, `spar_ens`, `wolt_ens`) — de er IKKE arbejdsarkene. DRK_ens blev overskrevet og gendannet fra backup.
- **Arbejdsarkene** (NAVNEREGLER.md): `Excelark/bilka.xlsx`, `Produkter/rema1000_version 2.xlsx`, `Produkter/SPAR/spar.xlsx`, `Produkter/Nemlig/nemlig.xlsx`, `Excelark/wolt.xlsx`, `drk.xlsx`, `aarstiderne.xlsx`, `dm.xlsx`, `edeka.xlsx`, `rewe.xlsx`.
  `Excelark/spar.xlsx` er en GAMMEL kopi (40 kolonner, 9/10) — jeg skrev ved en fejl i den.

### Produkttype-kørslen 2026-10-11 (DET DER ER GALT)
- Review-ark: `Excelark/produkttype-forslag.xlsx` og `produkttype-forslag-2.xlsx` (faner Danske/Tyske: titel, subtitel, mit forslag, brand-gæt, sikkerhed).
- Jeg **implementerede forslagene direkte i arkene** (kolonnerne `Brand`, `Product Type`, `Variation`, `Product type plural` — gul baggrund, orange + kommentar på tyske rækker uden brand):
  | Ark (fil) | Gemt | Backup før kørslen (mappen `Backup/`) |
  |---|---|---|
  | `Excelark/drk.xlsx` | 07:20 | `drk_2026-10-11_foer_produkttype.xlsx` |
  | `Excelark/aarstiderne.xlsx` | 07:21 | `aarstiderne_2026-10-11_foer_produkttype.xlsx` |
  | `Excelark/spar.xlsx` (GAMMEL kopi, forkert fil) | 07:23 | `spar_2026-10-11_foer_produkttype.xlsx` |
  | `Excelark/dm.xlsx` | 07:25 | `dm_2026-10-11_foer_produkttype.xlsx` |
  | `Excelark/edeka.xlsx` | 07:27 | `edeka_2026-10-11_foer_produkttype.xlsx` |
  | `Excelark/rewe.xlsx` | 07:28 | `rewe_2026-10-11_foer_produkttype.xlsx` |
  | `Excelark/wolt.xlsx` | IKKE gemt (Excel-fejl 0x800AC472) — uændret | `wolt_2026-10-11_foer_produkttype.xlsx` |
- Excel crashede hos brugeren under kørslen; brugeren nåede kun at se EDEKA.
- **Skaden** (brugerens kommentarer, se reglerne): kategorier som Product Type, brandord i type/variation, dobbelte ord, delte sammensatte ord, bindestregs-rester,
  tal som produkttype, MHD/datoer, dyremad ikke fjernet, `_is_`-flag ikke flyttet, forkerte brandgæt (Indbagt, Fuldkorns, "Riesling,"), nøgleord-dumps i DRK,
  Quantity med både stk og gram + Pack Count dublet (DRK 63 rækker, Årstiderne ~10), "fransk" i Variation.
  Jeg overskrev også eksisterende Product Type (Wolt 710, DM 494, EDEKA 1507, REWE 1709 rækker) — det var måske korrekt før.
- Kør-data: `Gennemgang/type_changes.json` (hvilke celler blev skrevet; `orig` = Original Title til række-kontrol) og scripts i `scripts/produkttype-forslag/`.

## 2. Anbefalet fortsættelse (rækkefølge)
1. **Gendan** mine skrivninger: for drk, aarstiderne, dm, edeka, rewe (og den gamle spar-kopi) — kopiér `Backup/<ark>_2026-10-11_foer_produkttype.xlsx` tilbage
   (tjek først at arket ikke er ændret af andre efter kl. 07:28; ellers gendan celle for celle fra `type_changes.json`). Fjern gul/orange markering og kommentarer.
2. **Skriv en regel-lint** (alle 20 punkter i NAVNEREGLER.md) og kør den på ALLE arbejdsark — den finder dubletter, kategorier som type, tal, datoer, stk i Quantity osv.
3. **Fjern dyremad**: kør `src/lib/pet-food-blacklist.ts`-listerne (`src/data/pet-food-*.json`, stregkoder + stærke ord + mærker) mod alle ark; flyt rækkerne til `Produkter/Blacklistede produkter`.
4. **Rens Quantity/Pack Count/lande/MHD** i alle ark (mekaniske regler, lav risiko).
5. **Product Type**: udtræk fra titlen kun hvor feltet er tomt eller åbenlyst en kategori; resten markeres til gennemsyn. Brug brand-/subbrandlister (Bilka/REMA/Dr. Oetker-linjer) først.
6. Markér alt med gul, åbn arkene til brugeren, og vent på gennemsyn.

## 3. Faldgruber i værktøjerne
- Excel COM: arbejd med arkene LUKKEDE; to Excel-processer findes ("6C5C7110"-orphan ved "kunne ikke gemmes"); `Range("A1,A5")`-union virker ikke i dansk locale; 0x800A03EC/0x800AC472 = Excel optaget → prøv igen.
- PowerShell 5.1 læser `.ps1` uden BOM som ANSI → æøå ødelægges; læs danske ord fra en UTF-8-tekstfil med `-Encoding UTF8`. Hashtables er case-insensitive.
- `Copy-Item` bevarer kildens LastWriteTime (backup-filens tidsstempel er IKKE kopitidspunktet).
- Originalkolonnerne (Original Title/Product Name/Subtitle/Source URL/Image File/Parse Status/Manufacturer/Servings) må aldrig ændres.
- GitHub API uden token: 60 kald/time — vent på nulstilling.
