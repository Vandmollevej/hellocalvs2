// Whole-grain content from an ingredient declaration (docs/DECISIONS.md
// 2026-09-23). Pure and deterministic — runs on Product.ingredientsText (and
// front-label claims), so it can be re-run any time the parsing improves,
// without new OCR/AI calls.
//
// Rules:
// - An explicit total ("41% fuldkorn", "Fuldkornsindhold 41%") wins.
// - Otherwise whole-grain ingredients with a percent of the WHOLE product are
//   summed. A percent inside a sub-mix is multiplied by the sub-mix's own
//   percent ("Kornblanding 60% [fuldkornshvede 50%, …]" → 30%). If any
//   whole-grain part has no determinable share, the percent is null — never
//   a guess — while isWholeGrain stays true.
// - false/0 only when a real ingredient list exists and contains no
//   whole-grain ingredient. No list → null (unknown), never false.
// - Percentages are 0–100, never 0–1.

import { normalizePercent } from "@/lib/nutrition-normalize";

export type WholeGrainResult = {
  wholeGrainPercent: number | null;
  isWholeGrain: boolean | null;
  // "explicit" = a percent printed on the package; "derived" = summed or
  // multiplied from ingredient percentages / absence of whole grain.
  kind: "explicit" | "derived" | "presence" | "unknown";
  confidence: number;
  evidence: string[];
};

// Whole-grain wording across the markets the OCR pipeline reads (da, sv/no,
// en, de, nl, it/es/pt, fr, fi, pl). Matched as word prefixes, so
// "fuldkornshvedemel" and "Vollkornweizenmehl" both hit.
const WHOLE_GRAIN_PREFIX =
  /(fuldkorn|fullkorn|fuldkorns|whole\s?-?grain|wholegrain|whole\s?-?wheat|wholewheat|whole\s?-?meal|wholemeal|vollkorn|volkoren|integral|integrale|complet(?:e)?\s+(?:de\s+)?(?:bl[eé]|farine)|t[äa]ysjyv[äa]|pe[łl]noziarnist)/i;

// Ingredients that are whole grain by nature even without the word.
const INHERENTLY_WHOLE_GRAIN =
  /\b(havregryn|havreflager|rugkerner|hele\s+rugkerner|hele\s+hvedekerner|brune\s+ris|brun\s+ris|rolled\s+oats|oat\s+flakes|porridge\s+oats|brown\s+rice|haferflocken|havregrynsmel|bulgur)\b/i;

// A standalone total statement: the whole-grain word NOT glued to another
// ingredient word, next to a percent.
const EXPLICIT_TOTAL_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*%\s*(?:af\s+)?(?:fuldkorn|fullkorn|whole\s?-?grains?|wholegrains?|vollkorn|volkoren|integrale?)(?![a-zæøå])/i,
  /(?:fuldkornsindhold|fuldkornsandel|indhold\s+af\s+fuldkorn|fuldkorn|fullkornsandel|whole\s?-?grain\s+content|whole\s?-?grains?|vollkornanteil|volkorenaandeel)(?![a-zæøå])\s*[:=]?\s*(?:min\.?\s*|mindst\s*|at\s+least\s*)?(\d+(?:\.\d+)?)\s*%/i,
];

// Cereal words — used only to lower confidence of a "no whole grain" verdict.
const CEREAL_WORDS =
  /(hvede|wheat|weizen|tarwe|rug|rye|roggen|havre|oat|hafer|haver|byg|barley|gerste|spelt|dinkel|majs|maize|corn|ris\b|rice|reis|mel\b|flour|mehl|meel|gryn|kerner|semolina|durum|couscous|bulgur|quinoa|boghvede|buckwheat|hirse|millet)/i;

type Item = { text: string; percent: number | null; children: Item[] };

function normalizeText(text: string) {
  return (
    text
      .replace(/\r?\n/g, " ")
      // Decimal comma inside numbers → dot ("8,4 %" → "8.4 %").
      .replace(/(\d),(\d)/g, "$1.$2")
      .replace(/\s+/g, " ")
      .trim()
  );
}

// Allergen trace statements ("Kan indeholde spor af …") are not ingredients.
function stripTraceStatements(text: string) {
  return text.replace(
    /(kan\s+indeholde|may\s+contain|kann\s+spuren|kan\s+sporen|produceret\s+på|fremstillet\s+på|produced\s+in\s+a\s+factory)[^.]*\.?/gi,
    " "
  );
}

// Everything before "ingredienser:"-style headings is packaging noise.
function stripLeadIn(text: string) {
  const match = text.match(/(ingredienser|ingredients|zutaten|ingrediënten|ingredienti|ingredientes|ingrédients|ainesosat|sk[łl]adniki)\s*:/i);
  return match && match.index !== undefined ? text.slice(match.index + match[0].length) : text;
}

const OPEN = "([{";
const CLOSE = ")]}";

function parseItems(text: string): Item[] {
  const items: Item[] = [];
  let depth = 0;
  let start = 0;
  const pushItem = (raw: string) => {
    const trimmed = raw.trim().replace(/^[.;:]+|[.;:]+$/g, "").trim();
    if (trimmed) items.push(parseItem(trimmed));
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
    else if ((ch === "," || ch === ";") && depth === 0) {
      pushItem(text.slice(start, i));
      start = i + 1;
    }
  }
  pushItem(text.slice(start));
  return items;
}

