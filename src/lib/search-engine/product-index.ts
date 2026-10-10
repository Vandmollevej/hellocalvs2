import { MEAL_KIT_SOURCES } from "@/lib/meal-kit-providers";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { HIDE_FROM_SEARCH_BELOW } from "@/lib/uncertainty-thresholds";
import { meiliConfigured, meiliRequest, PRODUCT_INDEX } from "@/lib/search-engine/meili";
import { clearSearchCache } from "@/lib/search-engine/search-cache";
import { wordSuffixes } from "@/lib/search-text-match";

// Vareindekset i Meilisearch (docs/DECISIONS.md 2026-10-10, "Søgemotor").
// Databasen er stadig kilden: robotten "search-index" sammenligner hvert femte
// minut hver søgbar vare med indekset (en hash af felterne ligger på
// dokumentet) og sender kun ændrede varer og sletninger. Kører i hvilken som
// helst app-proces, uden tilstand i hukommelsen.

// Rækkefølgen er vægtningen: et ord i navnet tæller mere end i varetypen.
// claims = sukkerpåstande ("sukkerfri", "uden tilsat sukker" …, docs/DECISIONS.md
// 2026-10-02); parts = ordendelser, så sidste led i sammensatte ord findes.
const SETTINGS = {
  searchableAttributes: ["name", "namePlural", "brand", "subbrand", "productType", "variant", "flavor", "keywords", "claims", "parts"],
  displayedAttributes: ["id", "h"],
  // exactness før attribute: et helt ord ("mælk" i "Letmælk" via endelserne)
  // vinder over et ord, der kun begynder med søgningen ("Mælkechokolade").
  rankingRules: ["words", "typo", "proximity", "exactness", "attribute"],
  // Stavefejl: ét tegn fra 4 bogstaver ("mælj" → "mælk"), to fra 8.
  // Ingen stavefejl på ordendelserne ("letmælk" må ikke ramme "skummetmælk").
  typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 }, disableOnAttributes: ["parts"] },
  pagination: { maxTotalHits: 1000 },
};

type IndexDocument = {
  id: string;
  name: string;
  namePlural: string | null;
  brand: string | null;
  subbrand: string | null;
  productType: string | null;
  variant: string | null;
  flavor: string | null;
  keywords: string[];
  claims: string[];
  parts: string[];
  h: string;
};

// Samme synlighed som GET /api/products: ikke udgåede, ikke private, ikke
// HelloFresh/Open Food Facts og ikke skjult af en usikker AI-aflæsning.
async function searchableProducts(): Promise<IndexDocument[]> {
  const rows = await prisma.product.findMany({
    where: {
      discontinued: false,
      privateOwnerId: null,
      OR: [{ externalSource: null }, { externalSource: { notIn: [...MEAL_KIT_SOURCES, "OPEN_FOOD_FACTS"] } }],
      NOT: { aiAnalyses: { some: { reviewedAt: null, confidence: { lt: HIDE_FROM_SEARCH_BELOW } } } },
    },
    select: {
      id: true,
      name: true,
      namePlural: true,
      subbrand: true,
      productType: true,
      variant: true,
      flavor: true,
      keywords: true,
      brand: { select: { name: true } },
      filters: { select: { sugarFree: true, noAddedSugar: true, reducedSugar: true, lightSugar: true, lowSugar: true } },
    },
  });
  return rows.map((row) => {
    const doc = {
      id: row.id,
      name: row.name,
      namePlural: row.namePlural,
      brand: row.brand?.name ?? null,
      subbrand: row.subbrand,
      productType: row.productType,
      variant: row.variant,
      flavor: row.flavor,
      keywords: row.keywords,
      claims: row.filters
        ? [row.filters.sugarFree, row.filters.noAddedSugar, row.filters.reducedSugar, row.filters.lightSugar, row.filters.lowSugar].filter(
            (claim): claim is string => Boolean(claim),
          )
        : [],
      parts: wordSuffixes([row.name, row.namePlural, row.productType, row.subbrand, row.variant, row.flavor]),
    };
    return { ...doc, h: createHash("sha1").update(JSON.stringify(doc)).digest("hex").slice(0, 16) };
  });
}

