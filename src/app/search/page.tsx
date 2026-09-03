"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

type Result = { id: string; title: string; image?: string | null };

type Registration = {
  productId: string | null;
  titleSnapshot: string;
  createdAt: string;
  product: { imageUrl: string | null } | null;
};

type LoadState = "loading" | "ready" | "error";

function ResultRow({ id, title, image, forDish, t }: Result & { forDish: boolean; t: (key: string) => string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-hf-tan-dark last:border-b-0">
      <div className="h-10 w-10 flex-shrink-0">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-contain" />
        )}
      </div>
      <span className="flex-1 text-[15px] font-medium text-hf-black">{title}</span>
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

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
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

        {showRecentlyAdded && (
          <>
            <p className="text-xs font-bold text-hf-black">{t("search.recentlyAdded")}</p>
            <div className="overflow-hidden rounded-[8px] bg-hf-tan">
              {recentlyAdded.map((r) => (
                <ResultRow key={r.id} id={r.id} title={r.title} image={r.image} forDish={forDish} t={t} />
              ))}
            </div>
          </>
        )}

        <p className="text-xs font-bold text-hf-black">
          {query.trim() ? t("search.searchResults") : t("search.allItems")}
        </p>
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
            <ResultRow key={r.id} id={r.id} title={r.title} image={r.image} forDish={forDish} t={t} />
          ))}
          {resultsState === "ready" && results.length === 0 && (
            <p className="px-4 py-4 text-center text-sm text-hf-black opacity-60">
              {t("search.noResults")}
            </p>
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
