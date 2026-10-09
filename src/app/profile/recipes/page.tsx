"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconAdjustmentsHorizontal, IconPlus, IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { PremiumBadge } from "@/components/PremiumGate";
import { useIsSerious } from "@/lib/use-subscription-tier";
import {
  activeFilterCount,
  filtersToParams,
  loadRecipeFilters,
  saveRecipeFilters,
  type RecipeFilters,
} from "@/lib/recipe-filters";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { SkeletonScreen } from "@/components/hf/Skeleton";
import { RecipeFilterPanel } from "@/components/recipes/RecipeFilterPanel";
import { RecipeRow, recipeHref, type RecipeRowData as Row } from "@/components/recipes/RecipeRow";

// Indstillinger → Opskrifter (docs/DECISIONS.md 2026-09-24): to faner,
// "Mine retter" (egne retter og favoritter fra delte retter, fra boksen) og
// "Delte retter" (andres delte retter, plus HelloFresh-opskrifter når
// brugeren har slået dem til under Integrationer).

type Tab = "mine" | "shared";
// Kilde-knapperne under søgefeltet: alle retter, eller kun én integration.
type Source = "all" | "users" | "hellofresh" | "valdemarsro";
type LoadState = "loading" | "ready" | "error";
type Translate = (key: string, params?: Record<string, string | number>) => string;

type OwnDish = {
  id: string;
  name: string;
  createdAt: string;
  sharedRecipeId?: string | null;
  images?: string[];
  ingredients: { grams: number; product: { kcalPer100g: number } }[];
};
type FavoriteRecipe = { id: string; name: string; kcal: number };
type SearchResult = {
  kind: "shared" | "hellofresh";
  id: string;
  name: string;
  imageUrl: string | null;
  // Hele retten (delte retter) eller én servering (HelloFresh).
  kcal: number;
  servings: number;
  split: { protein: number; carbs: number; fat: number } | null;
  warnings: { ingredient: string; allergen: string }[];
};

function dishKcal(dish: OwnDish) {
  return Math.round(dish.ingredients.reduce((sum, i) => sum + (i.product.kcalPer100g * i.grams) / 100, 0));
}

// Titelbredder (px) til rækker under hentning, så de ligner rigtige retnavne.
const LOADING_TITLE_WIDTHS = [176, 132, 208, 152, 188];

