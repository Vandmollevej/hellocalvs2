import type { LabelRead } from "@/lib/product-capture";
import type { LabelRegions } from "@/lib/label-text-regions";

// Levende scanning i kameraflowet (docs/DECISIONS.md 2026-10-02): energi- og
// indholdstrinnet læser ikke ét frosset foto, men flere billeder fra den
// kørende video, et ad gangen, og lægger aflæsningerne sammen. Det bedste
// billede bliver trinnets foto; felter, det mangler (næringstal,
// ingrediensliste, tekstfeltets placering), hentes fra de andre.

export type LabelNeed = "nutrition" | "ingredients";

// Så mange billeder med læsbar tekst læses højst, før det bedste bruges.
export const MAX_LABEL_ATTEMPTS = 10;
// Fra denne sikkerhed er den lokale aflæsning god nok til at stoppe.
export const LABEL_DONE_CONFIDENCE = 70;

export type LabelAttempt<F> = { frame: F; read: LabelRead };

export function labelFound(read: LabelRead, need: LabelNeed): boolean {
  return need === "nutrition"
    ? Boolean(read.nutrition || read.regions.nutrition)
    : Boolean(read.ingredientsText || read.regions.ingredients);
}

export function labelParsed(read: LabelRead, need: LabelNeed): boolean {
  return need === "nutrition" ? read.nutrition !== null : Boolean(read.ingredientsText);
}

// Trinnet er klaret, når det søgte felt er læst lokalt med god sikkerhed.
export function labelDone(read: LabelRead, need: LabelNeed): boolean {
  return labelParsed(read, need) && read.confidence >= LABEL_DONE_CONFIDENCE;
}

// Hvor god en aflæsning er for trinnet: sikkerheden plus et tillæg for det,
// der faktisk blev fundet (det søgte felt vægter højest).
export function labelScore(read: LabelRead, need: LabelNeed): number {
  let score = read.confidence;
  if (labelParsed(read, need)) score += 40;
  else if (labelFound(read, need)) score += 15;
  const other: LabelNeed = need === "nutrition" ? "ingredients" : "nutrition";
  if (labelParsed(read, other)) score += 10;
  else if (labelFound(read, other)) score += 5;
  return score;
}

function mergeRegions(base: LabelRegions, other: LabelRegions): LabelRegions {
  return { nutrition: base.nutrition ?? other.nutrition, ingredients: base.ingredients ?? other.ingredients };
}

// Den bedste aflæsning vinder og låner det, den mangler, fra den anden.
export function mergeLabelAttempts<F>(
  best: LabelAttempt<F> | null,
  next: LabelAttempt<F>,
  need: LabelNeed,
): LabelAttempt<F> {
  if (!best) return next;
  const [winner, loser] = labelScore(next.read, need) > labelScore(best.read, need) ? [next, best] : [best, next];
  return {
    frame: winner.frame,
    read: {
      ...winner.read,
      nutrition: winner.read.nutrition ?? loser.read.nutrition,
      ingredientsText: winner.read.ingredientsText ?? loser.read.ingredientsText,
      regions: mergeRegions(winner.read.regions, loser.read.regions),
    },
  };
}

// Billedet tæller kun som forsøg, når der overhovedet blev læst tekst.
export function countsAsAttempt(read: LabelRead): boolean {
  return read.text.length > 0 || labelFound(read, "nutrition") || labelFound(read, "ingredients");
}

// Vælger det skarpeste af flere billeder taget lige efter hinanden.
export function sharpest<F extends { sharpness: number }>(frames: F[]): F | null {
  return frames.reduce<F | null>((best, frame) => (!best || frame.sharpness > best.sharpness ? frame : best), null);
}
