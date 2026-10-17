// Ren logik til allergen-robotten (docs/DECISIONS.md 2026-10-17): finder ord i
// en ingrediensliste, der er allergener, men som fremhævningen
// (src/lib/allergen-highlight.ts) ikke fanger endnu. Ingen database her, så
// den kan testes (allergen-word-finder.test.mjs).
//
// To kilder:
// - "reference": Open Food Facts' åbne opslagsværk (allergen- og
//   ingrediens-taksonomien, alle sprog). Kender den ordet på varens sprog som
//   et allergen, er fundet sikkert.
// - "uppercase": producenten har skrevet ordet med STORT, som EU kræver for
//   allergener. Usikkert (kan være en overskrift) — admin afgør.

import { segmentIngredients, type ExtraAllergenWord } from "./allergen-highlight.ts";

export type AllergenWordSource = "reference" | "uppercase";
export type AllergenWordCandidate = { word: string; allergenKey: string | null; source: AllergenWordSource; context: string };
/** sprog → ord (små bogstaver) → allergen-nøgle. Sproget "*" gælder alle sprog. */
export type ReferenceLookup = Map<string, Map<string, string>>;

// Open Food Facts' allergen-id'er (uden "en:") → vores nøgler (= ALLERGEN_CATALOG.offTag).
const OFF_ALLERGENS = new Set([
  "gluten", "crustaceans", "eggs", "fish", "peanuts", "soybeans", "milk", "nuts", "celery", "mustard",
  "sesame-seeds", "sulphur-dioxide-and-sulphites", "lupin", "molluscs",
]);

// Ord, der ofte står med STORT uden at være allergener (overskrifter, "KAN INDEHOLDE SPOR AF").
const UPPERCASE_STOPWORDS = new Set([
  "ingredienser", "ingrediens", "ingredients", "ingredient", "zutaten", "ingrédients", "ingredienti", "ingredientes",
  "ingrediënten", "ingredienser", "ainesosat", "składniki", "indeholder", "indeholde", "kan", "spor", "af", "og", "samt",
  "med", "uden", "contains", "contain", "may", "traces", "and", "of", "with", "enthält", "kann", "spuren", "von", "und",
  "innehåller", "spår", "inneholder", "allergener", "allergen", "allergens", "allergy", "allergi", "advice", "info",
  "information", "næringsindhold", "nutrition", "energi", "energy", "pr", "per", "min", "max", "ca", "eu", "dk", "uk",
  "øko", "økologisk", "organic", "bio", "msc", "asc", "fsc", "dan", "dansk", "danish", "vegan", "vegansk",
]);

const LETTERS = "a-zA-ZæøåÆØÅäöüÄÖÜéÉèÈàÀâÂêÊîÎôÔûÛçÇñÑßłŁąĄęĘśŚźŹżŻ";
const WORD = new RegExp(`[${LETTERS}]+`, "g");
const LOWER = /[a-zæøåäöüéèàâêîôûçñßłąęśźż]/;

function languageKeys(language: string | null | undefined): string[] {
  const lang = (language ?? "").toLowerCase().slice(0, 2);
  if (lang === "no" || lang === "nb" || lang === "nn") return ["no", "nb", "nn"];
  return lang ? [lang] : [];
}

function contextAround(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 30);
  const to = Math.min(text.length, end + 30);
  return `${from > 0 ? "…" : ""}${text.slice(from, to)}${to < text.length ? "…" : ""}`.replace(/\s+/g, " ");
}

/**
 * Andel af listens almindelige ord (ikke allergener, ikke stopord som "KAN
 * INDEHOLDE SPOR AF"), der står med STORT. Er det meste skrevet med STORT,
 * siger STORT intet.
 */
function upperWordRatio(text: string, extra: readonly ExtraAllergenWord[]): number {
  let words = 0;
  let upper = 0;
  for (const segment of segmentIngredients(text, extra)) {
    if (segment.allergen) continue;
    for (const match of segment.text.matchAll(WORD)) {
      const raw = match[0];
      if (raw.length < 3 || UPPERCASE_STOPWORDS.has(raw.toLowerCase())) continue;
      words += 1;
      if (!LOWER.test(raw)) upper += 1;
    }
  }
  return words ? upper / words : 0;
}

