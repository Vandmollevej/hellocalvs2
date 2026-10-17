"use client";

import Link from "next/link";
import { allergenHref, segmentIngredients } from "@/lib/allergen-highlight";
import { useAllergenWords } from "@/lib/allergen-words-client";
import { foodTermHref, splitFoodTerms } from "@/lib/food-latin";
import { displayIngredientsText } from "@/lib/ingredient-text-quality";

// Ingredient list with allergens shown in UPPERCASE and bold (EU 1169/2011
// art. 21). Hvert allergen er et link til sin side under Viden om mad →
// Allergener (bruger 2026-10-17); allergen-robottens godkendte ord kommer fra
// /api/allergens/words. Ikke-danske ord fra "Mad på latin" er links uden
// særlig styling (brugerens ønske 2026-09-28). Ældre lister vises med sikre
// tegnrettelser ("£202" → "E202", dansk "soja").
// `cleaned`: teksten er allerede kørt gennem displayIngredientsText (fx når
// E-numrene er splittet ud først) — stykkerne må ikke renses hver for sig, da
// det fjerner mellemrummene ved E-numrene ("karamelE150d").
export function IngredientsText({ text, cleaned = false }: { text: string; cleaned?: boolean }) {
  const extraWords = useAllergenWords();
  return (
    <>
      {segmentIngredients(cleaned ? text : displayIngredientsText(text), extraWords).map((segment, index) => {
        if (segment.allergen) {
          const label = <strong className="uppercase hf-type-strong">{segment.text}</strong>;
          return segment.allergenKey ? (
            <Link key={index} href={allergenHref(segment.allergenKey)} className="text-inherit no-underline">
              {label}
            </Link>
          ) : (
            <span key={index}>{label}</span>
          );
        }
        return (
          <span key={index}>
            {splitFoodTerms(segment.text).map((part, partIndex) =>
              part.term ? (
                <Link key={partIndex} href={foodTermHref(part.term)} className="text-inherit no-underline">
                  {part.text}
                </Link>
              ) : (
                part.text
              ),
            )}
          </span>
        );
      })}
    </>
  );
}
