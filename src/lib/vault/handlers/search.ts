"use client";

// Personlig søgehistorik i boksen (docs/PRIVACY.md; omstøder den
// server-side historik fra docs/DECISIONS.md 2026-09-19).
//
// Serveren rangerer uden personlig historik og returnerer en rankScore pr.
// kandidat. Her lægges den personlige vægt til (samme formel som
// src/lib/product-search-ranking.ts), og listen sorteres igen. Serveren ser
// aldrig, hvad den enkelte bruger har søgt på eller klikket på.

import { json, route } from "@/lib/vault/local-api";
import type { VaultClient } from "@/lib/vault/client";

export const SEARCH_HISTORY = "searchHistory";

type History = { searchCount: number; clickCount: number; lastAt: string };
type Kind = "p" | "i" | "g";

const SAFE_ID = /^[A-Za-z0-9_-]{1,60}$/;

function key(kind: Kind, id: string): string | null {
  return SAFE_ID.test(id) ? `${kind}_${id}` : null;
}

// Samme formel som personalAffinity i src/lib/product-search-ranking.ts.
function affinity(h: History | undefined): number {
  if (!h || (h.searchCount === 0 && h.clickCount === 0)) return 0;
  return Math.min(Math.log1p(h.clickCount * 3 + h.searchCount), 5);
}

// Visninger samles og gemmes samlet, så hvert tastetryk ikke giver en skrivning.
const pendingImpressions = new Map<string, number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function queueImpressions(vault: VaultClient, keys: string[]) {
  for (const k of keys) pendingImpressions.set(k, (pendingImpressions.get(k) ?? 0) + 1);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    const now = new Date().toISOString();
    const entries = Array.from(pendingImpressions, ([id, count]) => {
      const current = vault.get<History>(SEARCH_HISTORY, id);
      return {
        id,
        value: { searchCount: (current?.searchCount ?? 0) + count, clickCount: current?.clickCount ?? 0, lastAt: now },
      };
    });
    pendingImpressions.clear();
    void vault.putMany(SEARCH_HISTORY, entries).catch(() => undefined);
  }, 3000);
}

async function rerank(
  vault: VaultClient,
  url: URL,
  listKey: "products" | "ingredients",
  kind: Kind
): Promise<Response> {
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q || url.searchParams.get("source")) return fetch(url.pathname + url.search);

  const serverUrl = new URL(url.toString());
  serverUrl.searchParams.set("personal", "1");
  const res = await fetch(serverUrl.pathname + serverUrl.search);
  if (!res.ok) return res;
  const data = (await res.json()) as Record<string, unknown> & { personalHistoryWeight?: number | null };
  const items = (data[listKey] as (Record<string, unknown> & { id: string; rankScore?: number })[]) ?? [];
  const weight = data.personalHistoryWeight ?? 0;
  const take = Math.min(Math.max(parseInt(url.searchParams.get("take") ?? "20", 10) || 20, 1), 200);

  const ranked = items
    .map((item, index) => {
      const k = key(kind, item.id);
      const score = (item.rankScore ?? 0) + affinity(k ? vault.get<History>(SEARCH_HISTORY, k) : undefined) * weight;
      return { item, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, take)
    .map(({ item }) => {
      const { rankScore: _rankScore, ...rest } = item;
      void _rankScore;
      return rest;
    });

  queueImpressions(
    vault,
    ranked.map((item) => key(kind, item.id as string)).filter((k): k is string => k !== null)
  );
  const { personalHistoryWeight: _w, ...rest } = data;
  void _w;
  return json({ ...rest, [listKey]: ranked });
}

route("GET", "/api/products", ({ vault, query }) => {
  const url = new URL(`/api/products?${query.toString()}`, window.location.origin);
  return rerank(vault as VaultClient, url, "products", "p");
});

route("GET", "/api/generic-ingredients", ({ vault, query }) => {
  const url = new URL(`/api/generic-ingredients?${query.toString()}`, window.location.origin);
  return rerank(vault as VaultClient, url, "ingredients", "g");
});

// Klik: gemmes i boksen og sendes (uden bruger) videre til serverens
// regionale statistik.
route("POST", "/api/products/search-event", async ({ vault, body }) => {
  const input = (await body()) as Record<string, unknown>;
  const target: [Kind, unknown][] = [
    ["p", input.productId],
    ["i", input.ingredientId],
    ["g", input.genericIngredientId],
  ];
  const hit = target.find(([, id]) => typeof id === "string");
  const k = hit ? key(hit[0], hit[1] as string) : null;
  if (k) {
    const current = vault.get<History>(SEARCH_HISTORY, k);
    await vault.put<History>(SEARCH_HISTORY, k, {
      searchCount: current?.searchCount ?? 0,
      clickCount: (current?.clickCount ?? 0) + 1,
      lastAt: new Date().toISOString(),
    });
  }
  return fetch("/api/products/search-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
});
