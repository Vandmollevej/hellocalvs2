import Link from "next/link";
import { segmentIngredients } from "@/lib/allergen-highlight";
import { foodTermHref, splitFoodTerms } from "@/lib/food-latin";

// Ingredient list with allergens shown in UPPERCASE and bold. Ikke-danske ord
// fra "Mad på latin" er links uden særlig styling (brugerens ønske 2026-09-28).
export function IngredientsText({ text }: { text: string }) {
  return (
    <>
      {segmentIngredients(text).map((segment, index) => {
        const content = splitFoodTerms(segment.text).map((part, partIndex) =>
          part.term ? (
            <Link key={partIndex} href={foodTermHref(part.term)} className="text-inherit no-underline">
              {part.text}
            </Link>
          ) : (
            part.text
          ),
        );
        return segment.allergen ? (
          <strong key={index} className="uppercase hf-type-strong">
            {content}
          </strong>
        ) : (
          <span key={index}>{content}</span>
        );
      })}
    </>
  );
}
