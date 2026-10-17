// Splits an ingredient list into plain and allergen segments so the UI can
// emphasise allergens (UPPERCASE + bold), as required by EU 1169/2011 art. 21,
// and link each one to its page under "Viden om mad" → Allergener.
// Word stems are matched at word start, so compounds like "mælkepulver",
// "hvedemel" or "sojalecithin" are caught; "fri"/"uden" negations are not handled.
// Native copy: native/.../screens/food/FoodLogic.kt (segmentIngredients) — ret begge.

import type { AllergenKey } from "@/lib/allergens";

const STEMS_BY_ALLERGEN: Record<AllergenKey, string[]> = {
  gluten: ["gluten", "rugmel", "rugkern", "rugbrød", "rugflager", "bygmel", "byggryn", "bygmalt", "hvede", "wheat", "rug", "rye", "byg", "barley", "havre", "oat", "spelt", "kamut", "durum", "semulje"],
  crustaceans: ["skaldyr", "krebsdyr", "rejer", "reje", "krabbe", "hummer", "shrimp", "crab", "lobster"],
  molluscs: ["bløddyr", "muslinger", "musling", "østers", "blæksprutte", "mollus"],
  eggs: ["æg", "egg"],
  fish: ["fisk", "fish", "torsk", "laks", "tun", "sild", "ansjos"],
  milk: ["mælk", "milk", "fløde", "smør", "ost", "valle", "laktose", "kasein", "yoghurt", "skyr", "cream", "butter", "cheese", "whey", "lactose", "casein"],
  peanuts: ["jordnød", "peanut"],
  nuts: ["nød", "nødde", "nut", "mandel", "mandler", "almond", "hasselnød", "hazelnut", "valnød", "walnut", "cashew", "pekan", "pecan", "pistacie", "pistachio", "paranød", "macadamia"],
  soybeans: ["soja", "soya", "soy"],
  celery: ["selleri", "celery"],
  mustard: ["sennep", "mustard"],
  "sesame-seeds": ["sesam", "sesame"],
  lupin: ["lupin"],
  "sulphur-dioxide-and-sulphites": ["sulfit", "sulphit", "sulfite", "svovldioxid", "sulphur dioxide", "sulfur dioxide"],
};

// Short stems only match as whole words (plus simple inflections) to avoid false
// hits such as "tun" in "tunge" or "æg" in "ægte".
const EXACT_ONLY = new Set(["rug", "byg", "ost", "tun", "nut", "oat", "egg", "æg", "nød", "rye", "soy"]);

/** Ord, allergen-robotten har fundet og admin (eller opslagsværket) har godkendt — hele ord. */
export type ExtraAllergenWord = { word: string; allergen: string };

export type IngredientSegment = { text: string; allergen: boolean; allergenKey?: string };

const LETTER = "a-zA-ZæøåÆØÅäöüÄÖÜéÉ";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const STEM_TO_KEY = new Map<string, string>(
  Object.entries(STEMS_BY_ALLERGEN).flatMap(([key, stems]) => stems.map((stem) => [stem, key] as const)),
);

/** Hvilket allergen et fremhævet ord hører til (stammen med længst match vinder). */
function keyForMatch(word: string, extra: Map<string, string>): string | undefined {
  const lower = word.toLowerCase();
  const exact = extra.get(lower);
  if (exact) return exact;
  let best: string | undefined;
  let bestLength = 0;
  for (const [stem, key] of STEM_TO_KEY) {
    if (stem.length > bestLength && lower.startsWith(stem)) {
      best = key;
      bestLength = stem.length;
    }
  }
  return best;
}

function buildPattern(extraWords: string[]) {
  const stems = [...STEM_TO_KEY.keys()].sort((a, b) => b.length - a.length);
  const extra = [...extraWords].sort((a, b) => b.length - a.length);
  return new RegExp(
    `(?<![${LETTER}])(?:` +
      [
        // Godkendte robot-ord står først, så de vinder over en kortere stamme.
        ...extra.map((word) => `${escape(word)}(?![${LETTER}])`),
        ...stems.map((stem) =>
          EXACT_ONLY.has(stem) ? `${escape(stem)}(?:er|ne|s|g)?(?![${LETTER}])` : `${escape(stem)}[${LETTER}]*`,
        ),
      ].join("|") +
      ")",
    "gi",
  );
}

const basePattern = buildPattern([]);
let cached: { list: readonly ExtraAllergenWord[]; pattern: RegExp; keys: Map<string, string> } | null = null;

function compiled(extra: readonly ExtraAllergenWord[]) {
  if (!extra.length) return { pattern: basePattern, keys: new Map<string, string>() };
  if (cached?.list !== extra) {
    const keys = new Map(extra.map((item) => [item.word.toLowerCase(), item.allergen]));
    cached = { list: extra, pattern: buildPattern([...keys.keys()]), keys };
  }
  return cached;
}

export function segmentIngredients(text: string, extra: readonly ExtraAllergenWord[] = []): IngredientSegment[] {
  const { pattern, keys } = compiled(extra);
  const segments: IngredientSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start), allergen: false });
    segments.push({ text: match[0], allergen: true, allergenKey: keyForMatch(match[0], keys) });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), allergen: false });
  return segments;
}

/** Siden om et allergen under Viden om mad (slug = allergenets nøgle). */
export function allergenHref(key: string): string {
  return `/viden-om/allergener/${key}`;
}
