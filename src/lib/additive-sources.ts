// Alternative, trustworthy sources for an E-number (task #34). Built purely
// from the E-number/name so every row in the additives table gets the same set
// of independent references beside its own primary `link`/`source`.

export type AdditiveSource = { label: string; description: string; url: string };

export function normalizeENumber(code: string): string {
  let decoded = code;
  try {
    decoded = decodeURIComponent(code);
  } catch {
    // Malformed escape: keep the raw value.
  }
  return decoded.trim().toUpperCase().replace(/\s+/g, "");
}

export function additiveAlternativeSources(
  eNumber: string,
  internationalName: string,
  primaryLink?: string,
): AdditiveSource[] {
  const code = normalizeENumber(eNumber);
  const query = encodeURIComponent(internationalName ? `${code} ${internationalName}` : code);
  const sources: AdditiveSource[] = [
    {
      label: "EFSA",
      description: "Den Europæiske Fødevaresikkerhedsautoritets videnskabelige udtalelser",
      url: `https://www.efsa.europa.eu/en/search?s=${encodeURIComponent(code)}`,
    },
    {
      label: "EU's database over tilsætningsstoffer",
      description: "Godkendte anvendelser og grænseværdier (forordning 1333/2008)",
      url: "https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en",
    },
    {
      label: "Fødevarestyrelsen",
      description: "Dansk myndighedsinformation om tilsætningsstoffer",
      url: "https://foedevarestyrelsen.dk/kost-og-foedevarer/alt-om-mad/tilsaetningsstoffer",
    },
    {
      label: "Open Food Facts",
      description: "Hvilke produkter stoffet findes i",
      url: `https://world.openfoodfacts.org/additive/${code.toLowerCase()}`,
    },
    {
      label: "PubMed",
      description: "Fagfællebedømt forskning",
      url: `https://pubmed.ncbi.nlm.nih.gov/?term=${query}`,
    },
  ];
  return primaryLink ? sources.filter((source) => source.url !== primaryLink) : sources;
}
