"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ProductResultRow as ResultRow, type ProductResult as Result } from "@/components/ProductResultRow";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SearchCorrectionNotice } from "@/components/hf/SearchCorrectionNotice";
import { readSearchCorrection, type SearchCorrection } from "@/lib/search-notice";
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

// Højst tre rækker pr. liste, til brugeren folder hele listen ud.
const COLLAPSED_ROWS = 3;
// Så mange forskellige varer hentes til "Senest tilføjet" (var 5, før listen kunne foldes ud).
const RECENT_LIMIT = 30;

/**
 * Liste med fast overskrift. Over tre rækker vises en foldepil; udfoldet fylder
 * listen hele rullefladen under søgefeltet, og overskriften klistrer til toppen,
 * så man altid kan folde den sammen igen.
 */
function CollapsibleSection({
  title,
  total,
  open,
  onToggle,
  children,
}: {
  title: string;
  total: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const canFold = total > COLLAPSED_ROWS;
  const ref = useRef<HTMLElement>(null);
  const toggle = () => {
    onToggle();
    // Udfoldet liste starter med sin overskrift øverst under søgefeltet.
    requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "start" }));
  };
  return (
    <section ref={ref} className="flex flex-col" style={open ? { minHeight: "100%" } : undefined}>
      <div className="sticky top-0 z-10 bg-hf-cream py-2">
        {canFold ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="hf-type-small hf-type-strong text-hf-black flex items-center gap-1"
          >
            {title}
            <IconChevronDown
              size={18}
              aria-hidden="true"
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        ) : (
          <p className="hf-type-small hf-type-strong text-hf-black">{title}</p>
        )}
      </div>
      <div className="overflow-hidden bg-hf-tan rounded-card">{children}</div>
    </section>
  );
}

function SoegContent() {
  const { t } = useTranslation();
  const connectionMessage = useConnectionMessage();
  const searchParams = useSearchParams();
  const forDish = searchParams.get("for") === "ret";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [resultsState, setResultsState] = useState<LoadState>("loading");
  const [fromCache, setFromCache] = useState(false);
  const [correction, setCorrection] = useState<SearchCorrection | null>(null);
  const [exactFor, setExactFor] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<Result[]>([]);
  const [favorites, setFavorites] = useState<Result[]>([]);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
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
          `/api/products?q=${encodeURIComponent(query)}${exactFor === query ? "&exact=1" : ""}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("offline");
        const data = await res.json();
        const mapped: Result[] = data.products.map(
            (p: {
              id: string;
              name: string;
              searchTitle?: string;
              imageUrl?: string | null;
              kcalPer100g?: number;
              brand?: { name: string } | null;
              nutrientSources?: unknown;
              nutritionMissing?: boolean;
            }) => ({
              id: p.id,
              // Brand og subbrand står forrest i titlen, så ikke igen i undertitlen.
              title: p.searchTitle ?? p.name,
              image: p.imageUrl,
              brand: p.searchTitle ? null : (p.brand?.name ?? null),
              kcal: p.kcalPer100g,
              macrosEstimated: hasEstimatedMacros(p.nutrientSources),
              nutritionMissing: p.nutritionMissing === true,
            })
        );
        setResults(mapped);
        const info = readSearchCorrection(data, query);
        setCorrection(info);
        // Rettede/foreslåede svar gemmes ikke offline under den skrevne tekst.
        if (!info) saveSearchResults(query, mapped);
        setFromCache(false);
        setResultsState("ready");
      } catch {
        if (controller.signal.aborted) return;
        // Ingen forbindelse: vis gemte resultater fra tidligere søgninger.
        const cached = findCachedSearch(query);
        if (cached) {
          setResults(cached);
          setFromCache(true);
          setCorrection(null);
          setResultsState("ready");
          return;
        }
        setFromCache(false);
        setCorrection(null);
        setResultsState("error");
        setResults([]);
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query, exactFor]);

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
          if (recent.length >= RECENT_LIMIT) break;
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
      <div className="web-search-page flex h-full min-h-0 flex-col">
        <div className="px-[var(--hf-gutter)] pb-[var(--hf-space-block)] pt-[var(--hf-space-block)]">
          <div className="hf-search">
            <IconSearch size={16} color="var(--hf-black)" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.searchPlaceholder")}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[var(--hf-space-block)] overflow-y-auto overscroll-contain px-[var(--hf-gutter)] pb-[var(--hf-space-section)]">
        {showFavorites && (
          <CollapsibleSection
            title={t("search.favorites")}
            total={favorites.length}
            open={favoritesOpen}
            onToggle={() => setFavoritesOpen((v) => !v)}
          >
            {(favoritesOpen ? favorites : favorites.slice(0, COLLAPSED_ROWS)).map((r) => (
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
          </CollapsibleSection>
        )}

        {showRecentlyAdded && (
          <CollapsibleSection
            title={t("search.recentlyAdded")}
            total={recentlyAdded.length}
            open={recentOpen}
            onToggle={() => setRecentOpen((v) => !v)}
          >
            {(recentOpen ? recentlyAdded : recentlyAdded.slice(0, COLLAPSED_ROWS)).map((r) => (
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
          </CollapsibleSection>
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
              {resultsState === "ready" && correction?.forQuery === query && (
                <div className="px-4 pt-3">
                  <SearchCorrectionNotice
                    correction={correction}
                    onSearchExact={() => setExactFor(query)}
                    onUseSuggestion={setQuery}
                  />
                </div>
              )}
              {resultsState === "ready" && fromCache && results.length > 0 && (
                <p className="hf-type-caption text-text-secondary px-4 pt-3 text-center">{t("offline.cachedResults")}</p>
              )}
              {resultsState === "ready" && results.map((r) => (
                <ResultRow
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  image={r.image}
                  brand={r.brand}
                  kcal={r.kcal}
                  macrosEstimated={r.macrosEstimated}
                  nutritionMissing={r.nutritionMissing}
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
