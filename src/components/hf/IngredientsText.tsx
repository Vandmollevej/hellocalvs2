import Link from "next/link";
import { segmentIngredients } from "@/lib/allergen-highlight";
import { foodTermHref, splitFoodTerms } from "@/lib/food-latin";
import { displayIngredientsText } from "@/lib/ingredient-text-quality";

// Ingredient list with allergens shown in UPPERCASE and bold. Ikke-danske ord
// fra "Mad på latin" er links uden særlig styling (brugerens ønske 2026-09-28).
// Ældre lister vises med sikre tegnrettelser ("£202" → "E202", dansk "soja").
// `cleaned`: teksten er allerede rettet som helhed (stykker mellem E-numre må
// ikke rettes hver for sig — det trimmer mellemrummet foran E-nummeret væk).
export function IngredientsText({ text, cleaned = false }: { text: string; cleaned?: boolean }) {
  return (
    <>
      {segmentIngredients(cleaned ? text : displayIngredientsText(text)).map((segment, index) => {
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