function parseItem(raw: string): Item {
  // Split own text from bracketed sub-ingredients.
  let own = "";
  const childTexts: string[] = [];
  let depth = 0;
  let buffer = "";
  for (const ch of raw) {
    if (OPEN.includes(ch)) {
      if (depth === 0) buffer = "";
      else buffer += ch;
      depth++;
    } else if (CLOSE.includes(ch) && depth > 0) {
      depth--;
      if (depth === 0) childTexts.push(buffer);
      else buffer += ch;
    } else if (depth > 0) buffer += ch;
    else own += ch;
  }
  const percentMatch = own.match(/(\d+(?:\.\d+)?)\s*%/);
  const children = childTexts.flatMap((childText) => parseItems(childText));
  // "Fuldkornshvedemel (62%)": a lone percent in brackets belongs to the item.
  let percent = percentMatch ? Number(percentMatch[1]) : null;
  if (percent === null && children.length === 1 && children[0].text === "" && children[0].children.length === 0) {
    percent = children[0].percent;
    children.length = 0;
  }
  return { text: own.replace(/(\d+(?:\.\d+)?)\s*%/g, "").trim(), percent, children };
}

function isWholeGrainName(text: string) {
  return WHOLE_GRAIN_PREFIX.test(text) || INHERENTLY_WHOLE_GRAIN.test(text);
}

type Contribution = { percent: number | null; nested: boolean; evidence: string };

// Share of the WHOLE product for each whole-grain part under `item`, where
// `parentShare` is the item's own share of the product (100 at top level).
function collect(item: Item, parentShare: number | null, depth: number, out: Contribution[]) {
  const ownShare =
    item.percent === null ? null : parentShare === null ? null : (parentShare * item.percent) / 100;
  if (isWholeGrainName(item.text)) {
    out.push({
      percent: ownShare,
      nested: depth > 0,
      evidence: item.percent !== null ? `${item.text} ${item.percent}%` : item.text,
    });
    return;
  }
  for (const child of item.children) collect(child, ownShare, depth + 1, out);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function parseWholeGrain(input: { ingredientsText?: string | null; claims?: string[] }): WholeGrainResult {
  const ingredientsText = normalizeText(input.ingredientsText ?? "");
  const claims = (input.claims ?? []).map(normalizeText).filter(Boolean);

  // 1. Explicit total on the package (ingredients text or front claims).
  for (const source of [ingredientsText, ...claims]) {
    for (const pattern of EXPLICIT_TOTAL_PATTERNS) {
      const match = source.match(pattern);
      if (match) {
        const percent = normalizePercent(Number(match[1]));
        if (percent !== null) {
          return {
            wholeGrainPercent: percent,
            isWholeGrain: percent > 0,
            kind: "explicit",
            confidence: 0.95,
            evidence: [match[0].trim()],
          };
        }
      }
    }
  }

  const claimMentions = claims.filter((claim) => WHOLE_GRAIN_PREFIX.test(claim));
  const listText = stripTraceStatements(stripLeadIn(ingredientsText));
  const items = listText ? parseItems(listText) : [];

  if (items.length === 0) {
    // No ingredient list: only a claim like "rig på fuldkorn" can tell us
    // anything, and it never gives a percent.
    return claimMentions.length
      ? { wholeGrainPercent: null, isWholeGrain: true, kind: "presence", confidence: 0.7, evidence: claimMentions }
      : { wholeGrainPercent: null, isWholeGrain: null, kind: "unknown", confidence: 0, evidence: [] };
  }

  // 2. Whole-grain ingredients and their share of the product.
  const contributions: Contribution[] = [];
  for (const item of items) collect(item, 100, 0, contributions);

  if (contributions.length === 0) {
    if (claimMentions.length) {
      // Claim says whole grain but the list doesn't show which part.
      return { wholeGrainPercent: null, isWholeGrain: true, kind: "presence", confidence: 0.6, evidence: claimMentions };
    }
    // A real list with no whole-grain ingredient.
    const hasCereal = items.some((item) => CEREAL_WORDS.test(item.text) || item.children.some((c) => CEREAL_WORDS.test(c.text)));
    return {
      wholeGrainPercent: 0,
      isWholeGrain: false,
      kind: "derived",
      confidence: hasCereal ? 0.7 : 0.85,
      evidence: [],
    };
  }

  const evidence = contributions.map((c) => c.evidence);
  if (contributions.some((c) => c.percent === null)) {
    return { wholeGrainPercent: null, isWholeGrain: true, kind: "presence", confidence: 0.8, evidence };
  }

  const total = contributions.reduce((sum, c) => sum + (c.percent ?? 0), 0);
  const percent = normalizePercent(round(total));
  if (percent === null) {
    // Sums over 100 mean the percentages weren't all of the whole product.
    return { wholeGrainPercent: null, isWholeGrain: true, kind: "presence", confidence: 0.5, evidence };
  }

  const nested = contributions.some((c) => c.nested);
  const single = contributions.length === 1 && !nested;
  return {
    wholeGrainPercent: percent,
    isWholeGrain: percent > 0,
    // One top-level ingredient with its printed percent is as good as an
    // explicit statement; sums/multiplications are derived.
    kind: single ? "explicit" : "derived",
    confidence: single ? 0.95 : nested ? 0.75 : 0.85,
    evidence,
  };
}

