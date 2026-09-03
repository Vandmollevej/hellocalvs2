// Starter Hello Cals in-process baggrundsjob (48-timers eskalering,
// besked-kø-afsendelse) én gang pr. serverinstans, se src/lib/scheduler.ts
// og docs/DECISIONS.md (2026-09-02). Kaldes af Next.js selv, se
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}
