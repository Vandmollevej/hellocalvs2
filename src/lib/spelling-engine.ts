// Stavemotoren (docs/DECISIONS.md 2026-10-14, "Stavekontrol-robot"): fælles
// for nattens robot (src/lib/jobs/spelling-robot.ts) og kontrollen, der kører,
// når en ingrediensliste gemmes (src/lib/ingredient-text-quality.ts).
//
// Ikke hårdkodet til enkelte fejl: ordbogen er
//   1. en lille dansk grundliste (src/lib/ingredient-words.ts),
//   2. alle ord, der går igen i mindst CORPUS_MIN_PRODUCTS varers lister
//      (katalogets egen sprogbrug — robotten bygger den hver nat),
//   3. admins afgørelser: godkendte rettelser ("SOIA" → "SOJA") og ord, der
//      er markeret som rigtige. De bruges straks af alle senere kontroller.
// Et ukendt ord rettes mod ordbogen med en OCR-vægtet afstand: tegn, som
// tekstlæsning forveksler (E/F, I/J, I/L, O/0, rn/m …), er billige; alt andet
// dyrt. Kun sikre rettelser laves automatisk; resten bliver forslag til admin.
//
// Ingen imports med "@/": testes direkte med node --test.

import { DANISH_ALLERGEN_STEMS, DANISH_ALLERGEN_WORDS, DANISH_INGREDIENT_WORDS } from "./ingredient-words.ts";

export const CORPUS_MIN_PRODUCTS = 3;
// Forslag med mindst denne sikkerhed laves automatisk.
export const AUTO_FIX_CONFIDENCE = 0.9;

export type SpellingReason = "learned" | "look_alike" | "allergen" | "junk" | "e_number" | "nutrition" | "unknown";

export type SpellingDictionary = {
  known: Set<string>;
  // Antal varer, ordet står i (katalogets ordforråd). Tom = kun grundlisten.
  frequency: Map<string, number>;
  // Admins godkendte rettelser: forkert (små bogstaver) → rigtigt (som skrevet).
  corrections: Map<string, string>;
};

export type SpellingFinding = {
  word: string;
  start: number;
  end: number;
  // null = intet forslag; "" = ordet skal slettes (volapyk).
  suggestion: string | null;
  confidence: number;
  reason: SpellingReason;
};

// --- Ordbog -------------------------------------------------------------------

const SEED = new Set<string>([...DANISH_INGREDIENT_WORDS, ...DANISH_ALLERGEN_WORDS]);
// Faste danske stavemåder (gælder kun danske lister — robotten og kontrollen
// kører kun motoren på dem).
const SEED_CORRECTIONS: [string, string][] = [["soya", "soja"]];

export function createDictionary(input?: {
  frequency?: Map<string, number>;
  knownWords?: Iterable<string>;
  corrections?: Iterable<[string, string]>;
}): SpellingDictionary {
  const known = new Set(SEED);
  for (const word of input?.knownWords ?? []) known.add(word.toLowerCase());
  const frequency = input?.frequency ?? new Map<string, number>();
  for (const [word, count] of frequency) if (count >= CORPUS_MIN_PRODUCTS) known.add(word);
  const corrections = new Map<string, string>(SEED_CORRECTIONS);
  for (const [from, to] of input?.corrections ?? []) corrections.set(from.toLowerCase(), to);
  return { known, frequency, corrections };
}

export const SEED_DICTIONARY = createDictionary();

// --- Ord i teksten ------------------------------------------------------------

export type Token = { text: string; start: number; end: number };

