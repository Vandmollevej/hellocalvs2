"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ProductResultRow as ResultRow, type ProductResult as Result } from "@/components/ProductResultRow";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useConnectionMessage } from "@/lib/use-online-status";
import { findCachedSearch, readCache, saveSearchResults, writeCache, type CachedProduct } from "@/lib/offline-cache";
import { hasEstimatedMacros } from "@/lib/nutrients";
import { SkeletonMediaRows, SkeletonScreen } from "@/components/hf/Skeleton";

type Registration = {
  productId: string | null;
  titleSnapshot: string;
  createdAt: string;
  product: { imageUrl: string | null } | null;
};

type FavoriteResponse = {
  favorites: Array<{ id: string; product: { id: string; name: string; imageUrl: string | null } | null }>;
};

type LoadState = "loading" | "ready" | "error";

function SoegContent() {
  const { t } = useTranslation();
  const connectionMessage = useConnectionMessage();
  const searchParams = useSearchParams();
  const forDish = searchParams.get("for") === "ret";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [resultsState, setResultsState] = useState<LoadState>("loading");
  const [fromCache, setFromCache] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<Result[]>([]);
  const [favorites, setFavorites] = useState<Result[]>([]);
  const router = useRouter();
  // Tryk på en vare åbner varesiden direkte — ingen popup og ingen Tilføj-knap.
  const openProduct = (productId: string) => router.push(`/add/${productId}${forDish ? "?for=ret" : ""}`);
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);

  function toggleFavorite(productId: string, next: boolean) {
    if (next) {
      setFavorites((current) => {
        if (current.some((f) => f.id === productId)) return current;
        const source = [...results, ...recentlyAdded].find((r) => r.id === productId);
        return source ? [...current, source] : current;
      });
      fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      }).catch(() => {});
    } else {
      setFavorites((current) => current.filter((f) => f.id !== productId));
      fetch("/api/favorites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      }).catch(() => {});
    }
  }

  useEffect(() => {
    // Tomt søgefelt: vis intet resultat-afsnit (Favoritter/Senest tilføjet
    // dækker den tomme tilstand) — undlader bevidst at kalde /api/products
    // uden søgetekst, jf. Fejlretninger/FEJLLISTE.md #31 ("Alle varer" gav
    // ingen mening som standardvisning).
    if (!query.trim()) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setResultsState("loading");
      try {
        const res = await fetch(
          `/api/products?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("offline");
        const data = await res.json();
        const mapped: Result[] = data.products.map(
            (p: {
              id: string;
              name: string;
              imageUrl?: string | null;
              kcalPer100g?: number;
              brand?: { name: string } | null;
              nutrientSources?: unknown;
            }) => ({
              id: p.id,
              title: p.name,
              image: p.imageUrl,
              brand: p.brand?.name ?? null,
              kcal: p.kcalPer100g,
              macrosEstimated: hasEstimatedMacros(p.nutrientSources),
            })
        );
        setResults(mapped);
        saveSearchResults(query, mapped);
        setFromCache(false);
        setResultsState("ready");
      } catch {
        if (controller.signal.aborted) return;
        // Ingen forbindelse: vis gemte resultater fra tidligere søgninger.
        const cached = findCachedSearch(query);
        if (cached) {
          setResults(cached);
          setFromCache(true);
          setResultsState("ready");
          return;
        }
        setFromCache(false);
        setResultsState("error");
        setResults([]);
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/registrations", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("offline");
        return (await response.json()) as { registrations: Registration[] };
      })
      .then((data) => {
        const seen = new Set<string>();
        const recent: Result[] = [];
        for (const registration of data.registrations) {
          if (!registration.productId || seen.has(registration.productId)) continue;
          seen.add(registration.productId);
          recent.push({
            id: registration.productId,
            title: registration.titleSnapshot,
            image: registration.product?.imageUrl,
          });
          if (recent.length >= 5) break;
        }
        setRecentlyAdded(recent);
        writeCache<CachedProduct[]>("recent", recent);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRecentlyAdded(readCache<CachedProduct[]>("recent")?.data ?? []);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/favorites", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("offline");
        return (await response.json()) as FavoriteResponse;
      })
      .then((data) => {
        const mapped = data.favorites
          .filter((favorite) => favorite.product)
          .map((favorite) => ({
            id: favorite.product!.id,
            title: favorite.product!.name,
            image: favorite.product!.imageUrl,
          }));
        setFavorites(mapped);
        writeCache<CachedProduct[]>("favorites", mapped);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFavorites(readCache<CachedProduct[]>("favorites")?.data ?? []);
      });

    return () => controller.abort();
  }, []);

  const showFavorites = useMemo(() => !query.trim() && favorites.length > 0, [query, favorites]);
  const showRecentlyAdded = useMemo(() => !query.trim() && recentlyAdded.length > 0, [query, recentlyAdded]);

  return (
    <HfScreen title={t("search.title")}>
      <div className="hf-page web-search-page">
        <div className="hf-search">
          <IconSearch size={16} color="var(--hf-black)" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.searchPlaceholder")}
          />
        </div>

        {showFavorites && (
          <>
            <p className="hf-type-small hf-type-strong text-hf-black">{t("search.favorites")}</p>
            <div className="overflow-hidden bg-hf-tan rounded-card">
              {favorites.map((r) => (
                <ResultRow
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  image={r.image}
                  onAdd={openProduct}
                  isFavorite={favoriteIds.has(r.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </>
        )}

        {showRecentlyAdded && (
          <>
            <p className="hf-type-small hf-type-strong text-hf-black">{t("search.recentlyAdded")}</p>
            <div className="overflow-hidden bg-hf-tan rounded-card">
              {recentlyAdded.map((r) => (
                <ResultRow
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  image={r.image}
                  onAdd={openProduct}
                  isFavorite={favoriteIds.has(r.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </>
        )}

        {!query.trim() && !showFavorites && !showRecentlyAdded && (
          <p className="hf-type-body text-text-secondary px-1 text-center">{t("search.emptyState")}</p>
        )}

        {query.trim() && (
          <>
            <p className="hf-type-small hf-type-strong text-hf-black">{t("search.searchResults")}</p>
            <div className="overflow-hidden bg-hf-tan rounded-card">
              {resultsState === "loading" && (
                <SkeletonScreen className="px-4">
                  <SkeletonMediaRows rows={6} />
                </SkeletonScreen>
              )}
              {resultsState === "error" && (
                <p className="hf-type-body text-text-secondary px-4 py-8 text-center">
                  {connectionMessage(t("foods.loadError"))}
                </p>
              )}
              {resultsState === "ready" && fromCache && results.length > 0 && (
                <p className="hf-type-caption text-text-secondary px-4 pt-3 text-center">{t("offline.cachedResults")}</p>
              )}
              {resultsState === "ready" && results.slice(0, 6).map((r) => (
                <ResultRow
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  image={r.image}
                  brand={r.brand}
                  kcal={r.kcal}
                  macrosEstimated={r.macrosEstimated}
                  onAdd={openProduct}
                  isFavorite={favoriteIds.has(r.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
              {resultsState === "ready" && results.length === 0 && (
                <p className="hf-type-body text-text-secondary px-4 py-4 text-center">
                  {t("search.noResults")}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </HfScreen>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SoegContent />
    </Suspense>
  );
}
