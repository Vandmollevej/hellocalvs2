// Grupper af frie nøgleord fra produktarkene (docs/DECISIONS.md 2026-10-07).
// Admin vælger grupper (fx Farve, Smag, Emballage) — ikke enkelte nøgleord.
// Grupperne er fundet ved at gennemgå alle nøgleord i Bilka-, REMA- og
// SPAR-arkene; et nøgleord uden gruppe vises ikke. Rent modul (ingen DB).

export type ProductKeywordGroup =
  | "flavor"
  | "color"
  | "preparation"
  | "cut"
  | "storage"
  | "packaging"
  | "size"
  | "content"
  | "grape"
  | "meatFish"
  | "quality"
  | "label"
  | "origin"
  | "productType"
  | "notice";

// Rækkefølgen her er rækkefølgen på produktsiden og i admin.
export const PRODUCT_KEYWORD_GROUPS: { group: ProductKeywordGroup; label: string; example: string }[] = [
  { group: "flavor", label: "Smag", example: "Jordbær, Chili, Lakrids" },
  { group: "color", label: "Farve", example: "Rød, Grøn, Hvid" },
  { group: "preparation", label: "Tilberedning", example: "Kogt, Røget, Forstegt" },
  { group: "cut", label: "Udskæring og form", example: "i Skiver, Hakket, Revet" },
  { group: "storage", label: "Frost og opbevaring", example: "Frost, Fersk, Bør ikke genfryses" },
  { group: "packaging", label: "Emballage", example: "Glas, Dåse, Bag-in-box" },
  { group: "size", label: "Størrelse", example: "Mini, Jumbo, Stor" },
  { group: "content", label: "Indhold og tilsætning", example: "Tilsat kulsyre, Uden tilsat sukker, Light" },
  { group: "grape", label: "Druesort og vintype", example: "Chardonnay, Merlot, Brut" },
  { group: "meatFish", label: "Kød og fisk", example: "Kylling, Laks, Skinke" },
  { group: "quality", label: "Kvalitet", example: "Klasse 1, Premium, Reserva" },
  { group: "label", label: "Mærkning", example: "MSC, Glutenfri, Fuldkorn" },
  { group: "origin", label: "Oprindelse", example: "Græsk, Fra Elmhurst kilden" },
  { group: "productType", label: "Varetype", example: "Sauce, Pizza, Plantedrik" },
  { group: "notice", label: "Advarsler og oplysninger", example: "OBS 1 dags holdbarhed" },
];

const GROUP_SET = new Set<string>(PRODUCT_KEYWORD_GROUPS.map((entry) => entry.group));

export function isProductKeywordGroup(value: unknown): value is ProductKeywordGroup {
  return typeof value === "string" && GROUP_SET.has(value);
}

