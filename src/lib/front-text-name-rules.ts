// Ren logik til src/lib/front-text-name.ts (testet i front-text-name.test.mjs):
// varetypen findes blandt ord/ordpar i telefonens tekstlæsning af forsiden.

const MIN_WORD_LENGTH = 4;
// Et varenavn skal findes på mindst så mange varer for at gælde som varetype.
export const MIN_NAME_COUNT = 2;

const key = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

// Ord og ordpar (fx "hakkede tomater") fra teksten, med små bogstaver.
export function nameCandidates(texts: (string | null | undefined)[]): string[] {
  const candidates = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const line of text.split(/\n+/)) {
      const words = line.toLowerCase().match(/\p{L}+/gu) ?? [];
      words.forEach((word, index) => {
        if (word.length >= MIN_WORD_LENGTH) candidates.add(word);
        const next = words[index + 1];
        if (next && word.length >= 2 && next.length >= 3) candidates.add(`${word} ${next}`);
      });
    }
  }
  return [...candidates];
}

// Den mest specifikke varetype: det længste kandidatnavn, der findes på
// mindst MIN_NAME_COUNT varer ("letmælk" vinder over "mælk"); lige lange
// afgøres af antallet af varer. Brand/subbrand (`exclude`) er aldrig varetypen.
export function pickProductType(rows: { name: string; count: number }[], exclude: string[] = []): string | null {
  const excluded = new Set(exclude.map(key).filter(Boolean));
  const byKey = new Map<string, { name: string; count: number; best: number }>();
  for (const row of rows) {
    const name = row.name.trim();
    const k = name.toLowerCase();
    if (!k || excluded.has(key(k))) continue;
    const entry = byKey.get(k) ?? { name, count: 0, best: 0 };
    entry.count += row.count;
    // Den hyppigste stavemåde (fx "Letmælk" frem for "LETMÆLK").
    if (row.count > entry.best) {
      entry.best = row.count;
      entry.name = name;
    }
    byKey.set(k, entry);
  }
  const ranked = [...byKey.values()]
    .filter((entry) => entry.count >= MIN_NAME_COUNT)
    .sort((a, b) => b.name.length - a.name.length || b.count - a.count);
  return ranked[0]?.name ?? null;
}
