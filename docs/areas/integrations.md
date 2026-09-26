# Integrationer — start her

Læs [fælles kort](README.md). Området er ikke tomt: kode findes allerede,
men drift og fuldstændighed er ikke verificeret i denne kortlægning.

- UI: `src/app/settings/integrations/page.tsx` (oversigt) og
  `src/app/settings/integrations/[app]/page.tsx` (én side pr. app med til/fra).
- Til/fra pr. datatype og push: `src/lib/integrations/sync-settings.ts`,
  `src/lib/integrations/push.ts`, `Integration.syncSettings`/`lastPushedAt`.
- Katalog/status: `src/lib/integrations.ts`.
- Tjenester: `src/lib/integrations/fitbit.ts`,
  `src/lib/integrations/withings.ts`.
- OAuth og sync: `src/app/api/integrations/fitbit` og `withings`.
- Enhedstokens/modtagelse: `src/lib/device-tokens.ts`,
  `src/app/api/integrations/healthkit`.
- Kontrakt: relevante integrationsafsnit i `docs/DECISIONS.md`,
  `docs/HEALTHKIT_COMPANION.md`, `docs/BACKEND.md`.

Integration har userId, provider, status, tokenfelter, expiresAt, scope,
connectedAt, lastSyncedAt og lastError. DeviceToken styrer enhedsmodtagelse.
Tokens er serverdata og må ikke kopieres til områdevejledninger eller UI.
Fitbit-sync skriver Activity og WeightEntry; Withings skriver WeightEntry;
healthkit-ingest skriver sundhedsdata. Hello Cal ejer visning og analyse.

Kataloget markerer Garmin som utilgængelig og Apple/Google som afhængige af
en fremtidig companion-app. Dette er kodefund, ikke en ny teknisk vurdering
af leverandørernes aktuelle API'er. Verificér officielle krav ved udvikling.

Eksterne produktkilder er en anden integrationskategori:
`src/lib/openFoodFacts.ts`, `src/lib/foodDataCentral.ts`, `src/lib/passio.ts`
og kald fra produkt-/AI-ruter. Afklar disse afhængigheder ved produktarbejde;
de må ikke forveksles med sundhedstjenesternes brugerforbindelser.

Designændringer på integrationssiden følger fælles kort. Nye netværks- eller
miljøændringer kræver først læsning af `docs/DEPLOYMENT.md`.
