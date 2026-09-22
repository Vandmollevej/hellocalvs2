"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconBookmark, IconBookmarkFilled, IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { CalorieBadge } from "@/components/hf/CalorieBadge";
import { useTranslation } from "@/i18n/LocaleProvider";

type Recipe = {
  id: string;
  name: string;
  imageUrl: string | null;
  kcalPer100g: number;
  servingSizeGrams: number | null;
};

type LoadState = "loading" | "ready" | "error";

function kcalPerPerson(recipe: Recipe) {
  const grams = recipe.servingSizeGrams ?? 100;
  return Math.round((recipe.kcalPer100g * grams) / 100);
}

function RecipeCard({
  recipe,
  isFavorite,
  onToggleFavorite,
  t,
}: {
  recipe: Recipe;
  isFavorite: boolean;
  onToggleFavorite: (id: string, next: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[12px] bg-hf-tan">
          <Link href={`/add/${recipe.id}`} className="block h-full w-full">
            {recipe.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recipe.imageUrl}
                alt=""
                className="h-full w-full object-cover object-center"
              />
            )}
          </Link>
          <button
            type="button"
            onClick={() => onToggleFavorite(recipe.id, !isFavorite)}
            aria-label={t(isFavorite ? "search.removeFavorite" : "search.addFavorite")}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-hf-white"
          >
            {isFavorite ? <IconBookmarkFilled size={18} /> : <IconBookmark size={18} />}
          </button>
        </div>
        <CalorieBadge kcal={kcalPerPerson(recipe)} unit={t("recipes.kcalBadgeUnit")} />
      </div>
      <Link href={`/add/${recipe.id}`} className="block">
        <p className="text-[15px] font-semibold leading-tight text-hf-black">{recipe.name}</p>
      </Link>
    </div>
  );
}

export default function RecipesPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
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
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setState("loading");
      try {
        const params = new URLSearchParams({ source: "HELLOFRESH", take: "60" });
        if (query.trim()) params.set("q", query.trim());
        const response = await fetch(`/api/products?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("offline");
        const data = (await response.json()) as { products: Recipe[] };
        setRecipes(data.products);
        setState("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState("error");
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  return (
    <HfScreen title={t("recipes.title")}>
      <div className="flex flex-col gap-4 p-4">
        <div className="hf-search">
          <IconSearch size={16} color="var(--hf-black)" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("recipes.searchPlaceholder")}
          />
        </div>

        {state === "loading" && (
          <p className="px-1 py-6 text-center text-sm text-hf-black opacity-60">{t("recipes.loading")}</p>
        )}
        {state === "error" && (
          <p className="px-1 py-6 text-center text-sm text-hf-black opacity-60">{t("recipes.loadError")}</p>
        )}
        {state === "ready" && recipes.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-hf-black opacity-60">{t("recipes.noResults")}</p>
        )}

        {state === "ready" && recipes.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                isFavorite={favoriteIds.has(recipe.id)}
                onToggleFavorite={toggleFavorite}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </HfScreen>
  );
}
