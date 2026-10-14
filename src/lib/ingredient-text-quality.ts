// Kvalitetskontrol af en aflæst ingrediensliste (docs/DECISIONS.md 2026-10-14).
// Brugerens test (kinesisk chilisauce): "SOYA" i stedet for "SOJA",
// citronsyre "E202" læst som "£202" og næringstabellens "Energi" læst som
// "Fnergi" — alt sammen gemt uden at nogen opdagede det.
//
// - `fixes`: sikre rettelser, der laves automatisk (E-nummer læst som £/€,
//   dansk stavning "soja", næringstabellen skåret fra listen).
// - `doubts`: tegn på fejllæsning, som ikke kan rettes sikkert. Telefonens
//   egen aflæsning bruges så ikke (AI læser billedet), og AI'ens aflæsning
//   sættes ned i sikkerhed, så den står på admin → Usikkerheder → Indhold.
//
// Ingen imports med "@/": modulet testes direkte med node --test.

import { DANISH_ALLERGEN_STEMS, DANISH_ALLERGEN_WORDS, DANISH_INGREDIENT_WORDS } from "./ingredient-words.ts";

export type IngredientTextReview = { text: string; fixes: string[]; doubts: string[] };

// AI-aflæsninger med tvivl får højst denne sikkerhed (under URGENT_BELOW = 0,7
// i src/lib/uncertainty-thresholds.ts → rød og øverst på Usikkerheder).
export const DOUBTFUL_INGREDIENTS_CONFIDENCE = 0.6;

const LETTER = "a-zA-ZæøåÆØÅäöüÄÖÜéÉèÈ";

// E-nummer, hvor OCR/AI har læst "E" som pund- eller eurotegn.
const CURRENCY_E_NUMBER = /[£€]\s?(\d{3,4}[a-d]?)(?![\d])/gi;

// Næringstabellen, der er læst med ind i listen — også OCR-varianter som
// "Fnergi"/"Enerqi" og tal med kJ/kcal.
const NUTRITION_START = new RegExp(
  `(?<![${LETTER}])(?:[EF][nm]erg[iq1l]|energy|næringsindhold|næringsværdi|næringsdeklaration|nutrition|gennemsnitlig næring)(?![${LETTER}])|\\d+(?:[.,]\\d+)?\\s?(?:kj|kcal)(?![${LETTER}])`,
  "i",
);

// Tegn, der aldrig står i en ingrediensliste.
const ODD_CHARS = /[£€$@#|\\~^{}_¤§]/;

// Ord, der kun findes i danske ingredienslister — afgør dansk stavning, når
// sproget ikke er oplyst (telefonens egen aflæsning).
const DANISH_WORDS =
  /(?<![a-zæøå])(?:ingredienser|sukker|vand|olie|hvede\w*|mælk\w*|krydderi\w*|eddike|hvidløg|stivelse|surhedsregulerende|konserveringsmiddel|farvestof|fortykningsmiddel|smagsforstærker|rapsolie|solsikkeolie|chili|citronsyre|salt|og|med)(?![a-zæøå])/giu;

export function looksDanish(text: string, language?: string | null): boolean {
  if (language) return /^(da|dan|dansk|danish)\b/i.test(language.trim());
  if (/[æøå]/i.test(text)) return true;
  return (text.match(DANISH_WORDS) ?? []).length >= 3;
}

// "soya" → "soja" med samme store/små bogstaver (SOYA → SOJA, Soyabønner → Sojabønner).
function danishSoja(text: string): string {
  return text.replace(new RegExp(`(?<![${LETTER}])(s)(o)(y)(a)`, "gi"), (_m, s, o, y, a) => `${s}${o}${y === "Y" ? "J" : "j"}${a}`);
}

// OCR-vægtet afstand (brugerens test: "SOIASAUCE", "SFSAMFRØ"/"FSAMFRØ",
// "krydderler", "cltronsyre"): tegn, Tesseract forveksler (E/F, I/J, I/L,
// O/0, S/5 …), koster 0,5; alt andet (ombytning, manglende/ekstra tegn) 1,1.
const LOOK_ALIKE = ["ef", "ij", "il", "jl", "o0", "i1", "l1", "s5", "b8", "ce", "uv", "nm", "oq", "gq", "rn", "ao", "øo", "æa"];
const LOOK_ALIKE_SET = new Set(LOOK_ALIKE.flatMap((pair) => [pair, pair[1] + pair[0]]));
const OTHER_COST = 1.1;
const LOOK_ALIKE_COST = 0.5;

export function ocrDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index * OTHER_COST);
  for (let i = 1; i <= a.length; i++) {
    const current = [i * OTHER_COST];
    for (let j = 1; j <= b.length; j++) {
      const same = a[i - 1] === b[j - 1];
      const substitution = same ? 0 : LOOK_ALIKE_SET.has(a[i - 1] + b[j - 1]) ? LOOK_ALIKE_COST : OTHER_COST;
      current[j] = Math.min(previous[j - 1] + substitution, previous[j] + OTHER_COST, current[j - 1] + OTHER_COST);
    }
    previous = current;
  }
  return previous[b.length];
}

