# Frida-sammenligning (Rema 1000 / Bilka ↔ Frida)

Excel-ark der sammenligner butiksvarers energifordeling med den tilsvarende Frida-vare
(DTU Frida 6.1). Bruges som indikator for, hvad der bør undersøges nærmere — ikke som facit.

## Arket

- Én gruppe pr. Frida-vare: Frida-rækken (grøn, fed) først, derefter Rema- og Bilka-varerne; tom række mellem grupper.
- Kolonner: kcal, protein/kulhydrat/fedt (g), energifordeling E% (4/4/9 kcal pr. g), mættet fedt, sukker,
  kostfibre, salt, vitaminer/mineraler (kun kolonner hvor mindst én butiksvare har tal), matchnote,
  "Afviger mest på" og til sidst **Afvigelse %** = største forskel i procentpoint mellem butiksvarens og Fridas E%.
- Rød ≥ 15 procentpoint, gul 7,5–15. Grupper sorteret med størst afvigelse først.
- Udeladt: alkoholholdige drikke (energien er mest alkohol) og varer med < 5 kcal fra makroer.
- Grå kursiv: præcis 0,5 g hos REMA — datasættet bruger 0,5 som pladsholder for "under 0,5 g".

## Filer

| Fil | Indhold |
|---|---|
| `build_xlsx.py` | Bygger `Frida-sammenligning.xlsx` (gitignoreret). Formler beregnes, når arket åbnes i Excel. |
| `data/rema_matches.json` | 910 REMA-varer matchet 1:1 til Frida (2026-10-10). |
| `bilka_extract.py` | Læser `bilka_product_information.xlsx` + `bilka_vitamins.xlsx` (NAS) → `data/bilka_values.json`, `data/bilka_list.txt`, `data/frida_list.txt` (alle gitignoreret). |
| `data/bilka_matches.json` | Bilka-varer matchet til Frida (laves lokalt, se nedenfor). |

## Matchregler (samme for alle butikker)

Matchet laves ud fra navn, type, tilstand og variant — **uden at se næringstal**, så store afvigelser ikke sorteres fra.

- Samme fødevare og samme tilstand (rå/kogt/stegt/røget/tørret/dåse/frost/syltet/færdigbagt) og samme fedt-/sukkerklasse
  (minimælk ≠ sødmælk, light ≠ almindelig, med tilsat sukker ≠ uden).
- Tilladt: mærke, økologi, emballage, størrelse, oprindelsesland, lille smagsvariant der ikke ændrer grundsammensætningen
  ("jordbæryoghurt" ↔ "Yoghurt med frugt" ok; "chokoladekiks" ↔ "almindelige kiks" ikke ok).
- Sammensatte produkter (pizza, færdigretter, dressing, pålæg, slik) kun hvis Frida har netop den type.
- Flere nære Frida-varianter: vælg den mest præcise (fedtprocent; tør pasta/ris/bønner ↔ tørret/rå Frida-vare).
- I tvivl (under ca. 90 % sikker): udelad.

Format: `[{"ean": "...", "frida_id": "...", "confidence": 90-100, "note": "kort forskel, dansk"}]`
(`frida_id` = første kolonne i `data/frida_list.txt`; `ean` = første kolonne i `data/bilka_list.txt`).

## Tilføj Bilka (kræver adgang til NAS'en, dvs. lokalt)

```
cd scripts/frida-compare
py bilka_extract.py            # standard: Bilka-mappen på \\192.168.1.90 (eller angiv mappe)
# match data/bilka_list.txt mod data/frida_list.txt efter reglerne ovenfor → data/bilka_matches.json
py build_xlsx.py               # → Frida-sammenligning.xlsx
```

Melder `bilka_extract.py` manglende kolonner, så ret `MACROS`/`NAME_COLS` øverst i scriptet til arkets overskrifter.
