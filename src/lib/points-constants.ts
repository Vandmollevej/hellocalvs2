// Rene konstanter uden server-only imports (Prisma/pg), så de trygt kan
// importeres fra client components som src/app/profile/points/page.tsx —
// se src/lib/points.ts, som re-eksporterer disse til server-brug.
export const FREE_MONTH_COST = 300;
export const MAX_FREE_MONTHS = 12;
export const MAX_FORWARD_POINTS_PER_MONTH = 50;
// Teaser: alle nye brugere starter med 35 points (docs/DECISIONS.md 2026-10-03).
export const SIGNUP_BONUS_POINTS = 35;
// Første testperson af en integration, ved admin-godkendelse (2026-10-02).
export const INTEGRATION_TESTER_POINTS = 300;
