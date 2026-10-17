"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconAdjustmentsHorizontal, IconPlus, IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useConnectionMessage } from "@/lib/use-online-status";
import { PremiumBadge } from "@/components/PremiumGate";
import { useIsSerious } from "@/lib/use-subscription-tier";
import {
  activeFilterCount,
  filtersToParams,
  loadRecipeFilters,
  type RecipeFilters,
} from "@/lib/recipe-filters";
import { SkeletonScreen } from "@/components/hf/Skeleton";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { RecipeFiltersBody } from "@/components/recipes/RecipeFiltersBody";
import {
  RecipeCard,
  RecipeCardSkeleton,
  RecipeRow,
  recipeHref,
  type RecipeRowData as Row,
} from "@/components/recipes/RecipeRow";
import { recipeClickKey } from "@/lib/recipe-clicks";
import { isMealKitKey, MEAL_KIT_PROVIDERS, parseRecipeProviders, type MealKitKey } from "@/lib/meal-kit-providers";

// Indstillinger → Opskrifter (docs/DECISIONS.md 2026-09-24): to faner,
// "Mine retter" (egne retter og favoritter fra delte retter, fra boksen) og
// "Delte retter" (andres delte retter, plus retter fra de måltidskasser —
// HelloFresh, RetNemt, BetterFeast — brugeren har slået til under
// Integrationer, docs/DECISIONS.md 2026-10-10).

type Tab = "mine" | "shared";
type LoadState = "loading" | "ready" | "error";
type Translate = (key: string, params?: Record<string, string | number>) => string;

type OwnDish = {
  id: string;
  name: string;
  createdAt: string;
  sharedRecipeId?: string | null;
  shareRejected?: boolean;
  images?: string[];
  ingredients: { grams: number; product: { kcalPer100g: number } }[];
};
type FavoriteRecipe = { id: string; name: string; kcal: number; per100g?: boolean };
type Source = "all" | "shared" | "valdemarsro" | MealKitKey;
type SearchResult = {
  kind: "shared" | "valdemarsro" | MealKitKey;
  id: string;
  name: string;
  imageUrl: string | null;
  // Hele retten (delte retter), én servering (HelloFresh/RetNemt) eller
  // 100 g (per100g, BetterFeast uden portionsvægt).
  kcal: number;
  per100g?: boolean;
  servings: number;
  split: { protein: number; carbs: number; fat: number } | null;
  warnings: { ingredient: string; allergen: string }[];
};

// Kildemærkat og knaptekst pr. måltidskasse (i18n-nøgler).
const MEAL_KIT_LABELS: Record<MealKitKey, { source: string; label: string }> = {
  hellofresh: { source: "recipes.sourceHelloFresh", label: "recipes.helloFresh" },
  retnemt: { source: "recipes.sourceRetnemt", label: "recipes.retnemt" },
  betterfeast: { source: "recipes.sourceBetterfeast", label: "recipes.betterfeast" },
};

// Regel (brugerens krav 2026-10-11): en ret vises aldrig med "0 kcal". Er
// energien 0 eller ukendt, står der ingen kcal-tekst i stedet for et nul.
function favoriteKcalText(t: Translate, recipe: { kcal: number; per100g?: boolean }) {
  const kcal = Math.round(recipe.kcal);
  if (!(kcal > 0)) return "";
  return recipe.per100g ? t("recipeFilters.kcalPer100g", { kcal }) : t("recipes.kcalTotal", { kcal });
}

function dishKcal(dish: OwnDish) {
  return Math.round(dish.ingredients.reduce((sum, i) => sum + (i.product.kcalPer100g * i.grams) / 100, 0));
}

