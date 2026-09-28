// "Mad på latin": ordbog over ikke-danske ingrediensnavne (fx dextrose,
// maltodextrin, acerola). Ordene linkes stille i ingredienslister til
// /mad-paa-latin#<anker>. E-numre håndteres separat (src/lib/additives.ts).

export type FoodTerm = {
  term: string;
  /** Andre stavemåder, der også skal linkes. */
  aliases?: string[];
  danish: string;
  explanation: string;
};

export const FOOD_TERMS: FoodTerm[] = [
  { term: "Acerola", danish: "Acerolakirsebær", explanation: "Tropisk bær med meget højt indhold af C-vitamin. Bruges som pulver, ofte i økologiske varer, som naturlig kilde til C-vitamin og antioxidant." },
  { term: "Agar", aliases: ["agar-agar"], danish: "Tanggelé", explanation: "Geleringsmiddel udvundet af rødalger. Vegetabilsk alternativ til gelatine." },
  { term: "Ascorbinsyre", aliases: ["ascorbic acid"], danish: "C-vitamin", explanation: "C-vitamin. Tilsættes som vitamin eller som antioxidant, der holder farve og smag friske (E300)." },
  { term: "Caseinat", aliases: ["kaseinat", "natriumcaseinat", "calciumcaseinat"], danish: "Mælkeprotein", explanation: "Mælkeprotein (kasein) bundet til natrium eller calcium. Bruges som emulgator og proteinkilde. Indeholder mælk." },
  { term: "Dextrose", aliases: ["dekstrose"], danish: "Druesukker (glukose)", explanation: "Ren glukose, typisk fremstillet af majs- eller hvedestivelse. I pølser og pålæg bruges det til smag, farve og som næring for modningskulturer." },
  { term: "Erythritol", danish: "Sukkeralkohol", explanation: "Sødemiddel (E968) med næsten ingen kalorier." },
  { term: "Fruktose", aliases: ["fructose"], danish: "Frugtsukker", explanation: "Sukkerart fra frugt og honning." },
  { term: "Glukose", aliases: ["glucose"], danish: "Druesukker", explanation: "Enkelt sukkerart; kroppens primære brændstof." },
  { term: "Glukosesirup", aliases: ["glucosesirup", "glukose-fruktosesirup", "glucose-fructose sirup"], danish: "Stivelsessirup", explanation: "Sirup fremstillet ved at nedbryde stivelse (majs, hvede, kartoffel) til sukkerarter." },
  { term: "Guarkernemel", aliases: ["guar"], danish: "Guarkernemel", explanation: "Fortykningsmiddel fra guarbønnen (E412)." },
  { term: "Inulin", danish: "Kostfiber", explanation: "Opløselig kostfiber, oftest fra cikorierod. Kan give luft i maven i store mængder." },
  { term: "Isomalt", danish: "Sukkeralkohol", explanation: "Sødemiddel (E953) fremstillet af sukker, bruges i sukkerfrie slik." },
  { term: "Laktose", aliases: ["lactose"], danish: "Mælkesukker", explanation: "Sukkerarten i mælk." },
  { term: "Lecithin", aliases: ["lecitin", "sojalecithin", "solsikkelecithin"], danish: "Emulgator", explanation: "Emulgator (E322) fra soja, solsikke eller æg, der får fedt og vand til at blande sig." },
  { term: "Maltodextrin", aliases: ["maltodekstrin"], danish: "Nedbrudt stivelse", explanation: "Kulhydrat fremstillet ved delvis nedbrydning af stivelse (majs, kartoffel, hvede). Bruges som fyld, bærestof og til konsistens." },
  { term: "Maltose", danish: "Maltsukker", explanation: "Sukkerart dannet når stivelse nedbrydes, fx ved maltning af korn." },
  { term: "Maltitol", danish: "Sukkeralkohol", explanation: "Sødemiddel (E965). Kan virke afførende i store mængder." },
  { term: "Pektin", aliases: ["pectin"], danish: "Frugtgelé", explanation: "Geleringsmiddel (E440) fra æbler eller citrusskaller." },
  { term: "Polydextrose", danish: "Syntetisk kostfiber", explanation: "Fyldstof og kostfiber (E1200) med få kalorier." },
  { term: "Sorbitol", danish: "Sukkeralkohol", explanation: "Sødemiddel og fugtbevarende middel (E420). Kan virke afførende." },
  { term: "Stevia", aliases: ["steviolglykosider"], danish: "Sødeblad", explanation: "Kaloriefrit sødemiddel (E960) fra steviaplanten." },
  { term: "Sucralose", aliases: ["sukralose"], danish: "Kunstigt sødemiddel", explanation: "Kaloriefrit sødemiddel (E955), ca. 600 gange sødere end sukker." },
  { term: "Xanthan", aliases: ["xanthangummi", "xanthan gum"], danish: "Fortykningsmiddel", explanation: "Fortykningsmiddel (E415) fremstillet ved fermentering af sukker." },
  { term: "Xylitol", danish: "Birkesukker", explanation: "Sødemiddel (E967), bruges i tyggegummi. Giftigt for hunde." },
];

export function foodTermAnchor(term: string): string {
  return term
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function foodTermHref(term: string): string {
  return `/mad-paa-latin#${foodTermAnchor(term)}`;
}

export function matchesFoodTerm(item: FoodTerm, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.term, item.danish, item.explanation, ...(item.aliases ?? [])].some((text) =>
    text.toLowerCase().includes(q),
  );
}

export type FoodTermPart = { text: string; term?: string };

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Længste navn først, så "glukosesirup" vinder over "glukose".
const LOOKUP = new Map<string, string>();
for (const item of FOOD_TERMS) {
  for (const name of [item.term, ...(item.aliases ?? [])]) LOOKUP.set(name.toLowerCase(), item.term);
}
const PATTERN = new RegExp(
  `(?<![\\p{L}\\d])(${[...LOOKUP.keys()].sort((a, b) => b.length - a.length).map(escape).join("|")})(?![\\p{L}\\d])`,
  "giu",
);

// Deler en ingredienstekst op i almindelig tekst og ordbogsord.
export function splitFoodTerms(text: string): FoodTermPart[] {
  const parts: FoodTermPart[] = [];
  let last = 0;
  for (const match of text.matchAll(PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: match[0], term: LOOKUP.get(match[0].toLowerCase()) });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