const KNOWN = new Set<string>([...DANISH_INGREDIENT_WORDS, ...DANISH_ALLERGEN_WORDS]);
// Allergen-kandidater: selve ordene og forled + ord fra ordlisten.
const ALLERGEN_CANDIDATES = [
  ...new Set<string>([
    ...DANISH_ALLERGEN_WORDS,
    ...DANISH_ALLERGEN_STEMS.flatMap((stem) => DANISH_INGREDIENT_WORDS.filter((word) => word.length >= 3).map((word) => stem + word)),
  ]),
];

// Et kendt ord eller sammensat af kendte ord (evt. med binde-s: "sennepsfrø").
function knownWord(word: string, depth = 0): boolean {
  if (KNOWN.has(word)) return true;
  if (depth > 2) return false;
  for (let index = 2; index <= word.length - 3; index++) {
    const head = word.slice(0, index);
    if (!KNOWN.has(head) || (head.length < 3 && head !== "æg")) continue;
    const rest = word.slice(index);
    if (knownWord(rest, depth + 1)) return true;
    if (rest.startsWith("s") && rest.length > 3 && knownWord(rest.slice(1), depth + 1)) return true;
  }
  return false;
}

function closest(word: string, candidates: Iterable<string>, maxCost: number): string | null {
  let best: string | null = null;
  let bestCost = Infinity;
  let tie = false;
  for (const candidate of candidates) {
    if (Math.abs(candidate.length - word.length) > 2) continue;
    const cost = ocrDistance(word, candidate);
    if (cost < bestCost) {
      best = candidate;
      bestCost = cost;
      tie = false;
    } else if (cost === bestCost && candidate !== best) {
      tie = true;
    }
  }
  return best && !tie && bestCost <= maxCost ? best : null;
}

function withCaseOf(token: string, word: string): string {
  const letters = token.replace(/[^\p{L}]/gu, "");
  if (letters && letters === letters.toUpperCase()) return word.toUpperCase();
  if (token[0] && token[0] === token[0].toUpperCase() && token[0] !== token[0].toLowerCase()) return word[0].toUpperCase() + word.slice(1);
  return word;
}

// Et ukendt ord rettes til det nærmeste kendte ord:
// - med små bogstaver kun via forvekslelige tegn (højst to, fx "krydderler"),
//   så et rigtigt, ukendt ord ("salat") aldrig laves om til et andet ("salt");
// - med STORE bogstaver er det et allergen (EU 1169/2011): nærmeste allergen,
//   også med ét manglende/ekstra tegn ("FSAMFRØ" → "SESAMFRØ", "SOIASAUCE" → "SOJASAUCE").
function fixOcrWord(token: string): string | null {
  const lower = token.toLowerCase();
  const letters = lower.replace(/[^\p{L}]/gu, "").length;
  if (letters < 4 || knownWord(lower)) return null;
  const upper = /\p{L}/u.test(token) && token === token.toUpperCase();
  const word =
    (upper && letters >= 5 ? closest(lower, ALLERGEN_CANDIDATES, Math.min(2.2, lower.length * 0.3)) : null) ??
    closest(lower, KNOWN, 1.0);
  return word && word !== lower ? withCaseOf(token, word) : null;
}

function fixOcrWords(text: string): { text: string; fixed: string[] } {
  const fixed: string[] = [];
  const result = text.replace(/[\p{L}1]+/gu, (token) => {
    if (!/\p{L}/u.test(token)) return token;
    const fix = fixOcrWord(token);
    if (!fix) return token;
    fixed.push(`${token} → ${fix}`);
    return fix;
  });
  return { text: result, fixed };
}

