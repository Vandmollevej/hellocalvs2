// Starter Hello Cals in-process baggrundsjob (48-timers eskalering,
// besked-kø-afsendelse) én gang pr. serverinstans, se src/lib/scheduler.ts
// og docs/DECISIONS.md (2026-09-02). Kaldes af Next.js selv, se
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // API-nøgler rettet i admin lægges oven på .env, før noget andet kører
    // (src/lib/api-keys/store.ts). Fejler databasen, gælder .env indtil
    // admin-siden indlæser dem igen.
    const { loadStoredSecrets } = await import("@/lib/api-keys/store");
    await loadStoredSecrets().catch((error) => console.error("[api-keys] kunne ikke indlæse", error));

    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}
