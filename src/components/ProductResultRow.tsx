"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { IconChevronRight } from "@tabler/icons-react";
import { FoodRow } from "@/components/FoodRow";
import { SwipeableRow } from "@/components/SwipeableRow";
import { UncertaintyTilde } from "@/components/ui/UncertaintyTilde";
import { useTranslation } from "@/i18n/LocaleProvider";

// En vare i en liste — samme række som "Dagens tilføjelser" på forsiden
// (bruger 2026-10-17: forsiden er bestemmende for alle lister). Favorit fås
// kun ved swipe til højre; swipe til venstre giver Fejl (+ Slet, hvor
// listen kan slette). Bruges af Søg, Favoritter og "Se dine indscanninger".
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
  // Vare uden energitabel: "Næringsindhold ukendt" i stedet for 0 kcal.
  nutritionMissing?: boolean;
};

export function ProductResultRow({
  id,
  title,
  image,
  brand,
  kcal,
  macrosEstimated,
  nutritionMissing,
  overline,
  onAdd,
  isFavorite,
  onToggleFavorite,
  onDelete,
}: ProductResult & {
  // Linje over navnet, fx "Kl. 18.45" (som på forsiden).
  overline?: ReactNode;
  onAdd: (id: string) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string, next: boolean) => void;
  // Kun hvor listen kan slette (indscanninger, favoritter).
  onDelete?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <div className="border-b border-hf-tan-dark last:border-b-0">
      <SwipeableRow
        onFavorite={() => onToggleFavorite(id, !isFavorite)}
        isFavorite={isFavorite}
        onReportError={() => router.push(`/product/${id}/report-error`)}
        onDelete={onDelete ? () => onDelete(id) : undefined}
      >
        {/* Hele linjen åbner varen (docs/DECISIONS.md 2026-09-27). */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onAdd(id)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onAdd(id);
          }}
          className="cursor-pointer"
        >
          <FoodRow
            image={image}
            overline={overline}
            title={title}
            subtitle={
              kcal !== undefined ? (
                <p className="hf-type-caption mt-1 truncate">
                  {brand ? `${brand} · ` : ""}
                  {nutritionMissing ? (
                    t("addProduct.nutritionUnknown")
                  ) : (
                    <>
                      {macrosEstimated && <UncertaintyTilde />}
                      {t("foods.kcalPer100g", { kcal: Math.round(kcal) })}
                    </>
                  )}
                </p>
              ) : undefined
            }
            right={<IconChevronRight size={18} className="text-hf-black opacity-40" />}
          />
        </div>
      </SwipeableRow>
    </div>
  );
}
