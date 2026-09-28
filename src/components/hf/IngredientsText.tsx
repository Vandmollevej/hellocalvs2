import { segmentIngredients } from "@/lib/allergen-highlight";
import { splitENumbers } from "@/lib/additives";

// Ingredient list with allergens shown in UPPERCASE and bold, and E-numbers
// as tappable links when onAdditive is given.
export function IngredientsText({ text, onAdditive }: { text: string; onAdditive?: (code: string) => void }) {
  return (
    <>
      {splitENumbers(text).map((part, index) =>
        part.code && onAdditive ? (
          <button
            key={index}
            type="button"
            onClick={() => onAdditive(part.code!)}
            className="text-hf-green underline underline-offset-2"
          >
            {part.text}
          </button>
        ) : (
          segmentIngredients(part.text).map((segment, inner) =>
            segment.allergen ? (
              <strong key={`${index}-${inner}`} className="font-bold uppercase">
                {segment.text}
              </strong>
            ) : (
              <span key={`${index}-${inner}`}>{segment.text}</span>
            ),
          )
        ),
      )}
    </>
  );
}
