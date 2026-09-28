// Splits an ingredient list into plain and allergen segments so the UI can
// emphasise allergens (UPPERCASE + bold), as required by EU 1169/2011 art. 21.
// Word stems are matched at word start, so compounds like "mælkepulver",
// "hvedemel" or "sojalecithin" are caught; "fri"/"uden" negations are not handled.

const ALLERGEN_STEMS = [
  // Gluten-cereals
  "gluten", "rugmel", "rugkern", "rugbrød", "rugflager", "bygmel", "byggryn", "bygmalt", "hvede", "wheat", "rug", "rye", "byg", "barley", "havre", "oat", "spelt", "kamut", "durum", "semulje",
  // Crustaceans / molluscs
  "skaldyr", "krebsdyr", "rejer", "reje", "krabbe", "hummer", "shrimp", "crab", "lobster",
  "bløddyr", "muslinger", "musling", "østers", "blæksprutte", "mollus",
  // Eggs, fish, milk
  "æg", "egg", "fisk", "fish", "torsk", "laks", "tun", "sild", "ansjos",
  "mælk", "milk", "fløde", "smør", "ost", "valle", "laktose", "kasein", "yoghurt", "skyr", "cream", "butter", "cheese", "whey", "lactose", "casein",
  // Nuts, peanuts, seeds
  "jordnød", "peanut", "nød", "nødde", "nut", "mandel", "mandler", "almond", "hasselnød", "hazelnut", "valnød", "walnut",
  "cashew", "pekan", "pecan", "pistacie", "pistachio", "paranød", "macadamia",
  "soja", "soy", "selleri", "celery", "sennep", "mustard", "sesam", "sesame", "lupin",
  "sulfit", "sulphit", "sulfite", "svovldioxid", "sulphur dioxide", "sulfur dioxide",
];

// Short stems only match as whole words (plus simple inflections) to avoid false
// hits such as "tun" in "tunge" or "æg" in "ægte".
const EXACT_ONLY = new Set(["rug", "byg", "ost", "tun", "nut", "oat", "egg", "æg", "nød", "rye", "soy"]);

export type IngredientSegment = { text: string; allergen: boolean };

const LETTER = "a-zA-ZæøåÆØÅäöüÄÖÜéÉ";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pattern = new RegExp(
  `(?<![${LETTER}])(?:` +
    [...ALLERGEN_STEMS]
      .sort((a, b) => b.length - a.length)
      .map((stem) =>
        EXACT_ONLY.has(stem)
          ? `${escape(stem)}(?:er|ne|s|g)?(?![${LETTER}])`
          : `${escape(stem)}[${LETTER}]*`,
      )
      .join("|") +
    ")",
  "gi",
);

export function segmentIngredients(text: string): IngredientSegment[] {
  const segments: IngredientSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start), allergen: false });
    segments.push({ text: match[0], allergen: true });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), allergen: false });
  return segments;
}
