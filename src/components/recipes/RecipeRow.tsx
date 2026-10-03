"use client";

import Link from "next/link";
import { IconChevronRight, IconSoup } from "@tabler/icons-react";
import { Skeleton, SkeletonTitleLines } from "@/components/hf/Skeleton";

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
};

// HelloFresh-opskrifter (Product-id "hf_…") har deres egen side i
// HelloFresh-stil (docs/DECISIONS.md 2026-09-27); det gælder også, når de
// er gemt som favorit.
export function recipeHref(id: string) {
  return id.startsWith("hf_")
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
    <Link href={row.href} className={RECIPE_ROW_CLASS}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-hf-tan text-hf-black">
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
