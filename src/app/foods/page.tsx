"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconApple, IconSearch } from "@tabler/icons-react";
import { IconFavorite as IconBookmark, IconFavoriteFilled as IconBookmarkFilled } from "@/components/icons/Favorite";
import { HfScreen } from "@/components/HfScreen";
import { FoodRow } from "@/components/FoodRow";
import { ActionLink } from "@/components/hf/ActionButton";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useConnectionMessage } from "@/lib/use-online-status";
import { SkeletonMediaRows, SkeletonScreen } from "@/components/hf/Skeleton";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { useIsClientRender } from "@/lib/use-client-render";
import {
  readFoodsSnapshot,
  writeFoodsSnapshot,
  type FoodsProduct as Product,
  type FoodsSnapshot,
} from "@/lib/foods-snapshot";

// Skelettet vises kun ved allerførste besøg (intet gemt øjebliksbillede) og
// først efter en kort pause, så hurtige svar ikke blinker.
const SKELETON_DELAY_MS = 300;
const SKELETON_ROWS = 3;

// Regional search ranking (2026-09-19, see docs/DECISIONS.md): autosuggest
// starts at 2 typed characters, shows a short-lived cached result instantly
// while a live re-ranked request is in flight, and reports which result was
// opened so future searches can weight it (region×hour click popularity).
const SEARCH_MIN_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 140;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

const searchCache = new Map<string, { expiresAt: number; products: Product[] }>();

function ProductRow({
  product,
  isLast,
  prefillQuery,
  isFavorite,
  onToggleFavorite,
  onOpen,
}: {
  product: Product;
  isLast: boolean;
  prefillQuery: string;
  isFavorite: boolean;
  onToggleFavorite: (id: string, next: boolean) => void;
  onOpen?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={`px-4 ${isLast ? "" : "border-b border-hf-tan-dark"}`}>
      <Link href={`/add/${product.id}${prefillQuery}`} onClick={() => onOpen?.(product.id)} className="block">
        <FoodRow
          image={product.imageUrl}
          title={product.name}
          subtitle={
            <p className="hf-type-small text-text-secondary truncate">
              {[product.brand?.name, t("foods.kcalPer100g", { kcal: Math.round(product.kcalPer100g) })]
                .filter(Boolean)
                .join(" · ")}
            </p>
          }
          right={
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(product.id, !isFavorite);
              }}
              aria-label={t(isFavorite ? "search.removeFavorite" : "search.addFavorite")}
              className="text-hf-green"
            >
              {isFavorite ? <IconBookmarkFilled size={20} /> : <IconBookmark size={20} />}
            </button>
          }
        />
      </Link>
    </div>
  );
}

function MadvarerContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const prefillTime = searchParams.get("time");
  const prefillDate = searchParams.get("date");
  const prefillQuery = (() => {
    const params = new URLSearchParams();
    if (prefillTime) params.set("time", prefillTime);
    if (prefillDate) params.set("date", prefillDate);
    const query = params.toString();
    return query ? `?${query}` : "";
  })();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sidste liste for den aktive profil tegnes med det samme (også ved klik i
  // bundmenuen), og den friske fra serveren erstatter den stille — ingen
  // skelet-bokse før indholdet ved hvert besøg.
  const { status: familyStatus } = useFamilyStatus();
  const activeProfileId = familyStatus?.activeProfile.id ?? null;
  const isClientRender = useIsClientRender();
  const cachedSnapshot = useMemo(
    () => (isClientRender && activeProfileId ? readFoodsSnapshot(activeProfileId) : null),
    [isClientRender, activeProfileId]
  );
  const [loadedSnapshot, setLoadedSnapshot] = useState<FoodsSnapshot | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const connectionMessage = useConnectionMessage();
  const snapshot =
    loadedSnapshot && (!activeProfileId || loadedSnapshot.profileId === activeProfileId)
      ? loadedSnapshot
      : cachedSnapshot;
  const [skeletonDue, setSkeletonDue] = useState(false);
  const waiting = snapshot === null && !loadFailed;

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => setSkeletonDue(true), SKELETON_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        // Varer og bogmærker hentes samlet, så rækkerne ikke først tegnes
        // med tomme bogmærker, der derefter fyldes ud.
        const [productsResponse, favoritesResponse] = await Promise.all([
          fetch("/api/products/most-used", { signal: controller.signal }),
          fetch("/api/favorites", { signal: controller.signal }).catch(() => null),
        ]);
        if (!productsResponse.ok) throw new Error("Kunne ikke hente madvarer");
        const data = (await productsResponse.json()) as { profileId: string; products: Product[] };

        let favoriteIds: string[] | null = null;
        if (favoritesResponse?.ok) {
          const favoritesData = (await favoritesResponse.json()) as {
            favorites: Array<{ product: { id: string } | null }>;
          };
          favoriteIds = favoritesData.favorites.flatMap((favorite) => (favorite.product ? [favorite.product.id] : []));
        }

        const next: FoodsSnapshot = {
          profileId: data.profileId,
          products: data.products,
          favoriteIds: favoriteIds ?? readFoodsSnapshot(data.profileId)?.favoriteIds ?? [],
        };
        setLoadedSnapshot(next);
        writeFoodsSnapshot(next);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setLoadFailed(true);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  const favoriteIds = useMemo(() => new Set(snapshot?.favoriteIds ?? []), [snapshot]);

  function toggleFavorite(productId: string, next: boolean) {
    if (snapshot) {
      const ids = new Set(snapshot.favoriteIds);
      if (next) ids.add(productId);
      else ids.delete(productId);
      const updated = { ...snapshot, favoriteIds: [...ids] };
      setLoadedSnapshot(updated);
      writeFoodsSnapshot(updated);
    }
    fetch("/api/favorites", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    }).catch(() => {});
  }

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const normalizedQuery = query.trim();
  const isSearching = normalizedQuery.length >= SEARCH_MIN_LENGTH;

  // Cached results for the current query render instantly (no setState —
  // this is a plain derived read of the module-level cache), while the
  // effect below revalidates live and only calls setState from its
  // asynchronous fetch callback.
  // Freshness (TTL) is only checked where a timestamp read is allowed to be
  // impure — inside the effect below, not here. A render past its TTL is
  // corrected within SEARCH_DEBOUNCE_MS by the live revalidation anyway.
  const cachedResults = useMemo(() => {
    if (normalizedQuery.length < SEARCH_MIN_LENGTH) return null;
    return searchCache.get(normalizedQuery.toLocaleLowerCase())?.products ?? null;
  }, [normalizedQuery]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < SEARCH_MIN_LENGTH) return;

    const cacheKey = q.toLocaleLowerCase();
    const hadCacheHit = searchCache.has(cacheKey);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const hour = new Date().getHours();
        const response = await fetch(
          `/api/products?q=${encodeURIComponent(q)}&hour=${hour}&take=20`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("search failed");
        const data = (await response.json()) as { products: Product[] };
        searchCache.set(cacheKey, {
          expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
          products: data.products,
        });
        setSearchResults(data.products);
      } catch (error) {
        if ((error as Error).name !== "AbortError" && !hadCacheHit) {
          setSearchResults([]);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function trackSearchClick(productId: string) {
    if (query.trim().length < SEARCH_MIN_LENGTH) return;
    const payload = JSON.stringify({
      productId,
      localHour: new Date().getHours(),
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/products/search-event", new Blob([payload], { type: "application/json" }));
      return;
    }

    void fetch("/api/products/search-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  }

  const favorites = snapshot?.products ?? [];
  const ready = snapshot !== null;

  // Below the minimum, `searchResults` may still hold the last real query's
  // results — masked here rather than reset from an effect body (avoids a
  // synchronous setState-in-effect; the state is simply irrelevant while
  // isSearching is false and gets overwritten by the next real query anyway).
  // While searching, prefer the cached instant result until the live,
  // re-ranked fetch for this exact query has actually landed.
  const visibleProducts = isSearching ? cachedResults ?? searchResults : favorites;

  return (
    <HfScreen title={t("foods.title")} icon={<IconApple size={20} stroke={2} />}>
      <div className="hf-page">
        <div className="hf-search">
          <IconSearch size={16} color="var(--hf-black)" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("foods.searchPlaceholder")}
          />
        </div>

        {!isSearching && ready && favorites.length > 0 && (
          <p className="hf-type-small hf-type-strong text-text-secondary px-1 uppercase tracking-[0.08em]">
            {t("foods.mostUsed")}
          </p>
        )}

        <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-[8px] bg-hf-tan">
          {waiting && skeletonDue && (
            <SkeletonScreen className="px-4">
              <SkeletonMediaRows rows={SKELETON_ROWS} />
            </SkeletonScreen>
          )}
          {!ready && loadFailed && (
            <p className="hf-type-body text-text-secondary px-4 py-8 text-center">
              {connectionMessage(t("foods.loadError"))}
            </p>
          )}
          {ready &&
            visibleProducts.map((product, index) => (
              <ProductRow
                key={product.id}
                product={product}
                isLast={index === visibleProducts.length - 1}
                prefillQuery={prefillQuery}
                isFavorite={favoriteIds.has(product.id)}
                onToggleFavorite={toggleFavorite}
                onOpen={isSearching ? trackSearchClick : undefined}
              />
            ))}
          {ready && visibleProducts.length === 0 && (
            <p className="hf-type-body text-text-secondary px-4 py-8 text-center">
              {isSearching ? t("foods.noSearchMatches") : t("foods.noFavoritesYet")}
            </p>
          )}
        </div>

        <ActionLink href="/camera?mode=product" variant="secondary" className="hf-type-small px-4 py-2">
          {t("foods.scanNewProduct")}
        </ActionLink>
      </div>
    </HfScreen>
  );
}

export default function FoodsPage() {
  return (
    <Suspense fallback={null}>
      <MadvarerContent />
    </Suspense>
  );
}