// Ord (bogstaver, tal og bindestreg inde i ordet) med deres placering.
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/[\p{L}\d]+(?:[-'][\p{L}\d]+)*/gu)) {
    tokens.push({ text: match[0], start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  }
  return tokens;
}

// Ord, der kun består af danske/nordiske bogstaver (ingen kinesiske tegn, tal).
const DANISH_WORD = /^[a-zæøåäöüéè]+$/;

// Korte ord, der godt kan stå i en ingrediensliste.
const SHORT_WORDS = new Set([
  "og", "af", "i", "à", "a", "e", "el", "de", "en", "et", "ca", "pr", "g", "kg", "mg", "ml", "cl", "l", "ost",
  "æg", "or", "of", "in", "and", "to", "vit", "msg", "b", "c", "d", "k", "ph", "uv", "is", "te", "rug", "byg", "ris",
]);

// Brudstykker, der ikke er ord: bogstaver og tal blandet (":699k1" — men ikke
// E-numre, "B12", "D3", "omega-3", "2,5g"), og ét-/to-bogstavsstumper ("ee").
export function isJunkToken(token: string): boolean {
  const hasLetter = /\p{L}/u.test(token);
  if (!hasLetter) return false;
  if (/\d/.test(token)) {
    if (/^E\d{3,4}[a-d]?$/i.test(token)) return false;
    if (/^(?:vitamin-?)?[A-Z]\d{1,2}$/i.test(token) || /^omega-?\d$/i.test(token)) return false;
    if (/^\d+(?:[.,]\d+)?(?:g|kg|mg|ml|cl|l)$/i.test(token)) return false;
    return true;
  }
  return token.length <= 2 && !SHORT_WORDS.has(token.toLowerCase());
}

// --- Kendte ord og sammensætninger -------------------------------------------

export function isKnownWord(word: string, dictionary: SpellingDictionary, depth = 0): boolean {
  if (dictionary.known.has(word)) return true;
  if (depth > 2) return false;
  // Sammensat af kendte ord, evt. med binde-s/-e ("sennepsfrø", "mælkeprotein").
  for (let index = 2; index <= word.length - 3; index++) {
    const head = word.slice(0, index);
    if (!dictionary.known.has(head) || (head.length < 3 && head !== "æg")) continue;
    const rest = word.slice(index);
    if (isKnownWord(rest, dictionary, depth + 1)) return true;
    if ((rest.startsWith("s") || rest.startsWith("e")) && rest.length > 3 && isKnownWord(rest.slice(1), dictionary, depth + 1)) {
      return true;
    }
  }
  return false;
}

// --- OCR-vægtet afstand --------------------------------------------------------

// Tegn, tekstlæsning forveksler. Begge retninger gælder.
const LOOK_ALIKE_PAIRS: [string, string][] = [
  ["e", "f"], ["i", "j"], ["i", "l"], ["j", "l"], ["o", "0"], ["i", "1"], ["l", "1"], ["s", "5"], ["b", "8"],
  ["c", "e"], ["u", "v"], ["n", "m"], ["o", "q"], ["g", "q"], ["a", "o"], ["ø", "o"], ["ø", "0"], ["æ", "a"], ["å", "a"],
  ["rn", "m"], ["cl", "d"], ["ii", "ü"],
];
const LOOK_ALIKE = new Set(
  LOOK_ALIKE_PAIRS.filter(([a, b]) => a.length === 1 && b.length === 1).flatMap(([a, b]) => [a + b, b + a]),
);
const OTHER_COST = 1.1;
const LOOK_ALIKE_COST = 0.5;

export function ocrDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index * OTHER_COST);
  for (let i = 1; i <= a.length; i++) {
    const current = [i * OTHER_COST];
    for (let j = 1; j <= b.length; j++) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : LOOK_ALIKE.has(a[i - 1] + b[j - 1]) ? LOOK_ALIKE_COST : OTHER_COST;
      current[j] = Math.min(previous[j - 1] + substitution, previous[j] + OTHER_COST, current[j - 1] + OTHER_COST);
    }
    previous = current;
  }
  return previous[b.length];
}

// Alle stavemåder, der opstår ved at bytte op til `depth` forvekslelige tegn —
// slås op i ordbogen i stedet for at måle afstand til hvert ord (skalerer til
// hele kataloget).
function lookAlikeVariants(word: string, depth: number): Map<string, number> {
  const variants = new Map<string, number>();
  let frontier = [word];
  for (let level = 1; level <= depth; level++) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const [a, b] of LOOK_ALIKE_PAIRS) {
        for (const [from, to] of [[a, b], [b, a]]) {
          for (let index = current.indexOf(from); index >= 0; index = current.indexOf(from, index + 1)) {
            const variant = current.slice(0, index) + to + current.slice(index + from.length);
            if (variant === word || variants.has(variant)) continue;
            variants.set(variant, level);
            next.push(variant);
          }
        }
      }
    }
    frontier = next;
  }
  return variants;
}

