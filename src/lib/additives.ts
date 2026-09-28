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
