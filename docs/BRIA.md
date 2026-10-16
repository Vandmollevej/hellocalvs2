# Bria – fritlægning og kvalitetssammenligning

Billedrobotten (`scripts/image-agent`) fjerner som standard baggrunden med
rembg. Bria RMBG kan vælges som alternativ motor uden at ændre resten af
pipelinen (beskæring, opretning, lys). Fejler Bria, falder robotten tilbage til rembg.

## Opsætning (brugeren)

1. Opret konto på https://platform.bria.ai og lav en API-nøgle (Dashboard → API Keys).
2. Tilføj på serveren i `.env.production` (aldrig i git):
   `BRIA_API_TOKEN=<nøglen>`
   Lad `CUTOUT_ENGINE` stå på `rembg` under sammenligningen.
3. Genopret robotten: `docker compose -f compose.production.yaml up -d --build image-agent`

## Sammenligning

`docker compose -f compose.production.yaml exec image-agent python compare_engines.py 20`

Kører de 20 seneste fritlagte billeder gennem begge motorer og skriver
side-om-side-billeder (original | rembg | bria på skakternet baggrund) til
`data/product-images/compare/` samt en tabel med tid og fejl. Se på kanter,
logoer med farvefelt, lyse varer mod lys baggrund og gennemsigtig emballage.

## Skift til Bria

Sæt `CUTOUT_ENGINE=bria` i `.env.production` og genstart `image-agent`.
Tilbage: `CUTOUT_ENGINE=rembg`. Bria er betalt pr. billede.
