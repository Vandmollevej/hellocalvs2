// "nescafe" skal finde "Nescafé": Postgres' `contains … insensitive` skelner
// mellem e og é. Vi tilføjer derfor varianter af søgeteksten, hvor et eller
// flere e'er er é (café, purée, crème …). Højst 4 e'er giver højst 15 varianter.
const MAX_E = 4;

export function accentVariants(query: string): string[] {
  const positions = [...query.matchAll(/e/gi)].map((m) => m.index!);
  if (positions.length === 0 || positions.length > MAX_E) return [];
  const out = new Set<string>();
  for (let mask = 1; mask < 1 << positions.length; mask++) {
    const chars = query.split("");
    positions.forEach((pos, i) => {
      if (mask & (1 << i)) chars[pos] = chars[pos] === "E" ? "É" : "é";
    });
    out.add(chars.join(""));
  }
  out.delete(query);
  return [...out];
}