// Hele ord (små bogstaver). Første gruppe, der matcher, vinder — derfor står
// de mest entydige grupper først i GROUP_ORDER nedenfor.
const WORDS: Record<ProductKeywordGroup, string[]> = {
  notice: [],
  label: [
    "msc", "asc", "fairtrade", "glf", "glutenfri", "lkf", "laktosefri", "org", "øko", "økologisk", "organic", "bio",
    "fuldkorn", "fuldk", "plantebaseret", "vegansk", "vegan", "vegetar", "vegetarisk", "nøglehul", "vitamin", "vitaminer",
  ],
  origin: [
    "dansk", "danske", "græsk", "finsk", "svensk", "norsk", "tysk", "fransk", "italiensk", "spansk", "american",
    "nordic", "rhone", "toscana", "bordeaux", "rioja", "piemonte", "thai", "mexicansk", "indisk", "japansk",
  ],
  productType: [
    "sauce", "pizza", "nudler", "noodles", "oliven", "flødeis", "is", "ispinde", "kartofler", "pommes", "frites",
    "pilsner", "ale", "beer", "øl", "snack", "dip", "ketchup", "tomatketchup", "olie", "olivenolie", "rapsolie",
    "mozzarella", "gouda", "havarti", "emmentaler", "skiveost", "parmigiano", "spinat", "drik", "plantedrik",
    "havredrik", "mælk", "vand", "squash", "kammerjunkere", "spaghetti", "penne", "pasta", "havregryn", "mysli",
    "slikkepinde", "lolly", "vingummi", "bolcher", "gum", "candy", "burger", "sandwich", "boller", "buns", "bread",
    "baguettes", "chips", "popcorn", "vafler", "vaffel", "pandekager", "sorbet", "koldskål", "salat", "champignon",
    "svampe", "broccoli", "bønner", "beans", "kikærter", "ærter", "majs", "edamame", "rødbeder", "rødkål", "avocado",
    "salsa", "sushi", "taco", "tortilla", "bearnaise", "mayonnaise", "biscuits", "brownie", "nougat", "toffee",
    "rosiner", "akvavit", "rom", "spritz", "tonic", "brus", "lemonade", "nektar", "shot", "energy", "roulade",
    "nuggets", "forårsruller", "rolls", "bar", "bites", "hvedemel", "riskiks", "mix", "blandet", "dressing", "suppe",
    "juice", "saft", "te", "tea", "kaffe", "kiks", "kage", "kager", "brød", "rugbrød", "smør", "yoghurt", "skyr",
  ],
  content: [
    "kulsyre", "sukker", "koncentrat", "zero", "light", "sugar", "sukkerfri", "lage", "sødet", "usødet",
    "sødemiddel", "sødemidler", "protein", "koffein", "koffeinfri", "alkoholfri", "fedtfattig", "mager",
  ],
  storage: ["frost", "frossen", "frosne", "frosset", "fersk", "friske", "frisk", "optøet", "genfryses", "køl", "kølevare", "holdbar"],
  packaging: [
    "glas", "dåse", "dåser", "pet", "bib", "bag-in-box", "box", "boks", "flaske", "flasker", "spray", "tube", "pose",
    "poser", "bæger", "karton", "brik", "tetra", "spand", "net", "bakke", "multipack", "4pl", "6pl", "pl",
  ],
  grape: [
    "chardonnay", "chard", "pinot", "riesling", "shiraz", "syrah", "merlot", "zinfandel", "zin", "sauvignon", "sauv",
    "cabernet", "cab", "primitivo", "moscato", "malbec", "tempranillo", "grenache", "sangiovese", "nebbiolo",
    "gewürztraminer", "chenin", "viognier", "carmenere", "montepulciano", "garnacha", "noir", "grigio",
    "prosecco", "cava", "champagne", "amarone", "ripasso", "appassimento", "sancerre", "cuvee", "cuvée", "tawny",
    "port", "brut", "dry", "sec", "demi-sec", "spumante", "frizzante",
  ],
  color: [
    "rød", "røde", "red", "grøn", "grønne", "green", "hvid", "hvide", "white", "sort", "sorte", "black", "gul", "gule",
    "yellow", "blå", "blue", "pink", "rosa", "rose", "rosé", "rosä", "ros", "brun", "brune", "lys", "lyse", "mørk",
    "mørke", "dark", "guld", "gold", "golden", "orange", "lilla", "purple", "ruby", "blanc", "bianco", "rosso", "rouge",
  ],
  preparation: [
    "kogt", "kogte", "røget", "røgede", "stegt", "stegte", "forstegt", "forstegte", "tørret", "tørrede", "grillet",
    "grill", "bagt", "ovnbagt", "ovn", "pasteuriseret", "marineret", "gravad", "gravet", "saltet", "salted", "rå",
    "instant", "letsaltet", "sprødstegt", "friturestegt", "kogeps", "paneret", "crispy", "sprød",
  ],
  cut: [
    "skiver", "skive", "tern", "hakket", "hakkede", "revet", "revne", "hel", "hele", "bidder", "stykker", "stykke",
    "filet", "fileter", "stænger", "sticks", "strimler", "halve", "halvdele", "kvarte", "mos", "pulver", "flager",
    "skrællede", "udstenede", "stenfri", "kerner", "anbrud",
  ],
  size: ["mini", "minis", "jumbo", "stor", "store", "små", "lille", "maxi", "mega", "xl", "xxl", "double", "triple", "familiepakke", "big", "king"],
  meatFish: [
    "kylling", "kyll", "chicken", "gris", "svin", "pork", "okse", "kalv", "beef", "lam", "and", "kalkun", "laks",
    "tun", "sild", "makrel", "rejer", "torsk", "skinke", "bacon", "salami", "chorizo", "spegepølse", "rullepølse",
    "hamburgerryg", "leverpostej", "frikadeller", "kyllingebryst", "overlår", "oksekød", "svinekød", "hakkekød", "pølser", "pølse", "fisk", "krabbe", "hummer", "musling", "muslinger",
  ],
  quality: [
    "klasse", "premium", "reserve", "reserva", "riserva", "igp", "dop", "aoc", "doc", "docg", "original", "classic",
    "klassisk", "extra", "ekstra", "super", "fine", "deluxe", "luksus", "gourmet", "edition", "selection", "grand",
  ],
  flavor: [
    "jordbær", "strawberry", "hindbær", "raspberry", "blåbær", "blueberry", "solbær", "kirsebær", "cherry", "mango",
    "appelsin", "appelsiner", "citron", "lemon", "lime", "citrus", "æble", "apple", "pære", "banan", "ananas",
    "pineapple", "fersken", "peach", "abrikos", "blomme", "kiwi", "druer", "grape", "passion", "hyldeblomst",
    "rabarber", "tranebær", "granatæble", "kokos", "vanilje", "vanilla", "karamel", "caramel", "chokolade",
    "chocolate", "choko", "choco", "choc", "kakao", "lakrids", "salt", "havsalt", "peber", "chili", "hot", "stærk",
    "spicy", "mild", "sød", "sweet", "sur", "sour", "bbq", "hvidløg", "garlic", "løg", "karry", "curry", "paprika",
    "ingefær", "mint", "spearmint", "menthol", "honning", "kanel", "nød", "nødder", "hasselnød", "hazelnut", "mandel",
    "mandler", "almond", "peanut", "peanuts", "pistacie", "marcipan", "kaffe", "espresso", "latte", "cola", "tomat",
    "tomater", "pesto", "dild", "persille", "basilikum", "urter", "trøffel", "teriyaki", "ost", "cheese", "cheddar",
    "naturel", "cream", "creamy", "fløde", "yoghurt", "tropical", "exotic", "fruit", "frugt", "bær", "multifrugt",
    "rosmarin", "timian", "oregano", "sennep", "balsamico", "røgsmag", "kanelsnegl", "cookie", "kokosmælk",
  ],
};