export function findAllergenWordCandidates(
  text: string,
  language: string | null | undefined,
  lookup: ReferenceLookup,
  extra: readonly ExtraAllergenWord[] = [],
  ignore: ReadonlySet<string> = new Set(),
): AllergenWordCandidate[] {
  const found = new Map<string, AllergenWordCandidate>();
  const maps = [...languageKeys(language), "*"].map((key) => lookup.get(key)).filter((map): map is Map<string, string> => !!map);
  const shoutingList = upperWordRatio(text, extra) > 0.5;
  let offset = 0;
  for (const segment of segmentIngredients(text, extra)) {
    const segmentStart = offset;
    offset += segment.text.length;
    if (segment.allergen) continue;
    for (const match of segment.text.matchAll(WORD)) {
      const raw = match[0];
      const word = raw.toLowerCase();
      if (word.length < 3 || found.has(word) || ignore.has(word)) continue;
      const start = segmentStart + (match.index ?? 0);
      const context = contextAround(text, start, start + raw.length);
      const key = maps.map((map) => map.get(word)).find(Boolean);
      if (key) {
        found.set(word, { word, allergenKey: key, source: "reference", context });
        continue;
      }
      const isUpper = !LOWER.test(raw) && raw !== word;
      if (isUpper && !shoutingList && raw.length >= 4 && !UPPERCASE_STOPWORDS.has(word) && !/^[ivxlcdm]+$/.test(word)) {
        found.set(word, { word, allergenKey: null, source: "uppercase", context });
      }
    }
  }
  return [...found.values()];
}

// --- Open Food Facts-taksonomierne -------------------------------------------

type TaxonomyEntry = {
  name?: Record<string, unknown>;
  synonyms?: Record<string, unknown>;
  parents?: unknown;
  allergens?: unknown;
};
type Taxonomy = Record<string, TaxonomyEntry>;

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

function allergenIds(value: unknown): string[] {
  return strings(value)
    .flatMap((item) => item.split(","))
    .map((item) => item.trim().replace(/^en:/, ""))
    .filter((id) => OFF_ALLERGENS.has(id));
}

function addNames(lookup: ReferenceLookup, entry: TaxonomyEntry, key: string) {
  for (const field of [entry.name, entry.synonyms]) {
    if (!field || typeof field !== "object") continue;
    for (const [lang, value] of Object.entries(field)) {
      for (const name of strings(value)) {
        const word = name.trim().toLowerCase();
        // Kun enkeltord: ingredienslisten læses ord for ord.
        if (word.length < 3 || !new RegExp(`^[${LETTERS}]+$`).test(word)) continue;
        let map = lookup.get(lang);
        if (!map) lookup.set(lang, (map = new Map()));
        if (!map.has(word)) map.set(word, key);
      }
    }
  }
}

/**
 * Bygger opslaget fra Open Food Facts' allergens.json og (valgfrit)
 * ingredients.json. En ingrediens arver allergenet fra sine forældre
 * ("mozzarella" → "ost" → mælk).
 */
export function buildReferenceLookup(allergens: Taxonomy | null, ingredients: Taxonomy | null): ReferenceLookup {
  const lookup: ReferenceLookup = new Map();
  for (const [id, entry] of Object.entries(allergens ?? {})) {
    const key = id.replace(/^en:/, "");
    if (OFF_ALLERGENS.has(key) && entry) addNames(lookup, entry, key);
  }
  if (!ingredients) return lookup;

  const memo = new Map<string, string | null>();
  const resolve = (id: string, depth: number): string | null => {
    if (memo.has(id)) return memo.get(id) ?? null;
    const entry = ingredients[id];
    if (!entry || depth > 12) return null;
    memo.set(id, null); // værn mod ring i forældrene
    const own = allergenIds(entry.allergens);
    // Flere forskellige allergener (fx "pesto") → ingen entydig side at linke til.
    let key: string | null = own.length === 1 || new Set(own).size === 1 ? own[0] : null;
    if (!key && !own.length) {
      const inherited = new Set(strings(entry.parents).map((parent) => resolve(parent, depth + 1)).filter((k): k is string => !!k));
      key = inherited.size === 1 ? [...inherited][0] : null;
    }
    memo.set(id, key);
    return key;
  };
  for (const [id, entry] of Object.entries(ingredients)) {
    const key = resolve(id, 0);
    if (key && entry) addNames(lookup, entry, key);
  }
  return lookup;
}
