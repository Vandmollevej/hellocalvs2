"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconBookmark, IconBookmarkFilled, IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

type Result = { id: string; title: string; image?: string | null };

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

function ResultRow({
  id,
  title,
  image,
  forDish,
  t,
  isFavorite,
  onToggleFavorite,
}: Result & {
  forDish: boolean;
  t: (key: string) => string;
  isFavorite: boolean;
  onToggleFavorite: (id: string, next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-hf-tan-dark last:border-b-0">
      <div className="h-10 w-10 flex-shrink-0">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-contain" />
        )}
      </div>
      <span className="flex-1 text-[15px] font-medium text-hf-black">{title}</span>
      <button
        type="button"
        onClick={() => onToggleFavorite(id, !isFavorite)}
        aria-label={t(isFavorite ? "search.removeFavorite" : "search.addFavorite")}
        className="flex-shrink-0 text-hf-green"
      >
        {isFavorite ? <IconBookmarkFilled size={20} /> : <IconBookmark size={20} />}
      </button>
      <Link
        href={forDish ? `/add/${id}?for=ret` : `/add/${id}`}
        className="hf-btn-primary px-4 py-1.5 text-xs"
      >
        {t("search.add")}
      </Link>
    </div>
  );
}

function SoegContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const forDish = searchParams.get("for") === "ret";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [resultsState, setResultsState] = useState<LoadState>("loading");
  const [recentlyAdded, setRecentlyAdded] = useState<Result[]>([]);
  const [favorites, setFavorites] = useState<Result[]>([]);
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
    // Tomt søgefelt: vis intet resultat-afsnit (Favoritter/Senest anvendte
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
        setResults(
          data.products.map((p: { id: string; name: string; imageUrl?: string | null }) => ({
            id: p.id,
            title: p.name,
            image: p.imageUrl,
          }))
        );
        setResultsState("ready");
      } catch {
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
      })
      .catch(() => setRecentlyAdded([]));

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
        setFavorites(
          data.favorites
            .filter((favorite) => favorite.product)
            .map((favorite) => ({
              id: favorite.product!.id,
              title: favorite.product!.name,
              image: favorite.product!.imageUrl,
            }))
        );
      })
      .catch(() => setFavorites([]));

    return () => controller.abort();
  }, []);

  const showFavorites = useMemo(() => !query.trim() && favorites.length > 0, [query, favorites]);
  const showRecentlyAdded = useMemo(() => !query.trim() && recentlyAdded.length > 0, [query, recentlyAdded]);

  return (
    <HfScreen title={t("search.title")}>
      <div className="flex flex-col gap-3.5 p-4">
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
            <p className="text-xs font-bold text-hf-black">{t("search.favorites")}</p>
            <div className="overflow-hidden rounded-[8px] bg-hf-tan">
              {favorites.map((r) => (
                <ResultRow
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  image={r.image}
                  forDish={forDish}
                  t={t}
                  isFavorite={favoriteIds.has(r.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </>
        )}

        {showRecentlyAdded && (
          <>
            <p className="text-xs font-bold text-hf-black">{t("search.recentlyAdded")}</p>
            <div className="overflow-hidden rounded-[8px] bg-hf-tan">
              {recentlyAdded.map((r) => (
                <ResultRow
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  image={r.image}
                  forDish={forDish}
                  t={t}
                  isFavorite={favoriteIds.has(r.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </>
        )}

        {!query.trim() && !showFavorites && !showRecentlyAdded && (
          <p className="px-1 text-center text-sm text-hf-black opacity-60">{t("search.emptyState")}</p>
        )}

        {query.trim() && (
          <>
            <p className="text-xs font-bold text-hf-black">{t("search.searchResults")}</p>
            <div className="overflow-hidden rounded-[8px] bg-hf-tan">
              {resultsState === "loading" && (
                <p className="px-4 py-6 text-center text-sm text-hf-black opacity-60">{t("search.searching")}</p>
              )}
              {resultsState === "error" && (
                <p className="px-4 py-6 text-center text-sm text-hf-black opacity-60">
                  {t("foods.loadError")}
                </p>
              )}
              {resultsState === "ready" && results.slice(0, 6).map((r) => (
                <ResultRow
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  image={r.image}
                  forDish={forDish}
                  t={t}
                  isFavorite={favoriteIds.has(r.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
              {resultsState === "ready" && results.length === 0 && (
                <p className="px-4 py-4 text-center text-sm text-hf-black opacity-60">
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
