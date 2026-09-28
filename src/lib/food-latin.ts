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
  { term: "Agavesirup", danish: "Agavesirup", explanation: "Sødemiddel fra agaveplanten med højt indhold af fruktose." },
  { term: "Amaranth", danish: "Amarant", explanation: "Glutenfrit frø fra amarantplanten, der bruges som kornlignende råvare." },
  { term: "Arrowroot", danish: "Pilerod-stivelse", explanation: "Stivelse fra pilerod, bruges til jævning." },
  { term: "Bulgur", danish: "Knust hvede", explanation: "Forkogt og knust hvede." },
  { term: "Caseinat", aliases: ["kaseinat", "natriumcaseinat", "calciumcaseinat"], danish: "Mælkeprotein", explanation: "Mælkeprotein (kasein) bundet til natrium eller calcium. Bruges som emulgator og proteinkilde. Indeholder mælk." },
  { term: "Chia", aliases: ["chiafrø"], danish: "Chiafrø", explanation: "Små frø fra en mynteplante, rige på fibre og omega-3." },
  { term: "Chicorierod", aliases: ["cikorierod"], danish: "Cikorierod", explanation: "Rod der er kilde til inulin (kostfiber) og bruges som kaffeerstatning." },
  { term: "Couscous", danish: "Couscous", explanation: "Små kugler af durumhvede-gryn." },
  { term: "Dextrose", aliases: ["dekstrose"], danish: "Druesukker (glukose)", explanation: "Ren glukose, typisk fremstillet af majs- eller hvedestivelse. I pølser og pålæg bruges det til smag, farve og som næring for modningskulturer." },
  { term: "Durum", aliases: ["durumhvede"], danish: "Hård hvede", explanation: "Hvedesort med højt proteinindhold, bruges især til pasta." },
  { term: "Emmer", danish: "Tokornshvede", explanation: "Gammel hvedesort. Indeholder gluten." },
  { term: "Fruktose", aliases: ["fructose"], danish: "Frugtsukker", explanation: "Sukkerart fra frugt og honning." },
  { term: "Glukose", aliases: ["glucose"], danish: "Druesukker", explanation: "Enkelt sukkerart; kroppens primære brændstof." },
  { term: "Glukosesirup", aliases: ["glucosesirup", "glukose-fruktosesirup", "glucose-fructose sirup"], danish: "Stivelsessirup", explanation: "Sirup fremstillet ved at nedbryde stivelse (majs, hvede, kartoffel) til sukkerarter." },
  { term: "Inulin", danish: "Kostfiber", explanation: "Opløselig kostfiber, oftest fra cikorierod. Kan give luft i maven i store mængder." },
  { term: "Kakaosmør", danish: "Kakaofedt", explanation: "Fedtet fra kakaobønnen." },
  { term: "Kamut", danish: "Khorasan-hvede", explanation: "Gammel hvedesort. Indeholder gluten." },
  { term: "Laktose", aliases: ["lactose"], danish: "Mælkesukker", explanation: "Sukkerarten i mælk." },
  { term: "Maltodextrin", aliases: ["maltodekstrin"], danish: "Nedbrudt stivelse", explanation: "Kulhydrat fremstillet ved delvis nedbrydning af stivelse (majs, kartoffel, hvede). Bruges som fyld, bærestof og til konsistens." },
  { term: "Maltose", danish: "Maltsukker", explanation: "Sukkerart dannet når stivelse nedbrydes, fx ved maltning af korn." },
  { term: "Mascarpone", danish: "Italiensk flødeost", explanation: "Fed, blød italiensk flødeost." },
  { term: "Matcha", danish: "Grøn te-pulver", explanation: "Finmalet grøn te." },
  { term: "Miso", danish: "Fermenteret sojapasta", explanation: "Japansk pasta af fermenterede sojabønner, ofte med ris eller byg." },
  { term: "Psyllium", aliases: ["psylliumskaller", "loppefrøskaller"], danish: "Loppefrøskaller", explanation: "Kostfiber, der binder vand. Bruges i glutenfrit brød." },
  { term: "Quinoa", danish: "Inkaris", explanation: "Glutenfrit frø fra en gåsefodsplante, rig på protein." },
  { term: "Seitan", danish: "Hvedegluten", explanation: "Kødlignende produkt af ren hvedegluten." },
  { term: "Spelt", danish: "Spelt", explanation: "Gammel hvedesort. Indeholder gluten." },
  { term: "Tahin", aliases: ["tahini"], danish: "Sesampasta", explanation: "Pasta af malede sesamfrø. Indeholder sesam." },
  { term: "Tapioka", aliases: ["tapiokastivelse"], danish: "Maniokstivelse", explanation: "Stivelse fra maniokrod, bruges til jævning og konsistens." },
  { term: "Tempeh", danish: "Fermenterede sojabønner", explanation: "Indonesisk produkt af hele, fermenterede sojabønner." },
  { term: "Tofu", danish: "Sojaost", explanation: "Presset ostemasse af sojamælk." },
  { term: "Valle", aliases: ["valleprotein", "vallepulver", "whey"], danish: "Mælkeserum", explanation: "Væsken der bliver tilbage ved osteproduktion. Kilde til protein. Indeholder mælk." },
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