function LoadingRows({ count }: { count: number }) {
  return (
    <SkeletonScreen className="">
      {Array.from({ length: count }, (_, index) => (
        <RecipeRow
          key={index}
          row={null}
          loadingTitleWidth={LOADING_TITLE_WIDTHS[index % LOADING_TITLE_WIDTHS.length]}
        />
      ))}
    </SkeletonScreen>
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
            imageUrl: dish.images?.[0] ?? null,
            subtitle: t("recipes.kcalTotal", { kcal: dishKcal(dish) }),
            label: dish.sharedRecipeId
              ? { text: t("recipes.statusShared"), tone: "green" as const }
              : { text: t("recipes.statusPrivate"), tone: "muted" as const },
          })),
          ...favorites.map((recipe) => ({
            key: `fav-${recipe.id}`,
            href: recipeHref(recipe.id),
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
      {state === "loading" && <LoadingRows count={4} />}
      {state === "error" && (
        <p className="hf-type-body text-text-secondary py-8 text-center">{t("recipes.loadError")}</p>
      )}
      {state === "ready" && rows.length === 0 && (
        <p className="hf-type-body text-text-secondary py-8 text-center">{t("recipes.mineEmpty")}</p>
      )}
      {state === "ready" && rows.length > 0 && (
        <div>
          {rows.map((row) => (
            <RecipeRow key={row.key} row={row} />
          ))}
        </div>
      )}
      <Link href="/create-dish" className="hf-control hf-btn-secondary w-full">
        {t("recipes.createDish")}
      </Link>
    </div>
  );
}

// Antal retter under "Trender netop nu", før brugeren har søgt.
const TRENDING_COUNT = 3;

type FavoriteSnapshot = { id: string; name: string; kcal: number; images?: string[] };

function SharedTab({ t }: { t: Translate }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<RecipeFilters>(loadRecipeFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [source, setSource] = useState<Source>("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const [helloFresh, setHelloFresh] = useState<boolean | null>(null);
  // Filtre/sortering og HelloFresh (en integration) er kun for Seriøs
  // (docs/DECISIONS.md 2026-09-26); Gratis sorteres altid efter relevans.
  const isSerious = useIsSerious();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [favorites, setFavorites] = useState<FavoriteSnapshot[] | null>(null);
  const searching = query.trim().length > 0;

  // Markøren står i søgefeltet, så snart siden åbnes.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  function updateFilters(next: RecipeFilters) {
    setFilters(next);
    saveRecipeFilters(next);
  }

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => (res.ok ? ((await res.json()) as { user?: { helloFreshEnabled?: boolean } }) : {}))
      .then((data) => setHelloFresh(Boolean(data.user?.helloFreshEnabled)))
      .catch(() => setHelloFresh(false));
    fetch("/api/recipe-favorites")
      .then(async (res) => (res.ok ? ((await res.json()) as { favorites: FavoriteSnapshot[] }).favorites : []))
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, []);

  // Uden søgning hentes de mest populære retter til "Trender netop nu";
  // med søgning hentes resultaterne i den valgte sortering.
  useEffect(() => {
    if (helloFresh === null || isSerious === null) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setState("loading");
      try {
        const params = isSerious ? filtersToParams(filters) : new URLSearchParams({ sort: "relevance" });
        if (query.trim()) params.set("q", query.trim());
        else params.set("sort", "popular");
        if (helloFresh && isSerious) params.set("hellofresh", "1");
        if (source !== "all") params.set("source", source);
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
  }, [query, filters, helloFresh, isSerious, source]);

  const view = filters;
  const activeCount = activeFilterCount(view);

  function subtitleFor(result: SearchResult) {
    if (!view.showKcal) return "";
    const perServing = Math.round(result.kcal / Math.max(1, result.servings));
    return result.kind === "shared" && result.servings > 1
      ? `${t("recipeFilters.kcalPerServing", { kcal: perServing })} · ${t("recipeFilters.servings", { count: result.servings })}`
      : t("recipeFilters.kcalPerServing", { kcal: perServing });
  }

  function extrasFor(result: SearchResult) {
    return {
      warnings: result.warnings.map((w) =>
        t("recipeFilters.warning", {
          ingredient: w.ingredient.toLowerCase(),
          allergen: t(`recipeFilters.allergens.${w.allergen}`).toLowerCase(),
        }),
      ),
      extra: view.showEnergySplit && result.split ? t("recipeFilters.split", result.split) : undefined,
    };
  }

  function rowFor(result: SearchResult): Row {
    return result.kind === "hellofresh"
      ? {
          key: result.id,
          href: recipeHref(result.id),
          name: result.name,
          imageUrl: result.imageUrl,
          subtitle: subtitleFor(result),
          label: { text: t("recipes.helloFresh"), tone: "green" },
          ...extrasFor(result),
        }
      : {
          key: result.id,
          href: `/profile/recipes/${encodeURIComponent(result.id)}?kind=shared`,
          name: result.name,
          imageUrl: result.imageUrl,
          subtitle: subtitleFor(result),
          ...extrasFor(result),
        };
  }

  const status = (text: string) => <p className="hf-type-body text-text-secondary text-center">{text}</p>;
  const trending = results.slice(0, TRENDING_COUNT);
  // HelloFresh er en integration og vises kun, når brugeren har slået den til.
  const sources: { value: Source; label: string }[] = [
    { value: "all", label: t("recipes.sourceAll") },
    { value: "users", label: t("recipes.sourceUsers") },
    ...(helloFresh ? [{ value: "hellofresh" as const, label: t("recipes.helloFresh") }] : []),
    { value: "valdemarsro", label: t("recipes.valdemarsro") },
  ];

  return (
    <div className="hf-page">
      <div className="flex items-center gap-2">
        <div className="hf-search min-w-0 flex-1">
          <IconSearch size={16} color="var(--hf-black)" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("recipes.sharedSearchPlaceholder")}
            className="min-w-0"
          />
        </div>
        {/* Filterikon til højre for søgefeltet, uden ramme (brugerens valg
            2026-09-26); prikken viser, at der er aktive filtre. */}
        {isSerious === false ? (
          <Link
            href="/profile/subscription/serious"
            aria-label={t("premium.filtersLocked")}
            className="flex h-12 shrink-0 items-center"
          >
            <PremiumBadge />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label={t("recipeFilters.openFilters")}
            aria-haspopup="dialog"
            className="relative flex h-12 w-10 shrink-0 items-center justify-center text-hf-black"
          >
            <IconAdjustmentsHorizontal size={26} />
            {activeCount > 0 && (
              <span className="absolute right-0.5 top-2.5 h-2 w-2 rounded-full bg-hf-green" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Kilde-knapper: Alle viser alt; en integration viser kun dens retter. */}
      <div role="group" aria-label={t("recipes.sourceLabel")} className="flex flex-wrap gap-2">
        {sources.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="hf-chip"
            aria-pressed={source === value}
            onClick={() => setSource(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {filtersOpen && (
        <BottomSheet title={t("recipeFilters.title")} size="full" onClose={() => setFiltersOpen(false)}>
          <RecipeFilterPanel filters={filters} onChange={updateFilters} />
        </BottomSheet>
      )}

      {searching ? (
        <>
          {state === "loading" && <LoadingRows count={5} />}
          {state === "error" && status(t("recipes.loadError"))}
          {state === "ready" && results.length === 0 && status(t("recipes.noResults"))}
          {state === "ready" && results.length > 0 && (
            <div>
              {results.map((result) => (
                <RecipeRow key={`${result.kind}-${result.id}`} row={rowFor(result)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <h2 className="hf-type-section-title">{t("recipes.trendingTitle")}</h2>
          {state === "loading" && <LoadingRows count={TRENDING_COUNT} />}
          {state === "error" && status(t("recipes.loadError"))}
          {state === "ready" && trending.length === 0 && status(t("recipes.trendingEmpty"))}
          {state === "ready" && trending.length > 0 && (
            <div>
              {trending.map((result) => (
                <RecipeRow key={`${result.kind}-${result.id}`} row={rowFor(result)} />
              ))}
            </div>
          )}

          <h2 className="hf-type-section-title">{t("recipes.favoritesTitle")}</h2>
          {favorites === null && <LoadingRows count={3} />}
          {favorites?.length === 0 && status(t("recipes.favoritesEmpty"))}
          {favorites && favorites.length > 0 && (
            <div>
              {favorites.map((recipe) => (
                <RecipeRow
                  key={`fav-${recipe.id}`}
                  row={{
                    key: recipe.id,
                    href: recipeHref(recipe.id),
                    name: recipe.name,
                    imageUrl: recipe.images?.[0] ?? null,
                    subtitle: t("recipes.kcalTotal", { kcal: Math.round(recipe.kcal) }),
                  }}
                />
              ))}
            </div>
          )}
        </>
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
            className={`hf-type-small hf-type-strong flex-1 border-b-2 py-3 ${
              tab === value ? "border-hf-black text-hf-black" : "border-transparent text-hf-black opacity-60"
            }`}
          >
            {t(value === "mine" ? "recipes.tabMine" : "recipes.tabShared")}
          </button>
        ))}
      </div>
      <div className="flex justify-end px-4 pt-3">
        <Link href="/create-dish" className="hf-control hf-btn-primary inline-flex items-center gap-1 px-4">
          <IconPlus size={18} aria-hidden="true" />
          {t("recipes.createNewDish")}
        </Link>
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
