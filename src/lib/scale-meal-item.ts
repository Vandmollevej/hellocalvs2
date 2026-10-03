// Skalerer et foreslået (endnu ikke gemt) AI-/stemme-element til en ny
// grammængde, så kcal og makroer følger med, når brugeren retter mængden.
export type ScalableItem = {
  amountGrams: number;
  amountLabel: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export function scaleItemToGrams<T extends ScalableItem>(item: T, grams: number): T {
  const next = Math.max(0, Math.round(grams));
  const factor = item.amountGrams > 0 ? next / item.amountGrams : 0;
  return {
    ...item,
    amountGrams: next,
    amountLabel: `${next} g`,
    kcal: Math.round(item.kcal * factor),
    protein: round1(item.protein * factor),
    carbs: round1(item.carbs * factor),
    fat: round1(item.fat * factor),
  };
}
