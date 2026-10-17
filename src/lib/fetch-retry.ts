// Henter JSON med tidsgrænse og automatiske genforsøg, så en forespørgsel,
// der hænger (fx mens serveren genstarter ved en deploy), aldrig efterlader
// skærmen med evige pladsholdere. Kaldets eget signal afbryder straks.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchJsonWithRetry<T>(
  url: string,
  { signal, attempts = 4, timeoutMs = 15_000 }: { signal?: AbortSignal; attempts?: number; timeoutMs?: number } = {},
): Promise<T> {
  let lastError: unknown = new Error("offline");
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      // 4xx (fx ikke logget ind) bliver ikke bedre af et nyt forsøg.
      if (res.status >= 400 && res.status < 500) throw Object.assign(new Error("client"), { final: true });
      if (!res.ok) throw new Error("offline");
      return (await res.json()) as T;
    } catch (error) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if ((error as { final?: boolean }).final) throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  throw lastError;
}
