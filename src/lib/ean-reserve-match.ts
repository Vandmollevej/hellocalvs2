// Stregkode-reserven (brugerens valg 2026-10-17: "Ja, som reserve"): data fra
// stregkodeopslag (Open Food Facts) bruges kun, når billederne ikke gav navn
// eller energi — og kun når tallene passer med varens egen etiket. Ren logik
// uden database, så den kan testes med `npm test`.

export type ReserveNutrition = {
  basis: "100g" | "100ml";
  kcal: number | null;
  kj: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber?: number | null;
  alcohol?: number | null;
};

const isValue = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

function toNumber(text: string): number {
  return Number(text.replace(",", "."));
}

// Energitallene på etiketten, som telefonens eller serverens tekstlæsning så
// dem. Tekstlæsningen staver tit "kcal" forkert ("keal", "kca1", "kcai").
export function labelEnergyNumbers(texts: (string | null | undefined)[]): { kcal: number[]; kj: number[] } {
  const kcal: number[] = [];
  const kj: number[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(/(\d{1,4}(?:[.,]\d{1,2})?)\s*\(?\s*k\s*[ceo]\s*[ae]\s*[l1i|]/gi)) {
      kcal.push(toNumber(match[1]));
    }
    for (const match of text.matchAll(/(\d{1,4}(?:[.,]\d{1,2})?)\s*k\s*j/gi)) {
      kj.push(toNumber(match[1]));
    }
  }
  return { kcal: kcal.filter((value) => value > 0), kj: kj.filter((value) => value > 0) };
}

// Hænger energien sammen med makroerne (4/4/9, fibre 2, alkohol 7 kcal pr. g)?
export function macrosConsistent(n: ReserveNutrition): boolean {
  if (!isValue(n.kcal) || !isValue(n.protein) || !isValue(n.carbs) || !isValue(n.fat)) return false;
  const computed = 4 * n.protein + 4 * n.carbs + 9 * n.fat + 2 * (n.fiber ?? 0) + 7 * (n.alcohol ?? 0);
  return Math.abs(n.kcal - computed) <= Math.max(15, n.kcal * 0.15);
}

const near = (a: number, b: number, relative: number, absolute: number) =>
  Math.abs(a - b) <= Math.max(absolute, Math.abs(b) * relative);

// Passer opslagets energi med et tal på etiketten?
export function matchesLabelEnergy(n: ReserveNutrition, label: { kcal: number[]; kj: number[] }): boolean {
  if (isValue(n.kcal) && label.kcal.some((value) => near(value, n.kcal!, 0.05, 2))) return true;
  const kj = isValue(n.kj) ? n.kj : isValue(n.kcal) ? n.kcal * 4.184 : null;
  return kj !== null && label.kj.some((value) => near(value, kj, 0.05, 8));
}

export type ReserveVerdict = "ok" | "incomplete" | "inconsistent" | "no_label_energy" | "label_mismatch";

export function judgeReserveNutrition(n: ReserveNutrition | null, labelTexts: (string | null | undefined)[]): ReserveVerdict {
  if (!n || !isValue(n.kcal) || !isValue(n.protein) || !isValue(n.carbs) || !isValue(n.fat)) return "incomplete";
  if (!macrosConsistent(n)) return "inconsistent";
  const label = labelEnergyNumbers(labelTexts);
  if (!label.kcal.length && !label.kj.length) return "no_label_energy";
  return matchesLabelEnergy(n, label) ? "ok" : "label_mismatch";
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Navnet fra opslaget bruges kun, når et af dets ord (mindst 4 bogstaver) også
// står på forsiden.
export function nameMatchesFront(name: string | null | undefined, frontTexts: (string | null | undefined)[]): boolean {
  if (!name) return false;
  const front = fold(frontTexts.filter(Boolean).join(" "));
  if (!front.trim()) return false;
  return fold(name)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4)
    .some((word) => front.includes(word));
}
