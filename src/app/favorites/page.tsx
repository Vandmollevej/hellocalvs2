"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { AddProductView } from "@/components/add/AddProductView";
import { ProductResultRow, type ProductResult } from "@/components/ProductResultRow";
import { RecipeRow, recipeHref } from "@/components/recipes/RecipeRow";
import { SkeletonMediaRows, SkeletonScreen } from "@/components/hf/Skeleton";
import { useTranslation } from "@/i18n/LocaleProvider";

// Favoritter (kan lægges i bundmenuen): brugerens favoritmadvarer
// (/api/favorites) og favoritopskrifter fra delte retter (/api/recipe-favorites)
// samlet ét sted. Fjernes en madvare som favorit, forsvinder den fra listen.

type FavoriteResponse = {
  favorites: Array<{ id: string; product: { id: string; name: string; imageUrl: string | null } | null }>;
};
type FavoriteRecipe = { id: string; name: string; kcal: number; images?: string[] };

export default function FavoritesPage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<ProductResult[] | null>(null);
  const [recipes, setRecipes] = useState<FavoriteRecipe[] | null>(null);
  const [addId, setAddId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/favorites", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("offline");
        return (await response.json()) as FavoriteResponse;
      })
      .then((data) =>
        setProducts(
          data.favorites
            .filter((favorite) => favorite.product)
            .map((favorite) => ({
              id: favorite.product!.id,
              title: favorite.product!.name,
              image: favorite.product!.imageUrl,
            }))
        )
      )
      .catch(() => {
        if (!controller.signal.aborted) setProducts([]);
      });
    fetch("/api/recipe-favorites", { signal: controller.signal })
      .then(async (response) => (response.ok ? ((await response.json()) as { favorites: FavoriteRecipe[] }).favorites : []))
      .then(setRecipes)
      .catch(() => {
        if (!controller.signal.aborted) setRecipes([]);
      });
    return () => controller.abort();
  }, []);

  function removeFavorite(productId: string, next: boolean) {
    if (next) return;
    setProducts((current) => current?.filter((p) => p.id !== productId) ?? current);
    fetch("/api/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    }).catch(() => {});
  }

  return (
    <HfScreen title={t("favorites.title")}>
      <div className="hf-page">
        <h2 className="hf-type-section-title">{t("favorites.foodsTitle")}</h2>
        {products === null ? (
          <SkeletonScreen>
            <SkeletonMediaRows rows={3} />
          </SkeletonScreen>
        ) : products.length === 0 ? (
          <p className="hf-type-body text-text-secondary px-1 text-center">{t("favorites.foodsEmpty")}</p>
        ) : (
          <div className="overflow-hidden rounded-[8px] bg-hf-tan">
            {products.map((product) => (
              <ProductResultRow
                key={product.id}
                {...product}
                onAdd={setAddId}
                isFavorite
                onToggleFavorite={removeFavorite}
              />
            ))}
          </div>
        )}

        <h2 className="hf-type-section-title">{t("favorites.recipesTitle")}</h2>
        {recipes === null ? (
          <SkeletonScreen>
            <SkeletonMediaRows rows={3} />
          </SkeletonScreen>
        ) : recipes.length === 0 ? (
          <p className="hf-type-body text-text-secondary px-1 text-center">{t("favorites.recipesEmpty")}</p>
        ) : (
          <div>
            {recipes.map((recipe) => (
              <RecipeRow
                key={recipe.id}
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
      </div>

      {addId && <AddProductView key={addId} id={addId} forDish={false} inSheet onClose={() => setAddId(null)} />}
    </HfScreen>
  );
}
