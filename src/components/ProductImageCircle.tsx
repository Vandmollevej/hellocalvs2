import type { ReactNode } from "react";

// Produktskærmens billedcirkel (190 px) med Hello Cal-frugten. Samme faste
// størrelse med og uden billede, så produktskærmen og registreringsvisningen
// altid har samme højde (brugerens krav 2026-09-28). children lægges oven på
// cirklen (fx favorit-knappen).
export function ProductImageCircle({ imageUrl, children }: { imageUrl: string | null; children?: ReactNode }) {
  return (
    <div className="relative h-[190px] w-[190px] min-h-[190px] min-w-[190px] max-h-[190px] max-w-[190px] shrink-0 overflow-visible">
      <div className="flex h-[190px] w-[190px] min-h-[190px] min-w-[190px] items-center justify-center overflow-hidden rounded-full bg-hf-tan">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="block h-full w-full max-h-full max-w-full object-contain p-8" />
        ) : (
          <div aria-hidden="true" className="h-full w-full" />
        )}
      </div>
      {children}
      {/* Logo sits on top of the product circle: its bottom-left corner at the
          circle's bottom point, spanning one radius to the right. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hello-cal-fruit.png"
        alt=""
        className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-[95px] w-[95px] object-contain object-left-bottom"
      />
    </div>
  );
}
