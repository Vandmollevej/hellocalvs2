import { prisma } from "@/lib/prisma";
import { cached, invalidateCache } from "@/lib/ttl-cache";
import { createDictionary, type SpellingDictionary } from "@/lib/spelling-engine";

// Den fulde ordbog til serveren (docs/DECISIONS.md 2026-10-14): grundlisten +
// katalogets ordforråd (spelling_words, skrevet af nattens robot) + admins
// afgørelser (spelling_rules). Bruges af robotten og af kontrollen, når en
// ingrediensliste gemmes — så en rettelse, admin godkender i dag, også
// gælder den næste vare, der scannes.

const CACHE_KEY = "spelling-dictionary";
const CACHE_MS = 10 * 60 * 1000;

export async function buildSpellingDictionary(frequency?: Map<string, number>): Promise<SpellingDictionary> {
  const [rules, words] = await Promise.all([
    prisma.spellingRule.findMany({ select: { word: true, replacement: true } }),
    frequency ? Promise.resolve(null) : prisma.spellingWord.findMany({ select: { word: true, productCount: true } }),
  ]);
  return createDictionary({
    frequency: frequency ?? new Map((words ?? []).map((row) => [row.word, row.productCount])),
    knownWords: rules.filter((rule) => rule.replacement === null).map((rule) => rule.word),
    corrections: rules.filter((rule) => rule.replacement !== null).map((rule) => [rule.word, rule.replacement as string]),
  });
}

// Fejler opslaget (fx før migrationen er kørt), bruges grundlisten.
export async function loadSpellingDictionary(): Promise<SpellingDictionary> {
  return cached(CACHE_KEY, CACHE_MS, () => buildSpellingDictionary()).catch(() => createDictionary());
}

export function invalidateSpellingDictionary() {
  invalidateCache(CACHE_KEY);
}
