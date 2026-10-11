import offVocabData from "@/data/off-vocab.json";
import { buildVocabIndex, compactKey, type RawVocab, type VocabIndex } from "@/lib/off-name-split";

// Ordforrådet til Open Food Facts-opdeleren: mærker, produkttyper og nøgleord fra
// butiksarkene (scripts/off-import/build_vocab.py → src/data/off-vocab.json),
// suppleret med de mærkenavne, der allerede ligger i databasen.

let base: VocabIndex | null = null;

export function getOffVocabBase(): VocabIndex {
  if (!base) base = buildVocabIndex(offVocabData as unknown as RawVocab);
  return base;
}

// Mærker fra databasen lægges oven på (cachen holder 10 minutter).
const BRAND_TTL_MS = 10 * 60 * 1000;
let withBrands: { index: VocabIndex; at: number } | null = null;

export async function getOffVocab(loadBrandNames?: () => Promise<string[]>): Promise<VocabIndex> {
  const index = getOffVocabBase();
  if (!loadBrandNames) return index;
  if (withBrands && Date.now() - withBrands.at < BRAND_TTL_MS) return withBrands.index;
  try {
    const names = await loadBrandNames();
    // en kopi, så grundordforrådet forbliver urørt
    const copy: VocabIndex = { ...index, brandByCk: new Map(index.brandByCk) };
    for (const name of names) {
      const ck = compactKey(name);
      if (ck.length >= 2 && !copy.brandByCk.has(ck)) {
        copy.brandByCk.set(ck, { name, n: 1, chain: false, topType: "", topShare: 0 });
      }
    }
    withBrands = { index: copy, at: Date.now() };
    return copy;
  } catch (error) {
    console.error("OFF vocab: could not load brand names", error);
    return index;
  }
}
