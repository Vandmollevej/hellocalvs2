# Hello Cal — start her

Læs [fælles kort](README.md). Fokus: brugerappen, ikke medarbejderappen.

## Kildekort

- Dagbog: `src/app/calendar`, `src/app/registration`,
  `src/app/api/registrations`, `src/lib/daily-totals.ts`.
- Mad og retter: `src/app/foods`, `src/app/search`, `src/app/add`,
  `src/app/create-dish`, `src/app/api/dishes`, `src/app/api/favorites`.
- Analyse: `src/app/statistics`, `src/lib/stat-cards.ts`,
  `src/lib/stat-periods.ts`, `src/lib/weight-trend.ts`, `src/lib/goals.ts`.
- Profil/onboarding: `src/app/profile`, `src/app/signup`, `src/app/welcome`,
  `src/app/api/profile`. Login og adgang er fælles afhængigheder.
- Indstillinger: `src/app/settings`; integrationer og admin har egne kort.
- Pointsvisning: `src/app/profile/points`, `src/app/api/points`;
  beregning i `src/lib/points.ts` deles med produktgodkendelse.

## Data og grænser

Læs de relevante User-, Registration-, Dish-, Favorite-, WeightEntry-,
BodyMeasurement-, WaterEntry-, SleepSchedule-, WorkShift-, Activity- og
HealthMetric-modeller i `prisma/schema.prisma`. Analyse skal bevare
Registration-snapshots frem for at genberegne fortiden fra Product.
Produktopslag deler produktmodulet med admin/oprettelse. Sundhedsintegrationer
leverer data gennem integrationsområdet.

Produktkontrakt: `docs/SPECIFICATION.md`, relevant del af `docs/UI.md`.
Design: fælles kort samt `design.md` §6 for den aktuelle komponent.
Hold analyse, dagbog og profil som separate delopgaver; læs ikke hele appen
for en isoleret ændring. Ingen nye produktkrav fastlægges i dette kort.
