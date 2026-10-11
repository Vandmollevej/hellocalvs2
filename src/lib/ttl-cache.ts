// Lille hukommelses-cache med udløbstid til tunge admin-opslag (docs/DECISIONS.md
// 2026-10-11, "Admin-hastighed"). Ligger på globalThis, så alle route-bundles i
// samme Node-proces deler den — ellers kunne en API-rute ikke nulstille cachen
// for en side. Værdier må ikke ændres af kalderen (de deles).
type Entry = { expires: number; value: unknown };
type Store = { entries: Map<string, Entry>; inflight: Map<string, Promise<unknown>> };

const holder = globalThis as typeof globalThis & { __hcTtlCache?: Store };
const store: Store = (holder.__hcTtlCache ??= { entries: new Map(), inflight: new Map() });

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.entries.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  // Samtidige kald deler ét opslag i stedet for at starte hvert sit.
  const pending = store.inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise: Promise<T> = load()
    .then((value) => {
      // Er opslaget nulstillet undervejs, er værdien forældet og gemmes ikke.
      if (store.inflight.get(key) === promise) {
        store.entries.set(key, { value, expires: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => {
      if (store.inflight.get(key) === promise) store.inflight.delete(key);
    });
  store.inflight.set(key, promise);
  return promise;
}

// Nulstiller alle nøgler, der starter med prefix — kaldes efter rettelser.
export function invalidateCache(prefix: string) {
  for (const key of [...store.entries.keys()]) {
    if (key.startsWith(prefix)) store.entries.delete(key);
  }
  for (const key of [...store.inflight.keys()]) {
    if (key.startsWith(prefix)) store.inflight.delete(key);
  }
}
