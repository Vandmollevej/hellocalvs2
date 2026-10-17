"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Brugerens favoritvarer til swipe-rækkernes Favorit-knap (swipe til højre):
// udfyldt ikon og "Gemt", når varen allerede er favorit; tryk fjerner den igen.
export function useFavoriteProducts() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const idsRef = useRef(favoriteIds);
  useEffect(() => {
    idsRef.current = favoriteIds;
  }, [favoriteIds]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/favorites", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { favorites: Array<{ product?: { id: string } | null }> };
        setFavoriteIds(new Set(data.favorites.flatMap((favorite) => (favorite.product ? [favorite.product.id] : []))));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const toggleFavorite = useCallback((productId: string) => {
    const ids = new Set(idsRef.current);
    const next = !ids.has(productId);
    if (next) ids.add(productId);
    else ids.delete(productId);
    idsRef.current = ids;
    setFavoriteIds(ids);
    fetch("/api/favorites", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    }).catch(() => {});
  }, []);

  return { favoriteIds, toggleFavorite };
}
