import { segmentIngredients } from "@/lib/allergen-highlight";

// Ingredient list with allergens shown in UPPERCASE and bold.
export function IngredientsText({ text }: { text: string }) {
  return (
    <>
      {segmentIngredients(text).map((segment, index) =>
        segment.allergen ? (
          <strong key={index} className="font-bold uppercase">
            {segment.text}
          </strong>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
