"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconApple, IconBookmark, IconBookmarkFilled, IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { FoodRow } from "@/components/FoodRow";
import { ActionLink } from "@/components/hf/ActionButton";
import { useTranslation } from "@/i18n/LocaleProvider";

type Product = {
  id: string;
  name: string;
  imageUrl: string | null;
  kcalPer100g: number;
  brand: { name: string } | null;
};

type Registration = { productId: string | null };

type LoadState = "loading" | "ready" | "error";

const FAVORITES_LIMIT = 10;
// Regional search ranking (2026-09-19, see docs/DECISIONS.md): autosuggest
// starts at 2 typed characters, shows a short-lived cached result instantly
// while a live re-ranked request is in flight, and reports which result was
// opened so future searches can weight it (region×hour click popularity).
const SEARCH_MIN_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 140;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

const searchCache = new Map<string, { expiresAt: number; products: Product[] }>();

function mostUsedProducts(products: Product[], registrations: Registration[]) {
  const countByProductId = new Map<string, number>();
  for (const registration of registrations) {
    if (!registration.productId) continue;
    countByProductId.set(registration.productId, (countByProductId.get(registration.productId) ?? 0) + 1);
  }

  return [...products]
    .filter((product) => countByProductId.has(product.id))
    .sort((a, b) => (countByProductId.get(b.id) ?? 0) - (countByProductId.get(a.id) ?? 0))
    .slice(0, FAVORITES_LIMIT);
}

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
  const [products, setProducts] = useState<Product[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/favorites", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("offline");
        return (await response.json()) as { favorites: Array<{ product: { id: string } | null }> };
      })
      .then((data) => {
        setFavoriteIds(new Set(data.favorites.filter((f) => f.product).map((f) => f.product!.id)));
      })
      .catch(() => setFavoriteIds(new Set()));
    return () => controller.abort();
  }, []);

  function toggleFavorite(productId: string, next: boolean) {
    setFavoriteIds((current) => {
      const updated = new Set(current);
      if (next) updated.add(productId);
      else updated.delete(productId);
      return updated;
    });
    fetch("/api/favorites", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    }).catch(() => {});
  }

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const [productsResponse, registrationsResponse] = await Promise.all([
          fetch("/api/products", { signal: controller.signal }),
          fetch("/api/registrations", { signal: controller.signal }),
        ]);
        if (!productsResponse.ok) throw new Error("Kunne ikke hente madvarer");
        const productsData: { products: Product[] } = await productsResponse.json();
        setProducts(productsData.products);

        if (registrationsResponse.ok) {
          const registrationsData: { registrations: Registration[] } = await registrationsResponse.json();
          setRegistrations(registrationsData.registrations);
        }

        setState("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState("error");
      }
    }

    void loadProducts();
    return () => controller.abort();
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

  const favorites = useMemo(
    () => mostUsedProducts(products, registrations),
    [products, registrations]
  );

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

        {!isSearching && state === "ready" && favorites.length > 0 && (
          <p className="hf-type-small hf-type-strong text-text-secondary px-1 uppercase tracking-[0.08em]">
            {t("foods.mostUsed")}
          </p>
        )}

        <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-[8px] bg-hf-tan">
          {state === "loading" && (
            <p className="hf-type-body text-text-secondary px-4 py-8 text-center">{t("foods.loading")}</p>
          )}
          {state === "error" && (
            <p className="hf-type-body text-text-secondary px-4 py-8 text-center">
              {t("foods.loadError")}
            </p>
          )}
          {state === "ready" &&
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
          {state === "ready" && visibleProducts.length === 0 && (
            <p className="hf-type-body text-text-secondary px-4 py-8 text-center">
              {isSearching ? t("foods.noSearchMatches") : t("foods.noFavoritesYet")}
            </p>
          )}
        </div>

        <ActionLink href="/foods/new" variant="secondary" className="hf-type-small px-4 py-2">
          {t("foods.createManually")}
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
