// Anchors and outside links for the shared E-number page (/e-numre).
// "E101(i)" → "e101i", so /e-numre#e101i lands on exactly that section.

export function eNumberAnchor(code: string): string {
  return code.toLowerCase().replace(/^en:/, "").replace(/[^a-z0-9]/g, "");
}

export function eNumberHref(code: string): string {
  return `/e-numre#${eNumberAnchor(code)}`;
}

// Matches E-numbers in free text such as an ingredient list: "E330", "E 471",
// "E160a", "E101(i)".
export const E_NUMBER_PATTERN = /\bE ?\d{3,4}[a-z]?(?:\([ivx]+\))?/gi;

export type ExternalLink = { label: string; href: string };

// Research search links (PubMed / EFSA) built from the number and name.
export function researchLinks(code: string, name: string): ExternalLink[] {
  const base = code.replace(/\(.*\)/, "");
  const term = name ? `"${name}" food additive` : `${base} food additive`;
  return [
    { label: "PubMed", href: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(term)}` },
    {
      label: "EFSA Journal",
      href: `https://efsa.onlinelibrary.wiley.com/action/doSearch?AllField=${encodeURIComponent(name || base)}`,
    },
  ];
}

// Other trustworthy reference sources for the same additive.
export function alternativeSources(code: string, name: string): ExternalLink[] {
  const base = code.replace(/\(.*\)/, "").toLowerCase();
  return [
    {
      label: "EU's database over tilsætningsstoffer",
      href: "https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en",
    },
    { label: "Fødevarestyrelsen", href: "https://foedevarestyrelsen.dk/kost-og-foedevarer/alt-om-mad/tilsaetningsstoffer" },
    { label: "Open Food Facts", href: `https://world.openfoodfacts.org/facets/additives/${base}` },
    ...(name
      ? [{ label: "Wikipedia", href: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(name)}` }]
      : []),
  ];
}