// Synonymer fra admin → Søgesynonymer (lighed ≥ 50 %) begge veje.
async function synonymSettings(): Promise<Record<string, string[]>> {
  const rows = await prisma.searchSynonym.findMany({ where: { similarity: { gte: 50 } } });
  const map = new Map<string, Set<string>>();
  const add = (from: string, to: string) => {
    if (!from || !to || from === to) return;
    if (!map.has(from)) map.set(from, new Set());
    map.get(from)!.add(to);
  };
  for (const row of rows) {
    add(row.termA, row.termB);
    add(row.termB, row.termA);
  }
  return Object.fromEntries([...map].map(([term, set]) => [term, [...set].sort()]));
}

type Task = { taskUid: number };

async function waitForTask(task: Task, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await meiliRequest<{ status: string; error?: { message?: string } }>(`/tasks/${task.taskUid}`);
    if (status.status === "succeeded") return;
    if (status.status === "failed" || status.status === "canceled") {
      throw new Error(`Meilisearch-opgave ${task.taskUid} fejlede: ${status.error?.message ?? status.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Meilisearch-opgave ${task.taskUid} blev ikke færdig`);
}

async function ensureIndex() {
  try {
    await meiliRequest(`/indexes/${PRODUCT_INDEX}`);
  } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error;
    await waitForTask(await meiliRequest<Task>("/indexes", { method: "POST", body: { uid: PRODUCT_INDEX, primaryKey: "id" } }));
  }
}

// JSON med sorterede nøgler (og sorterede synonymlister), så rækkefølgen i
// Meilisearch' svar ikke ligner en ændring.
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

async function syncSettings(): Promise<boolean> {
  const wanted = { ...SETTINGS, synonyms: await synonymSettings() };
  const current = await meiliRequest<Record<string, unknown>>(`/indexes/${PRODUCT_INDEX}/settings`);
  const changed = Object.entries(wanted).some(([key, value]) => {
    const have = current[key];
    if (key === "typoTolerance" || key === "pagination") {
      return Object.entries(value as Record<string, unknown>).some(
        ([sub, v]) => stableJson((have as Record<string, unknown> | undefined)?.[sub]) !== stableJson(v),
      );
    }
    return stableJson(have) !== stableJson(value);
  });
  if (!changed) return false;
  await waitForTask(await meiliRequest<Task>(`/indexes/${PRODUCT_INDEX}/settings`, { method: "PATCH", body: wanted, timeoutMs: 10_000 }), 600_000);
  return true;
}

async function indexedHashes(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const limit = 5_000;
  for (let offset = 0; ; offset += limit) {
    const page = await meiliRequest<{ results: Array<{ id: string; h?: string }>; total: number }>(
      `/indexes/${PRODUCT_INDEX}/documents?fields=id,h&limit=${limit}&offset=${offset}`,
      { timeoutMs: 30_000 },
    );
    for (const doc of page.results) out.set(doc.id, doc.h ?? "");
    if (page.results.length < limit) break;
  }
  return out;
}

const BATCH = 5_000;

export async function syncProductIndex(): Promise<{ message: string; count: number }> {
  if (!meiliConfigured()) return { message: "Søgemotoren er ikke sat op (MEILI_URL mangler); søgningen bruger Postgres", count: 0 };
  await ensureIndex();
  const settingsChanged = await syncSettings();
  const [docs, indexed] = await Promise.all([searchableProducts(), indexedHashes()]);

  const changed = docs.filter((doc) => indexed.get(doc.id) !== doc.h);
  const wantedIds = new Set(docs.map((doc) => doc.id));
  const removed = [...indexed.keys()].filter((id) => !wantedIds.has(id));

  for (let i = 0; i < changed.length; i += BATCH) {
    await waitForTask(
      await meiliRequest<Task>(`/indexes/${PRODUCT_INDEX}/documents`, { method: "POST", body: changed.slice(i, i + BATCH), timeoutMs: 60_000 }),
      600_000,
    );
  }
  for (let i = 0; i < removed.length; i += BATCH) {
    await waitForTask(
      await meiliRequest<Task>(`/indexes/${PRODUCT_INDEX}/documents/delete-batch`, { method: "POST", body: removed.slice(i, i + BATCH), timeoutMs: 60_000 }),
      600_000,
    );
  }
  if (changed.length || removed.length || settingsChanged) clearSearchCache();

  return {
    message:
      `${docs.length} søgbare varer; ${changed.length} opdateret, ${removed.length} fjernet i søgemotoren` +
      (settingsChanged ? " (indstillinger/synonymer opdateret)" : ""),
    count: changed.length + removed.length,
  };
}
