import type { CSSProperties } from "react";

/**
 * Barcode on a white rounded card, drawn from the user's approved artwork
 * (public/icons/barcode/barcode-card.png, hi-res original in
 * "Original images - Hi-res/Ikoner"). It has its own white background so it
 * reads on the brownish `--hf-color-card` boxes, and is therefore an image,
 * not a colour mask. `size` is the height in px (aspect ratio is kept).
 * Variants without background/digits for tiny icons: barcode-bars.png,
 * barcode-digits.png in the same folder.
 */
export function IconBarcodeCard({
  size = 24,
  className,
  style,
}: {
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/barcode/barcode-card.png"
      alt=""
      aria-hidden="true"
      className={className}
      style={{ display: "inline-block", flexShrink: 0, height: size, width: "auto", ...style }}
    />
  );
}
