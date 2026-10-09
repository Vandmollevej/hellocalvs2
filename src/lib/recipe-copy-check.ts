// Kopi-tjek af delte retter (brugerens krav 2026-10-07): teksten i en ret, der
// deles med andre, sammenlignes med andre retter. Over 80 % sammenfald flagges
// som advarsel til admin med kilden, en indlejret visning af begge tekster og
// de sammenfaldende tekststykker markeret.
//
// Sammenfaldet måles på ordniveau: en ret er "dækket" i de ord, der indgår i
// en række af SHINGLE_SIZE ord, som også står i kilden. Andelen af dækkede ord
// er sammenfaldet. Ren funktion, ingen databaseadgang.

export const COPY_THRESHOLD = 0.8;
const SHINGLE_SIZE = 4;

export type CopyCheckSource = { kind: "shared" | "hellofresh" | "valdemarsro"; id: string; name: string; text: string };

// [start, slut) i ordlisten.
export type WordRange = [number, number];

export type CopyCheckResult = {
  ratio: number;
  source: { kind: CopyCheckSource["kind"]; id: string; name: string };
  candidateWords: string[];
  sourceWords: string[];
  candidateRanges: WordRange[];
  sourceRanges: WordRange[];
};

type Tokens = { words: string[]; norm: string[] };

function tokenize(text: string): Tokens {
  const words: string[] = [];
  const norm: string[] = [];
  for (const raw of text.split(/\s+/)) {
    const key = raw.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    if (!key) continue;
    words.push(raw);
    norm.push(key);
  }
  return { words, norm };
}

function shingles(norm: string[]): string[] {
  if (norm.length === 0) return [];
  if (norm.length < SHINGLE_SIZE) return [norm.join(" ")];
  const out: string[] = [];
  for (let i = 0; i + SHINGLE_SIZE <= norm.length; i += 1) out.push(norm.slice(i, i + SHINGLE_SIZE).join(" "));
  return out;
}

// Ordpositioner dækket af et vindue, hvis shingle findes i `other`.
function coveredRanges(norm: string[], other: Set<string>): WordRange[] {
  const covered = new Array<boolean>(norm.length).fill(false);
  const size = Math.min(SHINGLE_SIZE, norm.length);
  const list = shingles(norm);
  list.forEach((shingle, start) => {
    if (!other.has(shingle)) return;
    for (let i = start; i < start + size; i += 1) covered[i] = true;
  });
  const ranges: WordRange[] = [];
  let start = -1;
  for (let i = 0; i <= covered.length; i += 1) {
    if (covered[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      ranges.push([start, i]);
      start = -1;
    }
  }
  return ranges;
}

function rangeWordCount(ranges: WordRange[]) {
  return ranges.reduce((sum, [from, to]) => sum + (to - from), 0);
}

export function compareTexts(candidate: string, source: string) {
  const a = tokenize(candidate);
  const b = tokenize(source);
  if (a.norm.length === 0 || b.norm.length === 0) return null;
  const candidateRanges = coveredRanges(a.norm, new Set(shingles(b.norm)));
  const sourceRanges = coveredRanges(b.norm, new Set(shingles(a.norm)));
  return {
    ratio: rangeWordCount(candidateRanges) / a.norm.length,
    candidateWords: a.words,
    sourceWords: b.words,
    candidateRanges,
    sourceRanges,
  };
}

// Den kilde med størst sammenfald, hvis den når tærsklen.
export function findCopy(
  candidate: string,
  sources: CopyCheckSource[],
  threshold = COPY_THRESHOLD,
): CopyCheckResult | null {
  let best: CopyCheckResult | null = null;
  for (const source of sources) {
    const result = compareTexts(candidate, source.text);
    if (!result || result.ratio < threshold) continue;
    if (!best || result.ratio > best.ratio) {
      best = {
        ratio: result.ratio,
        source: { kind: source.kind, id: source.id, name: source.name },
        candidateWords: result.candidateWords,
        sourceWords: result.sourceWords,
        candidateRanges: result.candidateRanges,
        sourceRanges: result.sourceRanges,
      };
    }
  }
  return best;
}

// Teksten, der sammenlignes: titel, ingredienser og fremgangsmåde.
export function recipeCopyText(name: string, ingredientNames: string[], stepsText: string) {
  return [name, ingredientNames.join(". "), stepsText].filter(Boolean).join("\n");
}
