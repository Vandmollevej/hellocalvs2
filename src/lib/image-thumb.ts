// Små, komprimerede udgaver af vores egne billeder (docs/DECISIONS.md 2026-10-15).
// Varebilleder, fritlægninger og logoer gemmes i fuld opløsning (logoer op til
// 15 MB), og <img> hentede originalen hver gang — også til en 48 px række.
// Next's billedoptimering (/_next/image) skalerer ned, laver WebP og cacher
// resultatet på serveren og i browseren (ETag, 304). Kun egne stier (/...)
// sendes igennem; data:/blob:, fremmede URL'er, SVG og GIF vises uændret.

// Bredderne skal stå i Next's imageSizes/deviceSizes (next.config.ts).
export const THUMB_WIDTHS = [64, 96, 128, 256, 384, 640, 828, 1200] as const;
export type ThumbWidth = (typeof THUMB_WIDTHS)[number];

const OPTIMIZABLE = /^\/(?!\/)[^?#]*\.(png|jpe?g|webp)$/i;

export function imageThumb<T extends string | null | undefined>(src: T, width: ThumbWidth): T | string {
  if (!src || !OPTIMIZABLE.test(src)) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}
