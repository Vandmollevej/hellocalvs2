// Tolerant produktsøgning (docs/DECISIONS.md): søgeteksten deles i ord, hvert
// ord skal findes i navn ELLER mærke (så "Nescafe instant" rammer mærket
// Nescafé + navnet "Crema instant kaffe"), og accenter ignoreres (e = é = è).
// æ/ø/å er egne bogstaver og bevares. Samme foldning bruges i SQL
// (SEARCH_FOLD_FROM/TO) og her, så begge sider altid ser ens ud.

export const SEARCH_FOLD_FROM = "éèêëáàâäóòôöúùûüíìîïñçÿ";
export const SEARCH_FOLD_TO = "eeeeaaaaooooouuuuiiiincy";

const FOLD_MAP = new Map([...SEARCH_FOLD_FROM].map((char, index) => [char, SEARCH_FOLD_TO[index]]));

export function foldSearchText(value: string): string {
  let result = "";
  for (const char of value.toLowerCase()) result += FOLD_MAP.get(char) ?? char;
  return result;
}

// Ord på 5+ tegn søges uden sidste bogstav, så endelser ikke afgør det
// ("creme" finder "crema", "kartofler" finder "kartoffel" ikke, men "tomater"
// finder "tomat").
export function searchTokens(query: string): string[] {
  const words = foldSearchText(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 6);
  return words.map((word) => (word.length >= 5 ? word.slice(0, -1) : word));
}
