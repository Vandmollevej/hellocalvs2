"use client";

import Link from "next/link";
import { IconChevronRight, IconSoup } from "@tabler/icons-react";
import { Skeleton, SkeletonTitleLines } from "@/components/hf/Skeleton";
import { trackRecipeClick } from "@/lib/recipe-clicks";
import { mealKitForId } from "@/lib/meal-kit-providers";

// En opskriftsrække (billede, navn, undertekst, pil). Bruges af Opskrifter
// og Favoritter.

export type RecipeRowData = {
  key: string;
  href: string;
  name: string;
  imageUrl: string | null;
  subtitle: string;
  label?: { text: string; tone: "green" | "muted" };
  // Rød advarsel under titlen (spor af allergener, docs/DECISIONS.md 2026-09-25).
  warnings?: string[];
  extra?: string;
  // Klik-nøgle til "Trender netop nu" (src/lib/recipe-clicks.ts).
  clickKey?: string;
};

// Måltidskasse-retter (Product-id "hf_…", "rn_…", "bf_…") har deres egen side
// i HelloFresh-stil (docs/DECISIONS.md 2026-09-27 og 2026-10-10); det gælder
// også, når de er gemt som favorit.
export function recipeHref(id: string) {
  return mealKitForId(id)
    ? `/profile/recipes/hellofresh/${encodeURIComponent(id)}`
    : `/profile/recipes/${encodeURIComponent(id)}?kind=shared`;
}

export const RECIPE_ROW_CLASS = "flex items-center gap-3 border-b border-hf-tan-dark py-2.5 last:border-b-0";

// Uden data (row = null) tegner rækken sig selv som skelet: samme billedfelt,
// to tekstlinjer og plads til pilen (design.md §6.14 "skelettet er siden selv").
export function RecipeRow({ row, loadingTitleWidth }: { row: RecipeRowData | null; loadingTitleWidth?: number }) {
  if (!row) {
    return (
      <div className={RECIPE_ROW_CLASS} aria-hidden>
        <Skeleton type="tile" width={44} height={44} />
        <div className="min-w-0 flex-1">
          <SkeletonTitleLines titleWidth={loadingTitleWidth} />
        </div>
        <IconChevronRight size={18} className="invisible shrink-0" />
      </div>
    );
  }
  return (
    <Link
      href={row.href}
      className={RECIPE_ROW_CLASS}
      onClick={() => row.clickKey && trackRecipeClick(row.clickKey)}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden bg-hf-tan text-hf-black rounded-card">
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <IconSoup size={20} className="opacity-50" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="hf-type-body hf-type-strong truncate text-hf-black">{row.name}</p>
        {row.warnings?.map((warning) => (
          <p key={warning} className="hf-type-small text-hf-red-dark">
            {warning}
          </p>
        ))}
        <p className="hf-type-small text-text-secondary">
          {row.subtitle}
          {row.label && (
            <span className={`hf-type-strong ml-2 ${row.label.tone === "green" ? "text-hf-green" : "text-hf-black"}`}>
              {row.label.text}
            </span>
          )}
        </p>
        {row.extra && <p className="hf-type-small text-text-secondary">{row.extra}</p>}
      </div>
      <IconChevronRight size={18} className="shrink-0 text-hf-black" />
    </Link>
  );
}

// Kort i slider-rækken under "Trender netop nu": billede over navn og undertekst.
export function RecipeCard({ row }: { row: RecipeRowData }) {
  return (
    <Link
      href={row.href}
      onClick={() => row.clickKey && trackRecipeClick(row.clickKey)}
      className="block w-36 shrink-0 snap-start"
    >
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-hf-tan text-hf-black rounded-card">
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <IconSoup size={32} className="opacity-50" />
        )}
      </div>
      <p className="hf-type-small hf-type-strong mt-2 line-clamp-2 text-hf-black">{row.name}</p>
      {row.subtitle && <p className="hf-type-small text-text-secondary">{row.subtitle}</p>}
    </Link>
  );
}

export function RecipeCardSkeleton() {
  return (
    <div className="w-36 shrink-0" aria-hidden>
      <Skeleton type="tile" width={144} height={144} />
      <div className="mt-2">
        <SkeletonTitleLines titleWidth={110} />
      </div>
    </div>
  );
}
