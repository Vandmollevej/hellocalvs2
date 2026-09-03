// Rene konstanter uden server-only imports (Prisma/pg), så de trygt kan
// importeres fra client components som src/app/profile/points/page.tsx —
// se src/lib/points.ts, som re-eksporterer disse til server-brug.
export const FREE_MONTH_COST = 300;
export const MAX_FREE_MONTHS = 12;
export const MAX_FORWARD_POINTS_PER_MONTH = 50;
