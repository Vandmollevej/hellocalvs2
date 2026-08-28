// Klient-side adgang til E-nummer-referencedatabasen (tabellen "additives",
// se prisma/schema.prisma og scripts/e-numre/). Hele tabellen (~343 rækker)
// hentes én gang via /api/additives og caches i modulet, så både
// AdditiveInfoModal og produktsiden kan slå op synkront efter første hentning.

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
