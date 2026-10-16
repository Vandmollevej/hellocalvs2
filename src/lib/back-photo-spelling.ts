import { isKnownWord, type SpellingDictionary } from "./spelling-engine.ts";
import type { FineReadFinding } from "./back-photo-ai.ts";

// Finlæsningens stavekontrol (docs/DECISIONS.md 2026-10-15, brugerens valg:
// "Ordbog først, AI ved tvivl"). Hvert sted, hvor varens gemte ingrediensliste
// og det læste billede er uenige, afgøres af ordbogen:
// - det gemte ord er et kendt ord → læsningen tager fejl, intet gøres;
// - det gemte ord er ukendt, men det læste er kendt → sikker rettelse;
// - begge er ukendte → tvivl: AI vurderer ordet i sin sammenhæng.

export type ClassifiedFindings = { sure: FineReadFinding[]; doubtful: FineReadFinding[] };

// Ligner ordene mindre end dette, er det ikke en sikker rettelse.
export const SURE_MIN_SIMILARITY = 0.7;
// Sikkerheden på en sikker rettelse (over robottens grænse for automatik).
export const SURE_CONFIDENCE = 0.92;

export function classifyFindings(findings: FineReadFinding[], dictionary: SpellingDictionary): ClassifiedFindings {
  const sure: FineReadFinding[] = [];
  const doubtful: FineReadFinding[] = [];
  for (const finding of findings) {
    if (isKnownWord(finding.word.toLowerCase(), dictionary)) continue;
    if (isKnownWord(finding.suggestion.toLowerCase(), dictionary) && finding.similarity >= SURE_MIN_SIMILARITY) sure.push(finding);
    else doubtful.push(finding);
  }
  return { sure, doubtful };
}

export const DOUBT_PROMPT_VERSION = "spelling-doubt-v1-2026-10-15";

export const DOUBT_SCHEMA = {
  type: "object",
  properties: {
    words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          correct: { type: ["string", "null"] },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: ["index", "correct", "confidence", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["words"],
  additionalProperties: false,
};

export const DOUBT_SYSTEM = [
  "Du er korrekturlæser på ingredienslister for Hello Cal. Du får varens gemte ingrediensliste og en række steder, hvor en tekstlæsning af emballagen stavede et ord anderledes, og hvor ordbogen ikke kender nogen af de to stavemåder.",
  "For hvert sted: vurder ud fra sammenhængen (ingrediensnavne, sprog, E-numre, procenter) hvordan ordet faktisk staves på emballagen. correct = den rigtige stavemåde, eller null hvis det gemte ord allerede er rigtigt eller du ikke kan afgøre det.",
  "Gæt aldrig et nyt ord, der ikke ligner nogen af de to stavemåder. confidence = 0-1. reason = kort begrundelse på dansk.",
].join(" ");

export function doubtText(stored: string, doubtful: FineReadFinding[]): string {
  return [
    `Gemt ingrediensliste: ${stored}`,
    "Tvivlsomme steder (index: gemt ord → læst ord):",
    ...doubtful.map((finding, index) => `${index}: "${finding.word}" → "${finding.suggestion}"`),
  ].join("\n");
}

export type DoubtAnswer = { index: number; correct: string | null; confidence: number; reason: string };

export function cleanDoubtAnswers(value: unknown, count: number): DoubtAnswer[] {
  const words = (value as { words?: unknown } | null)?.words;
  if (!Array.isArray(words)) return [];
  return words
    .map((item) => item as Partial<DoubtAnswer>)
    .filter((item) => Number.isInteger(item.index) && (item.index as number) >= 0 && (item.index as number) < count)
    .map((item) => ({
      index: item.index as number,
      correct: typeof item.correct === "string" && item.correct.trim() ? item.correct.trim().slice(0, 80) : null,
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
      reason: String(item.reason ?? "").slice(0, 200),
    }));
}