let allergenCandidates: string[] | null = null;
function allergenWords(): string[] {
  allergenCandidates ??= [
    ...new Set<string>([
      ...DANISH_ALLERGEN_WORDS,
      ...DANISH_ALLERGEN_STEMS.flatMap((stem) =>
        DANISH_INGREDIENT_WORDS.filter((word) => word.length >= 3).map((word) => stem + word),
      ),
    ]),
  ];
  return allergenCandidates;
}

export function withCaseOf(token: string, word: string): string {
  const letters = token.replace(/[^\p{L}]/gu, "");
  if (letters.length > 1 && letters === letters.toUpperCase()) return word.toUpperCase();
  const first = token[0] ?? "";
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) return word[0].toUpperCase() + word.slice(1);
  return word;
}

// "soyasauce", "soyabønner" → "soja…" (de faste stavemåder også i sammensatte ord).
function soyaCompound(lower: string): string | undefined {
  for (const [from, to] of SEED_CORRECTIONS) if (lower.startsWith(from) && lower.length > from.length) return to + lower.slice(from.length);
  return undefined;
}

function frequencyOf(dictionary: SpellingDictionary, word: string): number {
  // Grundlistens ord er altid sikre, også når kataloget kun har dem i få varer.
  return Math.max(dictionary.frequency.get(word) ?? 0, SEED.has(word) ? CORPUS_MIN_PRODUCTS * 4 : 0);
}

// 1–2 forvekslede tegn → kendt ord. Ét tegn og et udbredt ord = sikkert.
function lookAlikeSuggestion(token: string, lower: string, dictionary: SpellingDictionary): Omit<SpellingFinding, "start" | "end"> | null {
  const variants = lookAlikeVariants(lower, 2);
  let best: { word: string; level: number; frequency: number } | null = null;
  let tie = false;
  for (const [variant, level] of variants) {
    if (!isKnownWord(variant, dictionary)) continue;
    const frequency = frequencyOf(dictionary, variant);
    if (!best || level < best.level || (level === best.level && frequency > best.frequency)) {
      best = { word: variant, level, frequency };
      tie = false;
    } else if (level === best.level && frequency === best.frequency && variant !== best.word) {
      tie = true;
    }
  }
  if (best && !tie) {
    const confidence = best.level === 1 ? (best.frequency >= CORPUS_MIN_PRODUCTS * 3 ? 0.95 : 0.85) : 0.7;
    return { word: token, suggestion: withCaseOf(token, best.word), confidence, reason: "look_alike" };
  }
  return null;
}

// --- Forslag for ét ord ----------------------------------------------------------

export function suggestWord(token: string, dictionary: SpellingDictionary): Omit<SpellingFinding, "start" | "end"> | null {
  const lower = token.toLowerCase();
  const learned = dictionary.corrections.get(lower) ?? soyaCompound(lower);
  if (learned !== undefined) {
    return { word: token, suggestion: learned === "" ? "" : withCaseOf(token, learned), confidence: 1, reason: "learned" };
  }
  if (isJunkToken(token)) {
    // Et tal, der ligner et bogstav ("sennepsfr0", "o1ie"), er en forveksling — ikke volapyk.
    const repaired = /^[a-zæøåäöüéè0158]+$/.test(lower) ? lookAlikeSuggestion(token, lower, dictionary) : null;
    return repaired ?? { word: token, suggestion: "", confidence: 0.5, reason: "junk" };
  }
  if (!DANISH_WORD.test(lower) || lower.length < 4 || isKnownWord(lower, dictionary)) return null;
  const lookAlike = lookAlikeSuggestion(token, lower, dictionary);
  if (lookAlike) return lookAlike;

  // STORE bogstaver er efter loven (EU 1169/2011) et allergen: nærmeste
  // allergen, også med et manglende/ekstra tegn ("FSAMFRØ" → "SESAMFRØ").
  const upper = token === token.toUpperCase() && lower.length >= 5;
  if (upper) {
    let bestCost = Infinity;
    let bestWord: string | null = null;
    let allergenTie = false;
    for (const candidate of allergenWords()) {
      if (Math.abs(candidate.length - lower.length) > 2) continue;
      const cost = ocrDistance(lower, candidate);
      if (cost < bestCost) {
        bestCost = cost;
        bestWord = candidate;
        allergenTie = false;
      } else if (cost === bestCost && candidate !== bestWord) {
        allergenTie = true;
      }
    }
    if (bestWord && !allergenTie && bestCost <= Math.min(2.2, lower.length * 0.3)) {
      // Ét forvekslet tegn, eller (i ord på mindst 6 bogstaver) et manglende
      // tegn + et forvekslet — "FSAMFRØ" → "SESAMFRØ" — er sikkert nok til at
      // rette uden et menneske; alt længere væk bliver et forslag.
      const confidence =
        bestCost <= LOOK_ALIKE_COST ? 0.97 : bestCost <= OTHER_COST + LOOK_ALIKE_COST && lower.length >= 6 ? 0.9 : 0.65;
      return { word: token, suggestion: bestWord.toUpperCase(), confidence, reason: "allergen" };
    }
  }
  return null;
}