function dishKcalText(t: Translate, dish: OwnDish) {
  const kcal = dishKcal(dish);
  return kcal > 0 ? t("recipes.kcalTotal", { kcal }) : "";
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
  const connectionMessage = useConnectionMessage();
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
            subtitle: dishKcalText(t, dish),
            label: dish.sharedRecipeId
              ? { text: t("recipes.statusShared"), tone: "green" as const }
              : dish.shareRejected
                ? { text: t("recipes.statusNotShared"), tone: "muted" as const }
                : { text: t("recipes.statusPrivate"), tone: "muted" as const },
          })),
          ...favorites.map((recipe) => ({
            key: `fav-${recipe.id}`,
            href: recipeHref(recipe.id),
            name: recipe.name,
            imageUrl: null,
            subtitle: favoriteKcalText(t, recipe),
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
        <p className="hf-type-body text-text-secondary py-8 text-center">{connectionMessage(t("recipes.loadError"))}</p>
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

// "Trender netop nu" er en slider-række med op til 10 retter; serveren
// fylder op med tilfældige, så der altid er mindst tre (DECISIONS 2026-10-10).
const TRENDING_SKELETONS = 3;

// "Alle retter" (brugerens krav 2026-10-17): et gitter under favoritterne,
// sorteret efter popularitet. Der hentes tre rækker ad gangen; flere hentes,
// når man scroller ned (endeløs scroll). Kolonner efter bredden.
const ALL_ROWS_PER_PAGE = 3;

function columnsFor(width: number) {
  if (width >= 720) return 4;
  if (width >= 480) return 3;
  return 2;
}

// Gitterets kolonnetal følger containerens bredde (mobil 2, bredere 3-4).
function useGridColumns() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(() => setColumns(columnsFor(element.clientWidth)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, columns] as const;
}

type AllPage = { key: string; recipes: SearchResult[]; hasMore: boolean; error: boolean };

type FavoriteSnapshot = { id: string; name: string; kcal: number; per100g?: boolean; images?: string[] };

function SharedTab({ t }: { t: Translate }) {
  const connectionMessage = useConnectionMessage();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<RecipeFilters>(loadRecipeFilters);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [source, setSource] = useState<Source>("all");
  // Måltidskasser, brugeren har slået til under Integrationer.
  const [providers, setProviders] = useState<MealKitKey[] | null>(null);
  // Filtre/sortering og måltidskasserne (integrationer) er kun for Seriøs
  // (docs/DECISIONS.md 2026-09-26); Gratis sorteres altid efter relevans.
  const isSerious = useIsSerious();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [favorites, setFavorites] = useState<FavoriteSnapshot[] | null>(null);
  const searching = query.trim().length > 0;
  const [gridRef, gridColumns] = useGridColumns();
  const [allPage, setAllPage] = useState<AllPage>({ key: "", recipes: [], hasMore: false, error: false });
  // Nøglen til den side, der hentes nu (undgår dobbelthentning og gamle svar).
  const allLoadingKey = useRef<string | null>(null);
  const allLatestKey = useRef("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => (res.ok ? ((await res.json()) as { user?: { recipeProviders?: unknown } }) : {}))
      .then((data) => setProviders(parseRecipeProviders(data.user?.recipeProviders)))
      .catch(() => setProviders([]));
    fetch("/api/recipe-favorites")
      .then(async (res) => (res.ok ? ((await res.json()) as { favorites: FavoriteSnapshot[] }).favorites : []))
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, []);

  // Uden søgning hentes de retter med flest nye klik til "Trender netop nu";
  // med søgning hentes resultaterne i den valgte sortering.
  useEffect(() => {
    if (providers === null || isSerious === null) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setState("loading");
      try {
        const params = isSerious ? filtersToParams(filters) : new URLSearchParams({ sort: "relevance" });
        if (query.trim()) params.set("q", query.trim());
        else params.set("trending", "1");
        if (providers.length > 0 && isSerious) params.set("providers", providers.join(","));
        // Integrationsknapperne under søgefeltet: "Opskrifter" viser alle,
        // en enkelt integration viser kun dens retter.
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
  }, [query, filters, providers, isSerious, source]);

  // Fælles parametre til "Alle retter" (uden søgning og trending). Nøglen
  // skifter, når filtre, kilde eller integrationer ændres.
  const allKey =
    providers === null || isSerious === null
      ? ""
      : (() => {
          const params = isSerious ? filtersToParams(filters) : new URLSearchParams({ sort: "relevance" });
          if (providers.length > 0 && isSerious) params.set("providers", providers.join(","));
          if (source !== "all") params.set("source", source);
          return params.toString();
        })();
  const allCurrent = allKey !== "" && allPage.key === allKey;
  const allRecipes = allCurrent ? allPage.recipes : [];
  const allHasMore = allCurrent && allPage.hasMore;
  const allError = allCurrent && allPage.error;
  const allFirstLoading = !allCurrent;

  const loadMoreAll = useCallback(
    async (key: string, offset: number) => {
      if (!key || gridColumns === null || allLoadingKey.current === `${key}@${offset}`) return;
      allLoadingKey.current = `${key}@${offset}`;
      const params = new URLSearchParams(key);
      params.set("offset", String(offset));
      params.set("limit", String(ALL_ROWS_PER_PAGE * gridColumns));
      try {
        const res = await fetch(`/api/shared-recipes?${params.toString()}`);
        if (!res.ok) throw new Error("offline");
        const data = (await res.json()) as { recipes: SearchResult[]; hasMore?: boolean };
        if (allLatestKey.current !== key) return;
        setAllPage((current) => ({
          key,
          recipes: offset === 0 || current.key !== key ? data.recipes : [...current.recipes, ...data.recipes],
          hasMore: Boolean(data.hasMore),
          error: false,
        }));
      } catch {
        if (allLatestKey.current !== key) return;
        setAllPage((current) =>
          current.key === key ? { ...current, hasMore: false, error: true } : { key, recipes: [], hasMore: false, error: true },
        );
      } finally {
        if (allLoadingKey.current === `${key}@${offset}`) allLoadingKey.current = null;
      }
    },
    [gridColumns],
  );

  // Første side, når filtre, kilde eller integrationer ændres.
  const columnsKnown = gridColumns !== null;
  useEffect(() => {
    if (!allKey || !columnsKnown) return;
    allLatestKey.current = allKey;
    const timeout = setTimeout(() => void loadMoreAll(allKey, 0), 200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kun ved nye filtre, ikke ved ny kolonnebredde
  }, [allKey, columnsKnown]);

  // Endeløs scroll: næste tre rækker, når bunden af gitteret nærmer sig.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !allHasMore || searching) return;
    const offset = allRecipes.length;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMoreAll(allKey, offset);
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [allHasMore, allRecipes.length, allKey, loadMoreAll, searching]);

  const sourceOptions: { value: Source; label: string }[] = [
    { value: "all", label: t("recipes.sourceAll") },
    ...MEAL_KIT_PROVIDERS.filter((p) => providers?.includes(p.key)).map((p) => ({
      value: p.key,
      label: t(MEAL_KIT_LABELS[p.key].source),
    })),
    { value: "valdemarsro", label: t("recipes.sourceValdemarsro") },
  ];
  const view = filters;
  const activeCount = activeFilterCount(view);

  function subtitleFor(result: SearchResult) {
    if (!view.showKcal) return "";
    const perServing = Math.round(result.kcal / Math.max(1, result.servings));
    // Aldrig "0 kcal" (se favoriteKcalText); serveren sender dem heller ikke.
    if (!(Math.round(result.kcal) > 0) || !(perServing > 0)) return "";
    if (result.per100g) return t("recipeFilters.kcalPer100g", { kcal: result.kcal });
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
    return result.kind !== "shared"
      ? {
          key: result.id,
          clickKey: recipeClickKey(result.kind, result.id),
          // Valdemarsro-retter åbnes som produktsiden (tilføj + gram, "Gå til
          // opskrift", ingredienser og næring); måltidskasserne har deres egen visning.
          href: result.kind === "valdemarsro" ? `/add/${encodeURIComponent(result.id)}` : recipeHref(result.id),
          name: result.name,
          imageUrl: result.imageUrl,
          subtitle: subtitleFor(result),
          label: {
            text: isMealKitKey(result.kind) ? t(MEAL_KIT_LABELS[result.kind].label) : t("recipes.valdemarsroSource"),
            tone: "green",
          },
          ...extrasFor(result),
        }
      : {
          key: result.id,
          clickKey: recipeClickKey(result.kind, result.id),
          href: `/profile/recipes/${encodeURIComponent(result.id)}?kind=shared`,
          name: result.name,
          imageUrl: result.imageUrl,
          subtitle: subtitleFor(result),
          ...extrasFor(result),
        };
  }

  const status = (text: string) => <p className="hf-type-body text-text-secondary text-center">{text}</p>;
  const trending = results;

  return (
    <div className="hf-page">
      <div className="flex items-center gap-2">
        <div className="hf-search min-w-0 flex-1">
          <IconSearch size={16} color="var(--hf-black)" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("recipes.sharedSearchPlaceholder")}
            className="min-w-0"
            // Markøren står i søgefeltet, så snart man åbner Retter.
            autoFocus
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
            onClick={() => setFilterSheetOpen(true)}
            aria-label={t("recipeFilters.openFilters")}
            className="relative flex h-12 w-10 shrink-0 items-center justify-center text-hf-black"
          >
            <IconAdjustmentsHorizontal size={26} />
            {activeCount > 0 && (
              <span className="absolute right-0.5 top-2.5 h-2 w-2 rounded-full bg-hf-green" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Integrationer under søgefeltet: Opskrifter viser alle, de andre
          viser kun den integrations retter. */}
      <div role="group" aria-label={t("recipes.sourceFilterAria")} className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {sourceOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={source === option.value}
            onClick={() => setSource(option.value)}
            className={`hf-type-small hf-type-strong shrink-0 rounded-full border px-4 py-2 ${
              source === option.value
                ? "border-hf-black bg-hf-black text-hf-white"
                : "border-hf-black bg-hf-white text-hf-black"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {filterSheetOpen && (
        <BottomSheet size="full" title={t("recipes.filtersSheetTitle")} onClose={() => setFilterSheetOpen(false)}>
          <RecipeFiltersBody onChange={setFilters} />
        </BottomSheet>
      )}

      {searching ? (
        <>
          {state === "loading" && <LoadingRows count={5} />}
          {state === "error" && status(connectionMessage(t("recipes.loadError")))}
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
          {view.showTrending && (
            <>
              <h2 className="hf-type-section-title">{t("recipes.trendingTitle")}</h2>
              {state === "loading" && (
                <div className="-mx-4 flex gap-3 overflow-hidden px-4">
                  {Array.from({ length: TRENDING_SKELETONS }, (_, index) => (
                    <RecipeCardSkeleton key={index} />
                  ))}
                </div>
              )}
              {state === "error" && status(connectionMessage(t("recipes.loadError")))}
              {state === "ready" && trending.length === 0 && status(t("recipes.trendingEmpty"))}
              {state === "ready" && trending.length > 0 && (
                <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
                  {trending.map((result) => (
                    <RecipeCard key={`${result.kind}-${result.id}`} row={rowFor(result)} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Favoritter står på én linje som Trender (brugerens krav 2026-10-17). */}
          {view.showFavorites && (
            <>
              <h2 className="hf-type-section-title">{t("recipes.favoritesTitle")}</h2>
              {favorites === null && (
                <div className="-mx-4 flex gap-3 overflow-hidden px-4">
                  {Array.from({ length: TRENDING_SKELETONS }, (_, index) => (
                    <RecipeCardSkeleton key={index} />
                  ))}
                </div>
              )}
              {favorites?.length === 0 && status(t("recipes.favoritesEmpty"))}
              {favorites && favorites.length > 0 && (
                <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
                  {favorites.map((recipe) => (
                    <RecipeCard
                      key={`fav-${recipe.id}`}
                      row={{
                        key: recipe.id,
                        href: recipeHref(recipe.id),
                        name: recipe.name,
                        imageUrl: recipe.images?.[0] ?? null,
                        subtitle: favoriteKcalText(t, recipe),
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <h2 className="hf-type-section-title">{t("recipes.allTitle")}</h2>
          {allError && allRecipes.length === 0 && status(connectionMessage(t("recipes.loadError")))}
          {allCurrent && !allError && allRecipes.length === 0 && status(t("recipes.allEmpty"))}
        </>
      )}
      {/* Gitteret er altid i DOM'en (skjult under søgning), så kolonnebredden kan måles. */}
      <div ref={gridRef} className={searching ? "hidden" : ""}>
        <div
          className="grid gap-x-3 gap-y-4"
          style={{ gridTemplateColumns: `repeat(${gridColumns ?? 2}, minmax(0, 1fr))` }}
        >
          {allRecipes.map((result) => (
            <RecipeCard key={`all-${result.kind}-${result.id}`} row={rowFor(result)} fluid />
          ))}
          {(allFirstLoading || allHasMore) &&
            Array.from({ length: (gridColumns ?? 2) * (allFirstLoading ? ALL_ROWS_PER_PAGE : 1) }, (_, index) => (
              <RecipeCardSkeleton key={`all-skeleton-${index}`} fluid />
            ))}
        </div>
        <div ref={sentinelRef} aria-hidden className="h-px" />
      </div>
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
      <div className="flex justify-end px-4 pt-3">
        <Link href="/create-dish" className="hf-type-small hf-type-strong inline-flex items-center gap-1 py-2 text-hf-black underline">
          <IconPlus size={16} aria-hidden="true" />
          {t("recipes.createNew")}
        </Link>
      </div>
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
