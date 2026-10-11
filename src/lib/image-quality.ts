import type { ImageCandidate, ImageGroup } from "@/lib/duplicate-review";

// Billedkvalitet på admin "Dubletter" → Varebilleder (docs/DECISIONS.md
// 2026-10-11). Et alternativ er "Anbefalet", når det er tydeligt bedre end
// billedet, der vises i dag: højere opløsning, et bedre format (PNG) eller
// højere farvemætning ved samme opløsning. Det anbefalede alternativ står
// altid først og vises ved siden af originalen, også selvom det er _3 eller _4.
// Målingen (opløsning + mætning) laves i browseren, se useImageQuality.

export type ImageFormat = "PNG" | "WEBP" | "AVIF" | "JPG" | "GIF";

export type ImageQuality = {
  ok: boolean;
  width: number;
  height: number;
  format: ImageFormat | null;
  // Gennemsnitlig farvemætning 0–1 uden hvid baggrund og gennemsigtighed;
  // null når pixels ikke kan læses (fx billede fra et andet domæne).
  saturation: number | null;
};

const FORMAT_RANK: Record<ImageFormat, number> = { PNG: 3, WEBP: 2, AVIF: 2, JPG: 1, GIF: 0 };

// Mindst 25 % flere pixels = højere opløsning; ±10 % = samme opløsning.
const MORE_PIXELS = 1.25;
const SAME_PIXELS = 0.9;
// Mærkbart højere mætning (på skalaen 0–1).
const MORE_SATURATION = 0.05;

export function imageFormat(url: string): ImageFormat | null {
  const path = url.split("?")[0].toLowerCase();
  const ext = path.slice(path.lastIndexOf(".") + 1);
  if (ext === "png") return "PNG";
  if (ext === "webp") return "WEBP";
  if (ext === "avif") return "AVIF";
  if (ext === "jpg" || ext === "jpeg") return "JPG";
  if (ext === "gif") return "GIF";
  return null;
}

const pixels = (q: ImageQuality) => (q.ok ? q.width * q.height : 0);
const formatRank = (q: ImageQuality) => (q.format ? FORMAT_RANK[q.format] : FORMAT_RANK.JPG);

// Er a tydeligt bedre end b? Lavere opløsning er aldrig bedre.
export function isClearlyBetter(a: ImageQuality, b: ImageQuality) {
  if (!a.ok) return false;
  if (!b.ok) return true;
  const pa = pixels(a);
  const pb = pixels(b);
  if (pa < pb * SAME_PIXELS) return false;
  if (pa >= pb * MORE_PIXELS) return true;
  if (formatRank(a) !== formatRank(b)) return formatRank(a) > formatRank(b);
  return a.saturation !== null && b.saturation !== null && a.saturation >= b.saturation + MORE_SATURATION;
}

export type ImageGroupView = {
  current: ImageCandidate;
  // Anbefalet først, derefter i filrækkefølge (_2, _3 …).
  alternatives: ImageCandidate[];
  recommendedId: string | null;
  // Alternativet ved siden af originalen.
  shown: ImageCandidate | null;
};

export function imageGroupView(
  group: ImageGroup,
  quality: Record<string, ImageQuality | undefined>,
  pickedId?: string,
): ImageGroupView {
  const current = group.images.find((img) => img.isPrimary) ?? group.images[0];
  const seen = new Set([current.url]);
  const candidates = group.images.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });

  // Først når alle billeder er målt, så anbefalingen ikke skifter undervejs.
  let recommended: ImageCandidate | null = null;
  const currentQuality = quality[current.url];
  if (currentQuality && candidates.every((img) => quality[img.url])) {
    const better = candidates.filter((img) => isClearlyBetter(quality[img.url]!, currentQuality));
    better.sort((a, b) => {
      const qa = quality[a.url]!;
      const qb = quality[b.url]!;
      return (
        pixels(qb) - pixels(qa) || formatRank(qb) - formatRank(qa) || (qb.saturation ?? 0) - (qa.saturation ?? 0)
      );
    });
    recommended = better[0] ?? null;
  }

  const alternatives = recommended
    ? [recommended, ...candidates.filter((img) => img.id !== recommended.id)]
    : candidates;
  const shown = alternatives.find((img) => img.id === pickedId) ?? alternatives[0] ?? null;
  return { current, alternatives, recommendedId: recommended?.id ?? null, shown };
}
