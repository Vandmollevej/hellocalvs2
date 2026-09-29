// Client-side access to the E-number reference database (the "additives"
// table, see prisma/schema.prisma and scripts/e-numre/). The entire table
// (~343 rows) is fetched once via /api/additives and cached in the module,
// so both AdditiveInfoModal and the product page can look up synchronously
// after the first fetch.

export type AdditiveInfo = {
  eNumber: string;
  internationalName: string;
  danishName: string;
  function: string;
  risks: string;
  research: string;
  link: string;
  source: string;
};

const FALLBACK: AdditiveInfo = {
  eNumber: "",
  internationalName: "Ukendt tilsætningsstof",
  danishName: "",
  function: "",
  risks: "Vi har endnu ikke data om dette tilsætningsstof.",
  research: "",
  link: "",
  source: "",
};

let cache: Map<string, AdditiveInfo> | null = null;
let inflight: Promise<Map<string, AdditiveInfo>> | null = null;

async function loadAdditives(): Promise<Map<string, AdditiveInfo>> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch("/api/additives")
      .then((res) => {
        if (!res.ok) throw new Error("Kunne ikke hente E-nummer-database");
        return res.json();
      })
      .then((data: { additives: Array<Record<string, string>> }) => {
        const map = new Map<string, AdditiveInfo>();
        for (const row of data.additives) {
          const code = row.eNumber.toUpperCase();
          map.set(code, {
            eNumber: row.eNumber,
            internationalName: row.internationalName,
            danishName: row.danishName,
            function: row.function,
            risks: row.risks,
            research: row.research,
            link: row.link,
            source: row.source,
          });
        }
        cache = map;
        return map;
      })
      .catch((error) => {
        inflight = null;
        throw error;
      });
  }
  return inflight;
}

export function useAdditiveLookup() {
  return loadAdditives;
}

// Anchor id for an E-number on the /e-numre page, e.g. "E330" -> "e330".
export function additiveAnchorId(code: string): string {
  return code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function additiveHref(code: string): string {
  return `/e-numre#${additiveAnchorId(code)}`;
}

export async function getAllAdditives(): Promise<AdditiveInfo[]> {
  const map = await loadAdditives();
  return Array.from(map.values());
}

export async function getAdditiveInfo(code: string): Promise<AdditiveInfo> {
  const normalized = code.toUpperCase();
  try {
    const map = await loadAdditives();
    return map.get(normalized) ?? { ...FALLBACK, eNumber: normalized };
  } catch {
    return { ...FALLBACK, eNumber: normalized };
  }
}

export type IngredientTextPart = { text: string; code?: string };

// Splits an ingredient list into plain text and E-number tokens ("E330",
// "E 150d", "e-471") so the UI can render the E-numbers as clickable links.
export function splitENumbers(text: string): IngredientTextPart[] {
  const parts: IngredientTextPart[] = [];
  const pattern = /\bE[\s-]?(\d{3,4}[a-z]?(?:\([iv]+\))?)(?![\w])/gi;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    const code = `E${match[1].replace(/\(.*\)$/, "")}`.toUpperCase();
    parts.push({ text: match[0], code });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// All E-numbers sorted by number (E100 before E1100), for the E-number page.
export async function listAdditives(): Promise<AdditiveInfo[]> {
  const map = await loadAdditives();
  const num = (code: string) => parseInt(code.replace(/\D/g, ""), 10) || 0;
  return [...map.values()].sort((a, b) => num(a.eNumber) - num(b.eNumber) || a.eNumber.localeCompare(b.eNumber));
}

// Matches an E-number by code ("e330", "330") or by Danish/international name.
export function matchesAdditive(additive: AdditiveInfo, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const code = additive.eNumber.toLowerCase();
  if (code.includes(q) || code.replace(/^e/, "").startsWith(q.replace(/^e\s*/, ""))) return true;
  return `${additive.danishName} ${additive.internationalName} ${additive.function}`.toLowerCase().includes(q);
}
