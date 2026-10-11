// Mangler i admin-listernes rækker (docs/DECISIONS.md 2026-10-11): en vare eller
// ret uden billede eller næring må ikke stå som en almindelig godkendt række.
// Rækken får en tynd rød kant og en rød tekst, og listen en rød linje øverst
// med tal og filter. Ingen Prisma-import (bruges også af klientkomponenter).

export const LIST_PROBLEMS = ["image", "nutrition", "ingredients"] as const;
export type ListProblem = (typeof LIST_PROBLEMS)[number];

export const LIST_PROBLEM_LABELS: Record<ListProblem, string> = {
  image: "Mangler billede",
  nutrition: "Mangler næring",
  ingredients: "Mangler ingredienser",
};

type ProblemInput = {
  imageUrl: string | null;
  // Butiksvare uden kalorietal (Product.nutritionMissing) eller en ret uden kcal.
  nutritionMissing: boolean;
  // null = rækketypen har ingen ingrediensliste (varer, brugerretter).
  ingredientCount?: number | null;
};

export function rowProblems(input: ProblemInput): ListProblem[] {
  const problems: ListProblem[] = [];
  if (!input.imageUrl) problems.push("image");
  if (input.nutritionMissing) problems.push("nutrition");
  if (input.ingredientCount === 0) problems.push("ingredients");
  return problems;
}

export function problemText(problems: ListProblem[]) {
  return problems.map((problem) => LIST_PROBLEM_LABELS[problem]).join(" · ");
}
