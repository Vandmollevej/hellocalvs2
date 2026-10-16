# Bria – fritlægning og kvalitetssammenligning

Billedrobotten (`scripts/image-agent`) fjerner som standard baggrunden med
rembg. Bria RMBG kan vælges som alternativ motor uden at ændre resten af
pipelinen (beskæring, opretning, lys). Fejler Bria, falder robotten tilbage til rembg.

## Opsætning (alt i admin, intet på serveren)

1. Admin → API-nøgler → **Bria** → indsæt API-token → Gem → Test.
   (Nøglen kan også stå som `BRIA_API_TOKEN` i `.env.production`; admin vinder.)
2. Admin → Robotter → **Bria: sammenlign med rembg** → Kør nu.
3. Åbn `https://hellocal.io/product-images/compare/index.html`
   (original | rembg | Bria på tern). Jobbet bruger ét Bria-opslag pr. billede
   (højst 20 danske Open Food Facts-varer, vi bruger) og stopper efter tre fejl i træk.

Image-agent skal være genstartet med den nye version én gang (deploy).

## Skift til Bria

Sæt `CUTOUT_ENGINE=bria` i `.env.production` og genstart `image-agent`.
Tilbage: `CUTOUT_ENGINE=rembg`. Bria er betalt pr. billede.

## Verificeret / uverificeret

API-adressen og headeren (`api_token`, `sync: true`) er skrevet efter Bria's
dokumentation fra hukommelsen og ikke prøvet mod den rigtige tjeneste. Knappen
"Test" under API-nøgler og første kørsel afslører en afvigelse.
