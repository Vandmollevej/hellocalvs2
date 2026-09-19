import { prisma } from "@/lib/prisma";
import type { AlternativeServing } from "@/lib/product-analysis-types";
import { isAlternativeServingConfident } from "@/lib/alternative-servings";

// Server-only: creates BugReport rows, so kept out of alternative-servings.ts
// (which is also imported by client components, e.g. src/app/add/[id]/page.tsx).

// Files a single AI-authored bug report (BugReport.source = "AI", no
// userId — see docs/DECISIONS.md 2026-09-19) listing every low-confidence
// alternative serving found on this product's nutrition label, so an admin
// can check it against the actual photo instead of it being silently shown
// or silently dropped.
export async function flagUncertainAlternativeServings(
  productId: string,
  productLabel: string,
  servings: AlternativeServing[],
) {
  const uncertain = servings.filter((serving) => !isAlternativeServingConfident(serving));
  if (!uncertain.length) return;

  const lines = uncertain.map((serving) => {
    const amountText = serving.amount != null ? `${serving.amount}${serving.unit ? ` ${serving.unit}` : ""}` : "ukendt mængde";
    const kcalText = serving.kcal != null ? `${serving.kcal} kcal` : "ukendt kcal";
    return `- ${serving.label} (${amountText}): ${kcalText} — confidence ${Math.round(serving.confidence * 100)}%`;
  });

  await prisma.bugReport.create({
    data: {
      source: "AI",
      productId,
      description: [
        `AI fandt (mulige) alternative kalorievisninger på "${productLabel}"'s emballage, men er ikke sikker nok til at vise dem uden gennemgang:`,
        ...lines,
      ].join("\n"),
    },
  });
}