// --- Hele teksten -------------------------------------------------------------------

const LETTER = "a-zA-ZæøåÆØÅäöüÄÖÜéÉèÈ";

// Næringstabellen, der er læst med ind i listen — også OCR-varianter som
// "Fnergi"/"Enerqi" og tal med kJ/kcal.
export const NUTRITION_START = new RegExp(
  `(?<![${LETTER}])(?:[EF][nm]erg[iq1l]|energy|næringsindhold|næringsværdi|næringsdeklaration|nutrition|gennemsnitlig næring)(?![${LETTER}])|\\d+(?:[.,]\\d+)?\\s?(?:kj|kcal)(?![${LETTER}])`,
  "i",
);

// E-nummer, hvor "E" er læst som pund- eller eurotegn ("£202").
export const CURRENCY_E_NUMBER = /[£€]\s?(\d{3,4}[a-d]?)(?!\d)/gi;

// Sikker tegnsætning i en ingrediensliste (bruger 2026-10-17): E-numre skal
// stå frit, så de kan blive til links. Rent mekanisk, intet sprog:
// "karamelE150d" → "karamel E150d", "E-150d"/"e150d" → "E150d", ", ," → ",",
// "aromaer(inkl." → "aromaer (inkl.", "), ," og dobbelte mellemrum.
// Native-kopi: tidyIngredientPunctuation i FoodLogic.kt — ret begge.
export function tidyIngredientPunctuation(text: string): string {
  return text
    .replace(/(?<![\p{L}\d])[eE][-.]?(\d{3,4}[a-dA-D]?)(?!\d)/gu, (_m, code: string) => `E${code.toLowerCase()}`)
    .replace(/(\p{Ll})(E\d{3,4}[a-d]?)(?!\d)/gu, "$1 $2")
    .replace(/,(?:\s*,)+/g, ",")
    .replace(/[ \t]+([,;)])/g, "$1")
    .replace(/([,;])(?=[\p{L}(])/gu, "$1 ")
    .replace(/(\p{L}{2,})\(/gu, "$1 (")
    .replace(/\([ \t]+/g, "(")
    .replace(/\)(?=\p{L})/gu, ") ")
    .replace(/[ \t]{2,}/g, " ");
}

// Hvor næringstabellen begynder: ved støj før den ("£202. ee .06 kcal")
// fra listens sidste punktum.
export function nutritionTailStart(text: string): number | null {
  const match = NUTRITION_START.exec(text);
  if (!match || match.index === 0) return null;
  const head = text.slice(0, match.index);
  const junk = /\.(?:\s+\S{1,3}){1,3}\s*$/u.exec(head) ?? /[\s,;:.|–-]+$/u.exec(head);
  return junk ? junk.index + (junk[0].startsWith(".") ? 1 : 0) : match.index;
}

// Robottens rapport tager også ukendte ord uden forslag med (et ord, der kun
// står i én vare, når kataloget er stort nok til at sige noget) — admin kan
// skrive sin egen rettelse eller afvise det som rigtigt, så det læres.
const UNKNOWN_MIN_CORPUS = 200;

function isUnknownWord(token: string, dictionary: SpellingDictionary): boolean {
  const lower = token.toLowerCase();
  return (
    dictionary.frequency.size >= UNKNOWN_MIN_CORPUS &&
    DANISH_WORD.test(lower) &&
    lower.length >= 5 &&
    (dictionary.frequency.get(lower) ?? 0) <= 1 &&
    !isKnownWord(lower, dictionary)
  );
}

export function findSpellingIssues(
  text: string,
  dictionary: SpellingDictionary,
  options: { reportUnknown?: boolean } = {},
): SpellingFinding[] {
  const findings: SpellingFinding[] = [];
  const tail = nutritionTailStart(text);
  const end = tail ?? text.length;
  for (const match of text.slice(0, end).matchAll(CURRENCY_E_NUMBER)) {
    const start = match.index ?? 0;
    findings.push({ word: match[0], start, end: start + match[0].length, suggestion: `E${match[1].toUpperCase()}`, confidence: 0.97, reason: "e_number" });
  }
  for (const token of tokenize(text.slice(0, end))) {
    const finding = suggestWord(token.text, dictionary);
    if (finding && finding.suggestion !== token.text) findings.push({ ...finding, start: token.start, end: token.end });
    else if (!finding && options.reportUnknown && isUnknownWord(token.text, dictionary)) {
      findings.push({ word: token.text, start: token.start, end: token.end, suggestion: null, confidence: 0.3, reason: "unknown" });
    }
  }
  if (tail !== null) {
    findings.push({ word: text.slice(tail), start: tail, end: text.length, suggestion: "", confidence: 0.92, reason: "nutrition" });
  }
  return findings.sort((a, b) => a.start - b.start);
}

// Erstatter ét ord (start/end) og rydder op efter et slettet ord.
export function replaceAt(text: string, start: number, end: number, replacement: string): string {
  if (replacement) return text.slice(0, start) + replacement + text.slice(end);
  if (end >= text.length) {
    const head = text.slice(0, start).replace(/[\s,;:|–-]+$/u, "");
    return head && !/[.)]$/.test(head) ? `${head}.` : head;
  }
  const before = text.slice(0, start).replace(/[\s,;:|]*$/u, "");
  const after = text.slice(end).replace(/^[\s,;:|]*/u, "");
  if (!before) return after;
  if (!after) return before;
  return /[.!)]$/.test(before) || /^[.)]/.test(after) ? `${before}${/^[.)]/.test(after) ? "" : " "}${after}` : `${before}, ${after}`;
}

