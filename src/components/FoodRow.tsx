import type { ReactNode } from "react";

/**
 * Global row for a single food/product entry — used by the front-page
 * "already added" list, search results, and the calendar hour list.
 * Callers own navigation/interaction wrappers; this owns only the visual row.
 */
export function FoodRow({
  image,
  title,
  subtitle,
  right,
}: {
  image?: string | null;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2.5">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-hf-tan">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-contain object-center" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm text-hf-black">{title}</p>
        {subtitle}
      </div>
      {right && <div className="flex flex-shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}