// Korte ord, der godt kan stå i en dansk/engelsk ingrediensliste.
const SHORT_WORDS = new Set(["og", "af", "i", "à", "a", "e", "el", "de", "en", "et", "ca", "pr", "g", "kg", "mg", "ml", "cl", "l", "ost", "æg", "or", "of", "in", "and", "to", "vit", "msg", "b", "c", "d", "k", "ph", "uv"]);

// Brudstykker, der ikke er ord: bogstaver og tal blandet (":699k1" — men ikke
// E-numre, procenter, "B12", "D3", "omega-3"), og ét-/to-bogstavsstumper ("ee").
export function junkTokens(text: string): string[] {
  const junk: string[] = [];
  for (const token of text.split(/[\s,;:()[\]/]+/u)) {
    const bare = token.replace(/^[.\-–*]+|[.\-–*%]+$/gu, "");
    if (!bare) continue;
    const hasLetter = /\p{L}/u.test(bare);
    const hasDigit = /\d/.test(bare);
    if (hasLetter && hasDigit) {
      if (/^E\d{3,4}[a-d]?$/i.test(bare) || /^(?:vitamin-?)?[A-Z]\d{1,2}$/i.test(bare) || /^omega-?\d$/i.test(bare)) continue;
      if (/^\d+(?:[.,]\d+)?(?:g|kg|mg|ml|cl|l|%)$/i.test(bare)) continue;
      junk.push(token);
      continue;
    }
    if (hasLetter && bare.length <= 2 && !SHORT_WORDS.has(bare.toLowerCase())) junk.push(token);
  }
  return junk;
}

function unbalancedParentheses(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth -= 1;
    if (depth < 0) return true;
  }
  return depth !== 0;
}

// Visning af lister, der blev gemt før kontrollen: de samme sikre rettelser
// (E-nummer, dansk stavning, OCR-ord, næringstabellen skåret fra); data i
// databasen ændres ikke.
export function displayIngredientsText(text: string): string {
  return reviewIngredientsText(text).text || text;
}

export function reviewIngredientsText(raw: string, language?: string | null): IngredientTextReview {
  const fixes: string[] = [];
  const doubts: string[] = [];
  let text = raw.trim();
  if (!text) return { text, fixes, doubts };

  const nutrition = NUTRITION_START.exec(text);
  if (nutrition && nutrition.index > 0) {
    // Støj mellem listens sidste punktum og tabellen ("£202. ee .06 kcal") fjernes.
    text = text
      .slice(0, nutrition.index)
      .replace(/[\s,;:.|–-]+$/u, "")
      .replace(/\.(?:\s+\S{1,3}){1,3}$/u, ".")
      .trim();
    if (text && !/[.)]$/.test(text)) text += ".";
    fixes.push(`Næringstabellen skåret fra listen ("${nutrition[0]}")`);
  } else if (nutrition) {
    doubts.push(`Listen starter med næringstabellen ("${nutrition[0]}")`);
  }

  const withE = text.replace(CURRENCY_E_NUMBER, (_m, digits: string) => `E${digits.toUpperCase()}`);
  if (withE !== text) {
    fixes.push("E-nummer læst som £/€ rettet til E");
    text = withE;
  }

  if (looksDanish(text, language)) {
    const soja = danishSoja(text);
    if (soja !== text) {
      fixes.push('Dansk stavning: "soya" → "soja"');
      text = soja;
    }
    const words = fixOcrWords(text);
    if (words.fixed.length) {
      fixes.push(`OCR-fejl rettet: ${words.fixed.join(", ")}`);
      text = words.text;
    }
  }

  const odd = text.match(ODD_CHARS);
  if (odd) doubts.push(`Usædvanligt tegn "${odd[0]}" i listen`);
  if (unbalancedParentheses(text)) doubts.push("Parenteserne går ikke op");
  const junk = junkTokens(text);
  if (junk.length) doubts.push(`Volapyk i listen: ${junk.slice(0, 5).join(" ")}`);
  const letters = text.replace(/[^\p{L}]/gu, "").length;
  if (letters < text.replace(/\s/g, "").length * 0.6) doubts.push("For få bogstaver — teksten ligner støj");

  return { text, fixes, doubts };
}
