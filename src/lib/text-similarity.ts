// Letvægts tekst-match uden ekstern dependency — bruges til at afgøre om en
// OCR-læst produkttekst matcher et eksisterende produktnavn ≥90% (se
// docs/DECISIONS.md, kamera-auto-genkendelsesflowet).

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    const currRow = [i];
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow.push(Math.min(prevRow[j] + 1, currRow[j - 1] + 1, prevRow[j - 1] + cost));
    }
    prevRow = currRow;
  }
  return prevRow[n];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9æøå ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 0 (intet til fælles) til 1 (identisk), efter normalisering.
export function textSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const distance = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

// Finder den bedste kandidat i `candidates` (matchet mod `field(candidate)`)
// og returnerer den kun hvis scoren når `threshold` (standard 0.9, jf. krav
// om ≥90%-match).
export function bestTextMatch<T>(
  query: string,
  candidates: T[],
  field: (candidate: T) => string,
  threshold = 0.9
): { candidate: T; score: number } | null {
  let best: { candidate: T; score: number } | null = null;
  for (const candidate of candidates) {
    const score = textSimilarity(query, field(candidate));
    if (!best || score > best.score) best = { candidate, score };
  }
  return best && best.score >= threshold ? best : null;
}
