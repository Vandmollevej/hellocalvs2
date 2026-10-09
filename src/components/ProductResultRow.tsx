"use client";

import { IconFavorite as IconBookmark, IconFavoriteFilled as IconBookmarkFilled } from "@/components/icons/Favorite";
import { FoodRow } from "@/components/FoodRow";
import { UncertaintyTilde } from "@/components/ui/UncertaintyTilde";
import { useTranslation } from "@/i18n/LocaleProvider";

// En vare som i søgelisten: billede, navn, brand · kcal, favorit og Tilføj.
// Bruges af Søg og "Se dine indscanninger".
// kcal/brand/macrosEstimated findes kun på søgeresultater fra /api/products
// (ikke på seneste/favoritter). macrosEstimated = usikkerheds-~ foran
// kalorietallet (docs/DECISIONS.md 2026-09-24).
export type ProductResult = {
  id: string;
  title: string;
  image?: string | null;
  brand?: string | null;
  kcal?: number;
  macrosEstimated?: boolean;
};

export function ProductResultRow({
  id,
  title,
  image,
  brand,
  kcal,
  macrosEstimated,
  onAdd,
  isFavorite,
  onToggleFavorite,
}: ProductResult & {
  onAdd: (id: string) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string, next: boolean) => void;
}) {
  const { t } = useTranslation();
  // Hele linjen gør det samme som Tilføj-knappen (docs/DECISIONS.md 2026-09-27).
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAdd(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onAdd(id);
      }}
      className="cursor-pointer px-4 border-b border-hf-tan-dark last:border-b-0"
    >
      <FoodRow
        image={image}
        title={title}
        subtitle={
          kcal !== undefined ? (
            <p className="hf-type-small text-text-secondary truncate">
              {brand ? `${brand} · ` : ""}
              {macrosEstimated && <UncertaintyTilde />}
              {t("foods.kcalPer100g", { kcal: Math.round(kcal) })}
            </p>
          ) : undefined
        }
        right={
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite(id, !isFavorite);
              }}
              aria-label={t(isFavorite ? "search.removeFavorite" : "search.addFavorite")}
              className="mr-2 text-hf-green"
            >
              {isFavorite ? <IconBookmarkFilled size={20} /> : <IconBookmark size={20} />}
            </button>
          </>
        }
      />
    </div>
  );
}