const GROUP_ORDER: ProductKeywordGroup[] = [
  "content", "label", "storage", "packaging", "grape", "color", "preparation", "cut", "size", "meatFish", "quality",
  "origin", "flavor", "productType",
];

const LOOKUP = new Map<string, ProductKeywordGroup>();
for (const group of GROUP_ORDER) {
  for (const word of WORDS[group]) if (!LOOKUP.has(word)) LOOKUP.set(word, group);
}

// Faste vendinger, der afgør gruppen før ordopslag.
const PHRASES: [RegExp, ProductKeywordGroup][] = [
  [/\b(genfryses|genindfryses|opbevares)\b/, "storage"],
  [/^(tilsat|indeholder|uden|fra koncentrat|delvis fra koncentrat|ikke tilsat)\b/, "content"],
  [/\b(holdbarhed|anbefales|bør ikke|overdreven|phenylalanin|afførende|advarsel|obs\b|må ikke|opbevares)/, "notice"],
  [/\b(på glas|i glas|på dåse|i dåse|på flaske|i pose)\b/, "packaging"],
  [/^i (skiver|tern|stykker|strimler|bidder)\b/, "cut"],
  [/\bsammensat af stykker\b/, "notice"],
  [/^fra .+ kilden$/, "origin"],
];

// Gruppen for ét nøgleord, eller null når det ikke passer i en gruppe.
export function productKeywordGroup(keyword: string): ProductKeywordGroup | null {
  const text = keyword.trim().toLowerCase();
  if (!text) return null;
  for (const [pattern, group] of PHRASES) if (pattern.test(text)) return group;
  const words = text.split(/[\s,/&+]+/).filter(Boolean);
  // Lange sætninger er oplysninger, ikke nøgleord.
  if (words.length >= 5) return "notice";
  for (const group of GROUP_ORDER) {
    if (words.some((word) => LOOKUP.get(word) === group)) return group;
  }
  return null;
}

// Forkortelser i produktarkene vises som hele ord.
const DISPLAY: Record<string, string> = {
  glf: "Glutenfri",
  lkf: "Laktosefri",
  org: "Økologisk",
  øko: "Økologisk",
  fuldk: "Fuldkorn",
  msc: "MSC",
  asc: "ASC",
  kyll: "Kylling",
  chard: "Chardonnay",
  cab: "Cabernet",
  sauv: "Sauvignon",
  zin: "Zinfandel",
  bib: "Bag-in-box",
  pet: "PET-flaske",
  igp: "IGP",
  aoc: "AOC",
  doc: "DOC",
  dop: "DOP",
};

export function displayProductKeyword(keyword: string): string {
  const text = keyword.trim();
  return DISPLAY[text.toLowerCase()] ?? text;
}