// Kun de sikre rettelser (≥ AUTO_FIX_CONFIDENCE; sletning kun af
// næringstabellen) — det, kontrollen ved gem og visningen må gøre uden et
// menneske. De usikre returneres som `uncertain`.
export function applySafeCorrections(
  text: string,
  dictionary: SpellingDictionary,
): { text: string; fixed: string[]; uncertain: SpellingFinding[] } {
  const fixed: string[] = [];
  const uncertain: SpellingFinding[] = [];
  let result = text;
  for (const finding of findSpellingIssues(text, dictionary).reverse()) {
    const safe = finding.confidence >= AUTO_FIX_CONFIDENCE && (finding.suggestion || finding.reason === "nutrition");
    if (!safe || finding.suggestion === null) {
      uncertain.unshift(finding);
      continue;
    }
    result = replaceAt(result, finding.start, finding.end, finding.suggestion);
    fixed.unshift(finding.reason === "nutrition" ? `Næringstabellen fjernet ("${finding.word.slice(0, 30)}")` : `${finding.word} → ${finding.suggestion}`);
  }
  return { text: result, fixed, uncertain };
}

// Uddrag omkring ordet til admin-tabellen (hele ord, "…" ved klip).
export function contextAround(text: string, start: number, end: number, radius = 45): { before: string; word: string; after: string } {
  let from = Math.max(0, start - radius);
  let to = Math.min(text.length, end + radius);
  if (from > 0) from = text.indexOf(" ", from) + 1 || from;
  if (to < text.length) to = text.lastIndexOf(" ", to) > end ? text.lastIndexOf(" ", to) : to;
  return {
    before: (from > 0 ? "…" : "") + text.slice(from, start),
    word: text.slice(start, end),
    after: text.slice(end, to) + (to < text.length ? "…" : ""),
  };
}

// Ordets forekomst nærmest den placering, det blev fundet på (teksten kan være
// rykket af andre rettelser siden).
export function locate(text: string, target: string, position: number): number | null {
  if (!target) return null;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\d])${escaped}(?![\\p{L}\\d])`, "gu");
  let best: number | null = null;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (best === null || Math.abs(index - position) < Math.abs(best - position)) best = index;
  }
  return best;
}
