// Meilisearch-klient (docs/DECISIONS.md 2026-10-10, "Søgemotor"). Kun REST via
// fetch — ingen ekstra pakke. Er søgemotoren ikke sat op (MEILI_URL tom) eller
// nede, svarer alle kald null, og GET /api/products søger i Postgres som før.

const MEILI_URL = (process.env.MEILI_URL ?? "").replace(/\/$/, "");
const MEILI_KEY = process.env.MEILI_MASTER_KEY ?? "";

export const PRODUCT_INDEX = "products";

// Efter en fejl springes søgemotoren over et stykke tid, så hver søgning ikke
// venter på en timeout, mens den er nede.
const BACKOFF_MS = 30_000;
let downUntil = 0;

export function meiliConfigured() {
  return Boolean(MEILI_URL);
}

export function meiliAvailable() {
  return meiliConfigured() && Date.now() >= downUntil;
}

export async function meiliRequest<T>(
  path: string,
  init: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  if (!MEILI_URL) throw new Error("MEILI_URL er ikke sat");
  try {
    const res = await fetch(`${MEILI_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(MEILI_KEY ? { Authorization: `Bearer ${MEILI_KEY}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(init.timeoutMs ?? 2_000),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const error = new Error(`Meilisearch ${res.status} ${path}: ${text.slice(0, 300)}`) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }
    downUntil = 0;
    return (await res.json()) as T;
  } catch (error) {
    // 404 (fx indekset findes ikke endnu) betyder ikke, at søgemotoren er nede.
    if ((error as { status?: number }).status !== 404) downUntil = Date.now() + BACKOFF_MS;
    throw error;
  }
}

export type MeiliHit = { id: string; score: number };

type SearchResponse = { hits: Array<{ id: string; _rankingScore?: number }>; estimatedTotalHits?: number };

// Søger i vareindekset. matchingStrategy "all": alle ord skal findes (med
// stavefejl, sammensatte ord og præfiks for det sidste ord). Giver det intet,
// søges med "last", hvor de sidste ord droppes ét ad gangen, så brugeren ser
// det nærmeste i stedet for en tom liste. fullMatch fortæller, hvilken af dem
// der gav svaret (bruges i søgestatistikken). null = søgemotoren svarede ikke.
export async function searchProductIndex(
  query: string,
  limit: number,
): Promise<{ hits: MeiliHit[]; fullMatch: boolean } | null> {
  if (!meiliAvailable()) return null;
  const run = async (matchingStrategy: "all" | "last") => {
    const data = await meiliRequest<SearchResponse>(`/indexes/${PRODUCT_INDEX}/search`, {
      method: "POST",
      body: { q: query, limit, matchingStrategy, attributesToRetrieve: ["id"], showRankingScore: true },
      timeoutMs: 1_500,
    });
    return data.hits.map((hit) => ({ id: hit.id, score: hit._rankingScore ?? 0 }));
  };
  try {
    const all = await run("all");
    if (all.length > 0 || query.trim().split(/\s+/).length < 2) return { hits: all, fullMatch: all.length > 0 };
    return { hits: await run("last"), fullMatch: false };
  } catch (error) {
    console.error("Meilisearch search failed, falling back to Postgres", error);
    return null;
  }
}
