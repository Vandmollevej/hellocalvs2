"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChevronRight, IconSearch, IconSoup } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

// Indstillinger → Opskrifter (docs/DECISIONS.md 2026-09-24): to faner,
// "Mine retter" (egne retter og favoritter fra delte retter, fra boksen) og
// "Søg i delte retter" (andres delte retter, plus HelloFresh-opskrifter når
// brugeren har slået dem til under Integrationer).

type Tab = "mine" | "shared";
type Sort = "relevance" | "popular" | "date";
type LoadState = "loading" | "ready" | "error";
type Translate = (key: string, params?: Record<string, string | number>) => string;

type OwnDish = {
  id: string;
  name: string;
  createdAt: string;
  sharedRecipeId?: string | null;
  ingredients: { grams: number; product: { kcalPer100g: number } }[];
};
type FavoriteRecipe = { id: string; name: string; kcal: number };
type SearchResult = {
  kind: "shared" | "hellofresh";
  id: string;
  name: string;
  imageUrl: string | null;
  kcal: number;
};

type Row = {
  key: string;
  href: string;
  name: string;
  imageUrl: string | null;
  subtitle: string;
  label?: { text: string; tone: "green" | "muted" };
};

function dishKcal(dish: OwnDish) {
  return Math.round(dish.ingredients.reduce((sum, i) => sum + (i.product.kcalPer100g * i.grams) / 100, 0));
}

function RecipeRow({ row }: { row: Row }) {
  return (
    <Link href={row.href} className="flex items-center gap-3 border-b border-hf-tan-dark py-2.5 last:border-b-0">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-hf-tan text-hf-black">
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <IconSoup size={20} className="opacity-50" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-hf-black">{row.name}</p>
        <p className="text-[12px] text-hf-black opacity-60">
          {row.subtitle}
          {row.label && (
            <span className={`ml-2 font-semibold ${row.label.tone === "green" ? "text-hf-green" : "text-hf-black"}`}>
              {row.label.text}
            </span>
          )}
        </p>
      </div>
      <IconChevronRight size={18} className="shrink-0 text-hf-black" />
    </Link>
  );
}

