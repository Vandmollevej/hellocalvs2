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

## Credits og fremtidige billeder (bruger 2026-10-16)

- **Intet billede koster to gange**: hvert Bria-svar gemmes i `data/product-images/bria-cache/<sha256 af billedet>.png`. Samme billede igen (fx en ny sammenligning) bruger cachen og tæller hverken credits eller API-forbrug.
- **Loft**: antallet af filer i cachen er kreditregnskabet. Ved `BRIA_MAX_CREDITS` (standard 170 af de 180 tilbage 2026-10-16) stopper robotten med en tydelig fejl. Hæv tallet, når der købes flere.
- **Nye billeder**: hver ny fritlægning af et forsidefoto (PRODUCT_FRONT) får foruden rembg-udklippet `{job}.png` en Bria-udgave `{job}_bria.png` ved siden af. Under admin → Billedbehandling → Billedforslag står "Forslag (udklip)" og "Forslag (Bria)" som valg; godkendes Bria-udgaven, bliver den varens billede (`/api/admin/products/[id]/image/accept` med `variant: "bria"`). Uden valg gælder rembg som før.
- Fejl hos Bria vælter aldrig fritlægningen.
