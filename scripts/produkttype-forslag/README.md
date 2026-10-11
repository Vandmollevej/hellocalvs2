# Produkttype-forslag (2026-10-11) — scripts fra sessionen der lavede de forkerte skrivninger

OBS: disse scripts gav forkerte resultater (se `docs/handoffs/2026-10-11-produkttype-gennemgang.md`). De er gemt som dokumentation, ikke som anbefalet værktøj.
- `ptype.py` — ordforråd (Bilka/REMA/Frida) + dansk/tysk udtræk af produkttype
- `apply_types.py` — beregner ændringer pr. ark -> `type_changes.json`
- `apply_types.ps1` — skriver ændringerne i Excel via COM + gul markering
- `build_review.py/build_review2.py` — review-arkene `Excelark/produkttype-forslag*.xlsx`
- `gen_generic.py`, `normalize_columns2.ps1`, `apply_rules.ps1` — titelformler og kolonne-ensretning