function MineTab({ t }: { t: Translate }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    Promise.all([fetch("/api/dishes"), fetch("/api/recipe-favorites")])
      .then(async ([dishesRes, favoritesRes]) => {
        if (!dishesRes.ok) throw new Error("offline");
        const { dishes } = (await dishesRes.json()) as { dishes: OwnDish[] };
        const favorites = favoritesRes.ok
          ? ((await favoritesRes.json()) as { favorites: FavoriteRecipe[] }).favorites
          : [];
        setRows([
          ...dishes.map((dish) => ({
            key: `own-${dish.id}`,
            href: `/profile/recipes/${encodeURIComponent(dish.id)}?kind=own`,
            name: dish.name,
            imageUrl: null,
            subtitle: t("recipes.kcalTotal", { kcal: dishKcal(dish) }),
            label: dish.sharedRecipeId
              ? { text: t("recipes.statusShared"), tone: "green" as const }
              : { text: t("recipes.statusPrivate"), tone: "muted" as const },
          })),
          ...favorites.map((recipe) => ({
            key: `fav-${recipe.id}`,
            href: `/profile/recipes/${encodeURIComponent(recipe.id)}?kind=shared`,
            name: recipe.name,
            imageUrl: null,
            subtitle: t("recipes.kcalTotal", { kcal: Math.round(recipe.kcal) }),
            label: { text: t("recipes.statusFavorite"), tone: "muted" as const },
          })),
        ]);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [t]);

  return (
    <div className="hf-page">
      {state === "loading" && (
        <p className="py-8 text-center text-sm text-hf-black opacity-60">{t("recipes.loading")}</p>
      )}
      {state === "error" && (
        <p className="py-8 text-center text-sm text-hf-black opacity-60">{t("recipes.loadError")}</p>
      )}
      {state === "ready" && rows.length === 0 && (
        <p className="py-8 text-center text-sm text-hf-black opacity-60">{t("recipes.mineEmpty")}</p>
      )}
      {state === "ready" && rows.length > 0 && (
        <div>
          {rows.map((row) => (
            <RecipeRow key={row.key} row={row} />
          ))}
        </div>
      )}
      <Link href="/create-dish" className="hf-btn-secondary w-full py-3 text-[14px]">
        {t("recipes.createDish")}
      </Link>
    </div>
  );
}

const SORTS: { value: Sort; key: string }[] = [
  { value: "relevance", key: "recipes.sortRelevance" },
  { value: "popular", key: "recipes.sortPopular" },
  { value: "date", key: "recipes.sortDate" },
];

function SharedTab({ t }: { t: Translate }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("relevance");
  const [helloFresh, setHelloFresh] = useState<boolean | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => (res.ok ? ((await res.json()) as { user?: { helloFreshEnabled?: boolean } }) : {}))
      .then((data) => setHelloFresh(Boolean(data.user?.helloFreshEnabled)))
      .catch(() => setHelloFresh(false));
  }, []);

  useEffect(() => {
    if (helloFresh === null) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setState("loading");
      try {
        const params = new URLSearchParams({ sort });
        if (query.trim()) params.set("q", query.trim());
        if (helloFresh) params.set("hellofresh", "1");
        const res = await fetch(`/api/shared-recipes?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error("offline");
        setResults(((await res.json()) as { recipes: SearchResult[] }).recipes);
        setState("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState("error");
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query, sort, helloFresh]);

  return (
    <div className="hf-page hf-page--list">
      <div className="hf-search">
        <IconSearch size={16} color="var(--hf-black)" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("recipes.sharedSearchPlaceholder")}
        />
      </div>

      {/* Små sorteringsknapper (brugerens valg 2026-09-23): ca. 18 px synlig
          højde og 11 px tekst; usynligt udvidet trykområde. */}
      <div className="flex justify-end gap-1">
        {SORTS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setSort(option.value)}
            aria-pressed={sort === option.value}
            className={`relative rounded-[4px] border px-1.5 py-px text-[11px] leading-[14px] after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] ${
              sort === option.value
                ? "border-hf-black bg-hf-tan font-semibold text-hf-black"
                : "border-hf-gray-light bg-hf-white text-hf-black opacity-70"
            }`}
          >
            {t(option.key)}
          </button>
        ))}
      </div>

      {state === "loading" && (
        <p className="py-8 text-center text-sm text-hf-black opacity-60">{t("recipes.loading")}</p>
      )}
      {state === "error" && (
        <p className="py-8 text-center text-sm text-hf-black opacity-60">{t("recipes.loadError")}</p>
      )}
      {state === "ready" && results.length === 0 && (
        <p className="py-8 text-center text-sm text-hf-black opacity-60">{t("recipes.noResults")}</p>
      )}
      {state === "ready" && results.length > 0 && (
        <div>
          {results.map((result) => (
            <RecipeRow
              key={`${result.kind}-${result.id}`}
              row={
                result.kind === "hellofresh"
                  ? {
                      key: result.id,
                      href: `/add/${encodeURIComponent(result.id)}`,
                      name: result.name,
                      imageUrl: result.imageUrl,
                      subtitle: t("recipes.kcalServing", { kcal: result.kcal }),
                      label: { text: t("recipes.helloFresh"), tone: "green" },
                    }
                  : {
                      key: result.id,
                      href: `/profile/recipes/${encodeURIComponent(result.id)}?kind=shared`,
                      name: result.name,
                      imageUrl: null,
                      subtitle: t("recipes.kcalTotal", { kcal: result.kcal }),
                    }
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecipesContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "mine" ? "mine" : "shared";

  function selectTab(next: Tab) {
    router.replace(`/profile/recipes?tab=${next}`);
  }

  return (
    <HfScreen title={t("recipes.title")}>
      <div role="tablist" className="flex border-b border-hf-tan-dark">
        {(["mine", "shared"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => selectTab(value)}
            className={`flex-1 border-b-2 py-3 text-[13px] font-semibold ${
              tab === value ? "border-hf-black text-hf-black" : "border-transparent text-hf-black opacity-60"
            }`}
          >
            {t(value === "mine" ? "recipes.tabMine" : "recipes.tabShared")}
          </button>
        ))}
      </div>
      {tab === "mine" ? <MineTab t={t} /> : <SharedTab t={t} />}
    </HfScreen>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={null}>
      <RecipesContent />
    </Suspense>
  );
}
