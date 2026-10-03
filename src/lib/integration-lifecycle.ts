// Rene beregninger på integrationers til-/frakoblinger til admin →
// Integrationer (docs/DECISIONS.md 2026-10-02). Ingen Prisma, så de kan testes.

export type LifecycleEvent = { userId: string; type: string; createdAt: Date };

const DAY_MS = 86_400_000;

// Dage brugerne havde integrationen, før de koblede fra: hver frakobling
// parres med brugerens seneste tilkobling før den. Hændelser skal være
// sorteret stigende efter tid. Frakoblinger uden kendt tilkobling springes over.
export function uninstallDurations(events: LifecycleEvent[]): number[] {
  const lastConnect = new Map<string, Date>();
  const days: number[] = [];
  for (const event of events) {
    if (event.type === "CONNECTED") lastConnect.set(event.userId, event.createdAt);
    if (event.type === "DISCONNECTED") {
      const start = lastConnect.get(event.userId);
      if (start) days.push((event.createdAt.getTime() - start.getTime()) / DAY_MS);
      lastConnect.delete(event.userId);
    }
  }
  return days;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Hvor længe brugeren havde integrationen ved en frakobling, som tekst.
export function keptForLabel(events: LifecycleEvent[], userId: string, disconnectedAt: Date): string | undefined {
  let start: Date | null = null;
  for (const event of events) {
    if (event.userId === userId && event.type === "CONNECTED" && event.createdAt <= disconnectedAt) start = event.createdAt;
  }
  if (!start) return undefined;
  const days = Math.round((disconnectedAt.getTime() - start.getTime()) / DAY_MS);
  return days < 1 ? "under en dag" : `${days} ${days === 1 ? "dag" : "dage"}`;
}

// Antal aktive installationer ved udgangen af hver tidsbucket, regnet
// baglæns fra antallet nu: start = nu − (tilkoblinger − frakoblinger).
export function activeOverTime(
  activeNow: number,
  buckets: { connected: number; disconnected: number }[]
): { atStart: number; series: number[] } {
  const net = buckets.reduce((sum, b) => sum + b.connected - b.disconnected, 0);
  const atStart = Math.max(0, activeNow - net);
  let running = atStart;
  const series = buckets.map((b) => {
    running += b.connected - b.disconnected;
    return Math.max(0, running);
  });
  return { atStart, series };
}
