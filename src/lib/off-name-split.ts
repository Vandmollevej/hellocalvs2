// Open Food Facts → vores felter (docs/DECISIONS.md 2026-10-11 "Open Food Facts i egen tabel").
//
// Deler en OFF-vare op efter de samme navneregler som butiksarkene (docs/REGLER.md,
// Excelark/NAVNEREGLER.md): mærke, sub brand, produkttype, variation, nøgleord,
// pakning, mængde og filtre (økologisk, glutenfri, fedt-% …). Ren funktion uden
// database — ordforrådet (mærker, produkttyper, nøgleord) sendes ind og bygges af
// arkene med scripts/off-import/build_vocab.py (src/data/off-vocab.json).
//
// Resultatet har en sikkerhed 0–100 % for, at opdelingen er korrekt. Den er et
// estimat: delscorer (mærke, type, variation, sprog) vægtes og kalibreres mod
// brugerens egne rettede ark (scripts/off-import/evaluate-split.mjs).
//
// Kun sletbar TypeScript-syntaks (ingen enum/namespace), så `node --test`
// kan køre filen direkte.

export const OFF_SPLIT_VERSION = 1;

// ---------------------------------------------------------------- ordforråd

export type RawVocab = {
  /** [navn, antal, kæde?, hyppigste produkttype, dens andel i %] */
  brands: [name: string, count: number, isChain: number, topType?: string, topShare?: number][];
  /** [navn, antal, mærker, hyppigste produkttype, dens andel i %] */
  subbrands: [name: string, count: number, brands: string[], topType?: string, topShare?: number][];
  types: [name: string, plural: string, category: string, count: number][];
  keywords: [name: string, count: number][];
  words: [word: string, count: number][];
};

export type VocabBrand = { name: string; n: number; chain: boolean; topType: string; topShare: number };
export type VocabSubbrand = { name: string; n: number; brandKeys: string[]; topType: string; topShare: number };
export type VocabType = { name: string; plural: string; category: string; n: number };
export type VocabIndex = {
  brandByCk: Map<string, VocabBrand>;
  subbrandByCk: Map<string, VocabSubbrand>;
  /** nøgle = sammenskrevet nøgle af ental eller flertal */
  typeByCk: Map<string, { entry: VocabType; plural: boolean }>;
  keywordByCk: Map<string, { name: string; n: number }>;
  words: Map<string, number>;
  maxTypeCount: number;
};

export function buildVocabIndex(raw: RawVocab): VocabIndex {
  const brandByCk = new Map<string, VocabBrand>();
  for (const [name, n, chain, topType, topShare] of raw.brands) {
    const ck = compactKey(name);
    if (ck.length >= 2 && !brandByCk.has(ck)) {
      brandByCk.set(ck, { name, n, chain: chain === 1, topType: topType ?? "", topShare: topShare ?? 0 });
    }
  }
  const subbrandByCk = new Map<string, VocabSubbrand>();
  for (const [name, n, brands, topType, topShare] of raw.subbrands) {
    const ck = compactKey(name);
    if (ck.length >= 2 && !subbrandByCk.has(ck)) {
      subbrandByCk.set(ck, { name, n, brandKeys: brands.map(compactKey), topType: topType ?? "", topShare: topShare ?? 0 });
    }
  }
  const typeByCk = new Map<string, { entry: VocabType; plural: boolean }>();
  let maxTypeCount = 1;
  for (const [name, plural, category, n] of raw.types) {
    const ck = compactKey(name);
    if (ck.length < 2) continue;
    const entry: VocabType = { name, plural, category, n };
    maxTypeCount = Math.max(maxTypeCount, n);
    const existing = typeByCk.get(ck);
    if (!existing || existing.entry.n < n) typeByCk.set(ck, { entry, plural: false });
    if (plural) {
      const pk = compactKey(plural);
      if (pk && pk !== ck && !typeByCk.has(pk)) typeByCk.set(pk, { entry, plural: true });
    }
  }
  const keywordByCk = new Map<string, { name: string; n: number }>();
  for (const [name, n] of raw.keywords) {
    const ck = compactKey(name);
    if (ck.length >= 2 && !keywordByCk.has(ck)) keywordByCk.set(ck, { name, n });
  }
  const words = new Map<string, number>();
  for (const [w, n] of raw.words) words.set(w, n);
  return { brandByCk, subbrandByCk, typeByCk, keywordByCk, words, maxTypeCount };
}

// ---------------------------------------------------------------- små værktøjer

const FOLD: [string, string][] = [
  ["ä", "æ"], ["ö", "ø"], ["é", "e"], ["è", "e"], ["ê", "e"], ["ü", "u"], ["ß", "ss"], ["ô", "o"],
  ["á", "a"], ["à", "a"], ["í", "i"], ["ó", "o"], ["ú", "u"], ["ñ", "n"], ["ç", "c"], ["’", "'"],
];

/** Små bogstaver, æ/ø/å bevaret, accenter fjernet, kun a-z0-9æøå — uden mellemrum. */
export function compactKey(value: string): string {
  let s = String(value ?? "").toLowerCase();
  for (const [a, b] of FOLD) s = s.split(a).join(b);
  return s.replace(/[^0-9a-zæøå]+/g, "").replace(/fillet/g, "filet");
}

function clean(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[ \s]+/g, " ").trim();
}

function ucFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function isAllCaps(s: string): boolean {
  const letters = s.replace(/[^A-Za-zÆØÅæøåÄÖÜäöü]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

function sentenceCase(s: string): string {
  const t = isAllCaps(s) ? s.toLowerCase() : s;
  return ucFirst(t);
}

// ---------------------------------------------------------------- input og resultat

export type OffSplitInput = {
  name: string | null;
  genericName?: string | null;
  brands?: string | null;
  quantity?: string | null;
  productQuantity?: number | string | null;
  productQuantityUnit?: string | null;
  categoriesText?: string | null;
  categoriesTags?: string[] | null;
  labelsTags?: string[] | null;
  ingredientsAnalysisTags?: string[] | null;
  allergensTags?: string[] | null;
  ingredientsText?: string | null;
  packagingTags?: string[] | null;
  originsTags?: string[] | null;
  nutriments?: Record<string, unknown> | null;
  lang?: string | null;
  /** OFF har selv en dansk titel (product_name_da). */
  hasDanishName?: boolean;
  /** Navnet er allerede oversat til dansk (translate-da). */
  translated?: boolean;
};

export type OffSplitFilters = {
  organic: string | null;
  glutenFree: string | null;
  lactoseFree: string | null;
  sugarFree: string | null;
  noAddedSugar: string | null;
  sweeteners: string | null;
  vegan: string | null;
  vegetarian: string | null;
  meatType: string | null;
  alcohol: string | null;
  alcoholPercent: number | null;
  fatPercent: number | null;
  countryOfOrigin: string | null;
  wholeGrain: string | null;
  animalWelfare: string[];
  /** MSC, ASC, Fairtrade … (brugerens regel 2026-10-11 punkt 16) */
  certifications: string[];
  storage: string | null;
  decaf: string | null;
  cooked: string | null;
  raw: string | null;
};

export type OffSplitFieldScores = {
  brand: number;
  type: number;
  variation: number;
  language: number;
};

export type OffSplitResult = {
  version: number;
  /** Titlen uden brand og mængde, efter titelreglen (til Product.name). */
  title: string;
  brand: string | null;
  brandKnown: boolean;
  /** Øvrige mærker fra OFF (butikskæder, producenter) — bruges ikke som brand. */
  extraBrands: string[];
  subbrand: string | null;
  productType: string | null;
  productTypePlural: string | null;
  variant: string | null;
  keywords: string[];
  packaging: string | null;
  category: string | null;
  quantityText: string | null;
  packCount: number | null;
  filters: OffSplitFilters;
  /** 0–100: sandsynlighed for at opdelingen er korrekt (kalibreret mod arkene). */
  confidence: number;
  /** Ukalibreret 0–100, til fejlfinding. */
  rawScore: number;
  fieldScores: OffSplitFieldScores;
  /** "da" | "foreign" | "unknown" */
  language: string;
  /** Korte koder for det der trækker sikkerheden ned. */
  issues: string[];
};

// ---------------------------------------------------------------- mængde

const UNIT_ALIASES: Record<string, string> = {
  kg: "kg", kilo: "kg", g: "g", gr: "g", gram: "g", mg: "mg", l: "l", ltr: "l", liter: "l", litre: "l", dl: "dl",
  cl: "cl", ml: "ml", stk: "stk", pcs: "stk", pc: "stk", piece: "stk", pieces: "stk", stück: "stk", stuck: "stk",
  styk: "stk", portion: "stk", portioner: "stk", pk: "stk", pak: "stk",
};

function normalizeNumber(n: string): number {
  return parseFloat(n.replace(",", "."));
}

function formatNumber(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

export type QuantityParse = { text: string; packCount: number | null; issue: string | null } | null;

/** "500g", "1 L", "6 x 11 g", "2pcs", "pr bøtte … 500g Nettovægt" → "500 g", "1 l", "6 x 11 g", "2 stk". */
export function parseQuantity(
  quantity: string | null | undefined,
  productQuantity?: number | string | null,
  productQuantityUnit?: string | null,
): QuantityParse {
  const q = clean(quantity).toLowerCase();
  if (q) {
    const multi = q.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gram|mg|ml|cl|dl|l|ltr|liter|stk|pcs)\b/);
    if (multi) {
      const unit = UNIT_ALIASES[multi[3]] ?? multi[3];
      return { text: `${multi[1]} x ${formatNumber(normalizeNumber(multi[2]))} ${unit}`, packCount: parseInt(multi[1], 10), issue: null };
    }
    const circa = /\bca\.?\b|\bcirka\b/.test(q);
    const single = q.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo|g|gr|gram|mg|ml|cl|dl|l|ltr|liter|litre|stk|pcs|pc|pieces?|stück|styk)\b/);
    if (single) {
      const unit = UNIT_ALIASES[single[2]] ?? single[2];
      const num = normalizeNumber(single[1]);
      return {
        text: `${circa ? "ca. " : ""}${formatNumber(num)} ${unit}`,
        packCount: unit === "stk" && Number.isInteger(num) ? num : null,
        issue: null,
      };
    }
  }
  const pq = typeof productQuantity === "string" ? parseFloat(productQuantity) : productQuantity;
  if (typeof pq === "number" && Number.isFinite(pq) && pq > 0) {
    const unit = UNIT_ALIASES[clean(productQuantityUnit).toLowerCase()] ?? (clean(productQuantityUnit).toLowerCase() || "g");
    return { text: `${formatNumber(pq)} ${unit}`, packCount: null, issue: "maengde-fra-product_quantity" };
  }
  return q ? { text: "", packCount: null, issue: "maengde-ikke-aflaest" } : null;
}

// ---------------------------------------------------------------- ord-lister

const FUNCTION_WORDS = new Set([
  "med", "uden", "og", "i", "af", "på", "fra", "til", "mod", "eller", "en", "et", "den", "det", "de", "for", "à",
  "a", "tilsat", "ikke", "samt", "m", "u", "per", "pr",
]);

// ord der tyder på, at navnet ikke er dansk (tysk/engelsk/fransk/italiensk/svensk/norsk)
const FOREIGN_WORDS = new Set([
  "with", "and", "the", "of", "for", "from", "without", "style", "flavour", "flavor", "chicken", "beef", "pork", "cheese",
  "milk", "chocolate", "strawberry", "vanilla", "organic", "natural", "fresh", "frozen", "mit", "und", "ohne", "für",
  "vom", "der", "die", "das", "aus", "nach", "art", "käse", "kase", "fleisch", "milch", "brot", "soße", "sosse", "schoko",
  "hähnchen", "hahnchen", "schwein", "rind", "wurst", "pute", "kartoffel", "apfel", "saft", "avec", "sans", "pour",
  "aux", "au", "du", "des", "les", "le", "la", "et", "con", "senza", "di", "alla", "al", "del", "della", "och", "utan",
  "med", "fläsk", "flask", "kyckling", "ost", "mjölk", "mjolk", "bröd", "brod", "sylt", "kött", "kott", "snack", "mix",
  "tomaten", "gemüse", "gemuse", "salat", "nüsse", "nusse", "reis", "nudeln", "kaffee", "tee", "zucker", "eier",
]);
// "med"/"ost"/"salat"/"mix" er også danske — de tæller ikke som fremmede
for (const w of ["med", "ost", "salat", "mix", "snack", "tee"]) FOREIGN_WORDS.delete(w);

const MEAT_KINDS: [string, RegExp][] = [
  ["Kylling", /kylling|chicken|hähnchen|hahnchen|høns/],
  ["Kalkun", /kalkun|turkey|pute/],
  ["Okse", /okse|rind|beef|oksekød/],
  ["Gris", /\bgris|svin|flæsk|medister|bacon|skinke|schwein|pork/],
  ["Kalv", /\bkalv/],
  ["Lam", /\blam\b|lamm|lammekød/],
  ["And", /\band\b|ente\b|andebryst/],
  ["Laks", /laks|salmon|lachs/],
  ["Tun", /\btun\b|tunfisk|tuna/],
  ["Rejer", /rejer|reje\b|shrimp|garnele/],
  ["Sild", /\bsild\b/],
  ["Fisk", /fisk|torsk|makrel|sej\b|rødspætte|fish/],
];

const COOKED_WORDS = [
  "røget", "røgede", "kogt", "kogte", "stegt", "stegte", "tørret", "tørrede", "syltet", "syltede", "ristet", "ristede",
  "bagt", "bagte", "grillet", "grillede", "dampet", "dampede", "friturestegt", "friturestegte", "gravad", "gravede",
];

const CHAIN_WORDS = new Set([
  "lidl", "aldi", "netto", "føtex", "foetex", "bilka", "rema", "rema1000", "salling", "coop", "kvickly", "superbrugsen",
  "brugsen", "meny", "spar", "irma", "penny", "edeka", "rewe", "nemlig", "365discount", "365", "wolt",
]);

const OFF_PACKAGING: Record<string, string> = {
  "en:can": "Dåse", "en:tin": "Dåse", "en:bottle": "Flaske", "en:plastic-bottle": "Flaske", "en:glass-bottle": "Flaske",
  "en:jar": "Glas", "en:glass-jar": "Glas", "en:tray": "Bakke", "en:tube": "Tube", "en:bag": "Pose", "en:pouch": "Pose",
  "en:carton": "Karton", "en:brick": "Karton", "en:tub": "Bæger", "en:net": "Net",
};

const COUNTRY: Record<string, string> = {
  denmark: "Danmark", germany: "Tyskland", sweden: "Sverige", norway: "Norge", netherlands: "Holland", italy: "Italien",
  spain: "Spanien", france: "Frankrig", poland: "Polen", ireland: "Irland", "united-kingdom": "England", belgium: "Belgien",
  portugal: "Portugal", greece: "Grækenland", austria: "Østrig", switzerland: "Schweiz", finland: "Finland", turkey: "Tyrkiet",
  thailand: "Thailand", morocco: "Marokko", china: "Kina", india: "Indien", brazil: "Brasilien", chile: "Chile",
  argentina: "Argentina", "new-zealand": "New Zealand", "south-africa": "Sydafrika", "united-states": "USA", usa: "USA",
  peru: "Peru", ecuador: "Ecuador", israel: "Israel", egypt: "Egypten", lithuania: "Litauen", latvia: "Letland",
  estonia: "Estland", "czech-republic": "Tjekkiet", hungary: "Ungarn", romania: "Rumænien", bulgaria: "Bulgarien",
  croatia: "Kroatien", "dominican-republic": "Dominikanske Republik", colombia: "Colombia", "costa-rica": "Costa Rica",
};

// Oprindelses-adjektiver i navnet → land i _is_country_of_origen (brugerens regel 2026-10-11 punkt 14)
const ORIGIN_ADJECTIVES: Record<string, string> = {
  fransk: "Frankrig", franske: "Frankrig", italiensk: "Italien", italienske: "Italien", spansk: "Spanien",
  spanske: "Spanien", tysk: "Tyskland", tyske: "Tyskland", svensk: "Sverige", svenske: "Sverige", norsk: "Norge",
  norske: "Norge", græsk: "Grækenland", græske: "Grækenland", tyrkisk: "Tyrkiet", tyrkiske: "Tyrkiet",
  hollandsk: "Holland", hollandske: "Holland", belgisk: "Belgien", belgiske: "Belgien", polsk: "Polen",
  polske: "Polen", portugisisk: "Portugal", portugisiske: "Portugal", engelsk: "England", engelske: "England",
  irsk: "Irland", irske: "Irland", østrigsk: "Østrig", østrigske: "Østrig", schweizisk: "Schweiz",
  schweiziske: "Schweiz", amerikansk: "USA", amerikanske: "USA", kinesisk: "Kina", kinesiske: "Kina",
  indisk: "Indien", indiske: "Indien", thailandsk: "Thailand", thailandske: "Thailand", japansk: "Japan",
  japanske: "Japan", mexicansk: "Mexico", mexicanske: "Mexico", brasiliansk: "Brasilien", chilensk: "Chile",
  argentinsk: "Argentina", marokkansk: "Marokko", sydafrikansk: "Sydafrika", peruviansk: "Peru",
};
// "Græsk yoghurt", "fransk dressing" … er en stil, ikke en oprindelse
const ORIGIN_STYLE_NOUNS = new Set(["yoghurt", "yogurt", "salat", "dressing", "hotdog", "remoulade", "løgsuppe"]);

// OFF-kategori → produkttype, når navnet ikke selv har en kendt type (kun de mest almindelige)
const CATEGORY_TYPES: [RegExp, string][] = [
  [/sodas|soft-drinks|carbonated-drinks/, "Sodavand"], [/waters|mineral-waters/, "Vand"], [/juices|fruit-juices/, "Juice"],
  [/yogurts|yoghurts/, "Yoghurt"], [/skyrs/, "Skyr"], [/milks|dairy-milks/, "Mælk"], [/butters/, "Smør"],
  [/cheeses/, "Ost"], [/breads/, "Brød"], [/chocolates/, "Chokolade"], [/biscuits/, "Kiks"], [/ice-creams/, "Is"],
  [/sausages/, "Pølse"], [/hams/, "Skinke"], [/pizzas/, "Pizza"], [/pastas/, "Pasta"], [/rices/, "Ris"], [/chips/, "Chips"],
  [/breakfast-cereals|cereals/, "Morgenmadsprodukt"], [/coffees/, "Kaffe"], [/teas/, "Te"], [/beers/, "Øl"], [/red-wines/, "Rødvin"],
  [/white-wines/, "Hvidvin"], [/ketchups/, "Ketchup"], [/mayonnaises/, "Mayonnaise"], [/sauces/, "Sauce"], [/jams/, "Marmelade"],
  [/honeys/, "Honning"], [/oils/, "Olie"], [/eggs/, "Æg"], [/flours/, "Mel"], [/sugars/, "Sukker"], [/salts/, "Salt"],
];

const CATEGORY_RULES: [string, RegExp][] = [
  ["Frost", /\b(frost|dybfrost|frossen|frosne|frozen)\b/],
  ["Drikkevarer", /\b(sodavand|cola|juice|saft|vand|mineralvand|øl|pilsner|vin|rødvin|hvidvin|rosé|cider|energidrik|iste|smoothie|drik|kaffe|te|kakaodrik|tonic|sirup|spiritus|likør|whisky|vodka|gin|rom|beverages?|drinks?)\b/],
  ["Kød & fisk", /\b(hakket|oksekød|svinekød|kylling|kalkun|and|lam|kalv|bøf|steak|filet|medister|bacon|pølse|frikadelle|laks|torsk|rejer|fisk|tun|sild|makrel|skinke|flæsk|kotelet|meats?|fish)\b/],
  ["Mejeri & køl", /\b(mælk|ost|yoghurt|skyr|smør|fløde|creme fraiche|æg|kvark|kefir|tykmælk|pålæg|salami|leverpostej|margarine|mozzarella|feta|dairy|cheeses?)\b/],
  ["Brød & kager", /\b(brød|rugbrød|boller|bolle|kage|kager|tærte|croissant|wienerbrød|toast|knækbrød|kiks|rundstykke|muffin|tortilla|wrap|breads?|cakes?)\b/],
  ["Slik & snacks", /\b(slik|chokolade|chips|snack|vingummi|lakrids|bolsjer|popcorn|nødder|peanuts|riskiks|marcipan|karamel|vafler|flødeboller|snacks?|candies|chocolates?)\b/],
  ["Frugt & grønt", /\b(frugt|grønt|salat|tomat|agurk|banan|æble|kartoffel|løg|gulerod|peberfrugt|broccoli|svampe|avocado|citron|appelsin|jordbær|bær|fruits?|vegetables?)\b/],
  ["Mad fra hele verden", /\b(sushi|nudler|noodle|ramen|curry|taco|salsa|kokosmælk|soja|wok|thai|asiatisk|indisk|mexicansk)\b/],
];

// ---------------------------------------------------------------- chunks

type Chunk = {
  text: string;
  ck: string;
  removed: boolean;
};

function stripEdges(s: string): string {
  return s.replace(/^[\s"'„“”‚‘()[\]{},;:!?*•·]+/, "").replace(/[\s"'„“”‚‘()[\]{},;:!?*•·]+$/, "");
}

function chunkify(title: string): Chunk[] {
  const out: Chunk[] = [];
  for (const raw of title.split(/\s+/)) {
    // komma/semikolon midt i et ord ("hindbær,blåbær") deles; decimaltal (1,5) bevares
    const parts = raw.split(/[;]|,(?=\D)|(?<=\D),/);
    for (const part of parts) {
      let text = stripEdges(part);
      if (!text) continue;
      // et enkeltstående "." eller "-" er ikke et ord
      if (/^[-–—.\/&+]$/.test(text)) {
        if (text === "&" || text === "+") out.push({ text: "og", ck: "og", removed: false });
        continue;
      }
      // "m." / "u." forkortelser
      text = text.replace(/\.$/, (m) => (/^[mu]\.?$/i.test(text.replace(/\.$/, "")) ? "" : m));
      out.push({ text, ck: compactKey(text), removed: false });
    }
  }
  return out.filter((c) => c.ck.length > 0 || /%/.test(c.text));
}

const PERCENT_RE = /^(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?%$/;
const CHEESE_PLUS_RE = /^\d{2}\+$/;
const QTY_CHUNK_RE = /^(\d+(?:[.,]\d+)?)(kg|g|gr|gram|mg|ml|cl|dl|l|ltr|liter|stk|pcs|pk)$/i;

function liveChunks(chunks: Chunk[]): Chunk[] {
  return chunks.filter((c) => !c.removed);
}

function chunkRun(chunks: Chunk[], start: number, len: number): string {
  let s = "";
  for (let i = start; i < start + len; i++) s += chunks[i].ck;
  return s;
}

// ---------------------------------------------------------------- sprog

function detectLanguage(chunks: Chunk[], input: OffSplitInput, vocab: VocabIndex): { code: string; score: number } {
  if (input.translated) return { code: "da", score: 0.85 };
  if (input.hasDanishName) return { code: "da", score: 1 };
  const live = chunks.filter((c) => /[a-zæøåäöüé]/i.test(c.text));
  if (live.length === 0) return { code: "unknown", score: 0.6 };
  let danish = 0;
  let foreign = 0;
  for (const c of live) {
    const lower = c.text.toLowerCase();
    if (/ß/.test(lower)) foreign += 1;
    if (FOREIGN_WORDS.has(lower)) foreign += 1;
    if (/[æøå]/.test(lower)) danish += 1;
    else if (vocab.words.has(lower) || vocab.typeByCk.has(c.ck) || vocab.keywordByCk.has(c.ck)) danish += 0.7;
    else if (FUNCTION_WORDS.has(lower) && lower.length > 1) danish += 0.3;
  }
  const net = (danish - foreign * 1.4) / live.length;
  if (foreign >= 1 && net < 0.35) return { code: "foreign", score: 0.4 };
  if (net >= 0.5) return { code: "da", score: 0.95 };
  if (net >= 0.2) return { code: "da", score: 0.8 };
  if (clean(input.lang).toLowerCase() === "da") return { code: "da", score: 0.75 };
  return { code: "unknown", score: 0.65 };
}

// ---------------------------------------------------------------- produkttype

type TypeCandidate = {
  start: number;
  len: number;
  entry: VocabType | null;
  plural: boolean;
  via: "vocab" | "suffix" | "joined" | "category" | "guess" | "hint";
  text: string;
  score: number;
  /** sammensætning delt i for-led (til variation) og kendt type: "basilikum" + Pesto */
  prefix?: string;
};

function singularCandidates(ck: string): string[] {
  const out: string[] = [];
  for (const end of ["er", "r", "e", "ne", "en", "s"]) {
    if (ck.endsWith(end) && ck.length - end.length >= 3) out.push(ck.slice(0, -end.length));
  }
  // flertal med omlyd/ændring er ikke dækket; "er" → tom ("hvedeboller" → "hvedebolle" via "r")
  return out;
}

function typeFrequency(entry: VocabType, vocab: VocabIndex): number {
  return Math.log10(entry.n + 1) / Math.log10(vocab.maxTypeCount + 1);
}

// "X med Y": det foran "med/m./uden/u." er varen, resten er variation.
const HEAD_MARKERS = new Set(["med", "m", "uden", "u", "mod", "fyldt", "tilsat"]);

type TypeSearch = {
  cands: TypeCandidate[];
  /** de levende chunks foran første "med/uden"-led (hele navnet, hvis der ingen er) */
  head: Chunk[];
  hasMarker: boolean;
};

function findTypeCandidates(chunks: Chunk[], vocab: VocabIndex): TypeSearch {
  const live: number[] = [];
  chunks.forEach((c, i) => {
    if (!c.removed) live.push(i);
  });
  const view = live.map((i) => chunks[i]);
  const total = view.length;
  let headEnd = total;
  for (let i = 0; i < total; i++) {
    if (HEAD_MARKERS.has(view[i].ck)) {
      headEnd = i;
      break;
    }
  }
  const hasMarker = headEnd < total;
  const cands: TypeCandidate[] = [];
  for (let i = 0; i < total; i++) {
    for (let n = 1; n <= Math.min(5, total - i); n++) {
      const slice = view.slice(i, i + n);
      if (FUNCTION_WORDS.has(slice[0].ck) || FUNCTION_WORDS.has(slice[n - 1].ck)) continue;
      const ck = slice.map((c) => c.ck).join("");
      const text = slice.map((c) => c.text).join(" ");
      const outside = i + n > headEnd;
      let hit = vocab.typeByCk.get(ck);
      let plural = hit?.plural ?? false;
      if (!hit && n === 1) {
        for (const sing of singularCandidates(ck)) {
          const h = vocab.typeByCk.get(sing);
          if (h && h.entry.n >= 2) {
            hit = h;
            plural = true;
            break;
          }
        }
      }
      if (hit) {
        const coverage = n / total;
        const freq = typeFrequency(hit.entry, vocab);
        const edge = i === 0 || i + n === total ? 0.08 : 0;
        const right = i + n === Math.min(headEnd, total) ? 0.04 : 0;
        let score = 0.38 * coverage + 0.36 * freq + 0.06 * Math.min(1, n / 2) + edge + right + (n >= 2 ? 0.04 : 0);
        if (outside) score -= 0.45;
        cands.push({ start: live[i], len: n, entry: hit.entry, plural, via: "vocab", text, score });
        continue;
      }
      if (n === 1 && ck.length >= 8) {
        // sammensætning: "basilikumpesto" → for-led "basilikum" + kendt type "pesto"
        for (let l = Math.min(ck.length - 3, 14); l >= 4; l--) {
          const h = vocab.typeByCk.get(ck.slice(-l));
          if (h && h.entry.n >= 3 && !FUNCTION_WORDS.has(ck.slice(-l)) && ck.length - l >= 3) {
            const strong = h.entry.n >= 10;
            let score = strong
              ? 0.5 + 0.25 * typeFrequency(h.entry, vocab) + (total === 1 ? 0.12 : 0)
              : 0.3 + 0.12 * typeFrequency(h.entry, vocab) + (total === 1 ? 0.15 : 0);
            if (outside) score -= 0.45;
            let prefix: string | undefined;
            if (strong) {
              let pre = text.toLowerCase().slice(0, text.length - l);
              // samlefuge: "basilikums|pesto", "kylling|e|bryst" — behold kun hvis for-leddet genkendes uden
              const stripped = pre.replace(/[se]$/, "");
              if (pre !== stripped && (vocab.words.has(stripped) || vocab.typeByCk.has(compactKey(stripped)))) pre = stripped;
              prefix = pre.replace(/-$/, "");
            }
            cands.push({
              start: live[i], len: 1, entry: strong ? h.entry : null, plural: h.plural, via: "suffix", text, score, prefix,
            });
            break;
          }
        }
      }
      if (n === 2) {
        // "Kylling Inderfilet" ↔ kyllingeinderfilet / kyllinginderfilet
        const [a, b] = slice;
        for (const link of ["", "e", "s"]) {
          const joined = a.ck + link + b.ck;
          const h = vocab.typeByCk.get(joined);
          if (h) {
            let score = 0.42 + 0.2 * typeFrequency(h.entry, vocab) + (total === 2 ? 0.2 : 0);
            if (outside) score -= 0.45;
            cands.push({ start: live[i], len: 2, entry: h.entry, plural: h.plural, via: "joined", text, score });
            break;
          }
        }
      }
    }
  }
  cands.sort((x, y) => y.score - x.score || y.len - x.len);
  return { cands, head: view.slice(0, headEnd), hasMarker };
}

// ---------------------------------------------------------------- flag-udtræk

function emptyFilters(): OffSplitFilters {
  return {
    organic: null, glutenFree: null, lactoseFree: null, sugarFree: null, noAddedSugar: null, sweeteners: null,
    vegan: null, vegetarian: null, meatType: null, alcohol: null, alcoholPercent: null, fatPercent: null,
    countryOfOrigin: null, wholeGrain: null, animalWelfare: [], certifications: [], storage: null, decaf: null, cooked: null, raw: null,
  };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ---------------------------------------------------------------- hovedfunktion

export function splitOffProduct(input: OffSplitInput, vocab: VocabIndex): OffSplitResult {
  const issues: string[] = [];
  const filters = emptyFilters();
  const keywords: string[] = [];
  const labels = (input.labelsTags ?? []).map((t) => String(t).toLowerCase());
  const catTags = (input.categoriesTags ?? []).map((t) => String(t).toLowerCase());
  const allergens = (input.allergensTags ?? []).map((t) => String(t).toLowerCase());
  const ingredients = clean(input.ingredientsText).toLowerCase();
  const nutriments = input.nutriments ?? {};
  const catText = clean(input.categoriesText);

  const rawTitle = clean(input.name) || clean(input.genericName);
  if (!rawTitle) {
    return {
      version: OFF_SPLIT_VERSION, title: "", brand: null, brandKnown: false, extraBrands: [], subbrand: null,
      productType: null, productTypePlural: null, variant: null, keywords: [], packaging: null, category: null,
      quantityText: null, packCount: null, filters, confidence: 0, rawScore: 0,
      fieldScores: { brand: 0, type: 0, variation: 0, language: 0 }, language: "unknown", issues: ["mangler-navn"],
    };
  }
  const shouting = isAllCaps(rawTitle);
  const titleText = (shouting ? rawTitle.toLowerCase() : rawTitle).replace(/[®™©]/g, "");

  // ---- mængde
  const qtyOff = parseQuantity(input.quantity, input.productQuantity, input.productQuantityUnit);
  let quantityText: string | null = qtyOff?.text || null;
  let packCount: number | null = qtyOff?.packCount ?? null;
  if (qtyOff?.issue === "maengde-ikke-aflaest") issues.push("maengde-ikke-aflaest");

  const chunks = chunkify(titleText.replace(/(\p{L})\s*\/\s*(\p{L})/gu, "$1 og $2"));

  // MHD/datoer ("MHD 29.09.2026") hører ikke til nogen kolonne (brugerens regel 2026-10-11 punkt 5)
  chunks.forEach((c, i) => {
    if (c.ck === "mhd") {
      c.removed = true;
      const next = chunks[i + 1];
      if (next && /^\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?$/.test(next.text)) next.removed = true;
    }
  });

  // mængde i selve navnet (chunk "500g", "1,5 l", "6x33cl", "2 stk")
  const qtyInName: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const joined = QTY_CHUNK_RE.exec(c.ck.length ? c.text : "");
    const multi = /^(\d+)[x×](\d+(?:[.,]\d+)?)(kg|g|ml|cl|l)$/i.exec(c.text);
    if (multi) {
      qtyInName.push(`${multi[1]} x ${formatNumber(normalizeNumber(multi[2]))} ${multi[3].toLowerCase()}`);
      c.removed = true;
      continue;
    }
    if (joined) {
      const unit = UNIT_ALIASES[joined[2].toLowerCase()] ?? joined[2].toLowerCase();
      qtyInName.push(`${formatNumber(normalizeNumber(joined[1]))} ${unit}`);
      c.removed = true;
      continue;
    }
    // "0,8 %" → ét procent-chunk; "4 stk" → pakningsantal
    if (/^\d+(?:[.,]\d+)?$/.test(c.text) && i + 1 < chunks.length && chunks[i + 1].text === "%") {
      c.text = c.text + "%";
      c.ck = compactKey(c.text);
      chunks[i + 1].removed = true;
      i += 1;
      continue;
    }
    if (/^\d+$/.test(c.text) && i + 1 < chunks.length && /^(stk|stk\.|pcs|stykker|styk)$/i.test(chunks[i + 1].text)) {
      qtyInName.push(`${c.text} stk`);
      c.removed = true;
      chunks[i + 1].removed = true;
      i += 1;
      continue;
    }
    // "500 g" som to chunks
    if (/^\d+(?:[.,]\d+)?$/.test(c.text) && i + 1 < chunks.length) {
      const next = chunks[i + 1].text.toLowerCase().replace(/\.$/, "");
      if (UNIT_ALIASES[next] && ["kg", "g", "ml", "cl", "dl", "l"].includes(UNIT_ALIASES[next])) {
        qtyInName.push(`${formatNumber(normalizeNumber(c.text))} ${UNIT_ALIASES[next]}`);
        c.removed = true;
        chunks[i + 1].removed = true;
        i += 1;
      }
    }
  }
  if (qtyInName.length) {
    if (!quantityText) {
      quantityText = qtyInName[0];
      const m = /^(\d+) x /.exec(quantityText) ?? /^(\d+) stk$/.exec(quantityText);
      if (m) packCount = parseInt(m[1], 10);
    } else if (/ stk$/.test(qtyInName[0])) {
      if (packCount === null) packCount = parseInt(qtyInName[0], 10);
    } else if (quantityText !== qtyInName[0] && !quantityText.startsWith("ca.")) {
      issues.push("maengde-afviger-fra-navn");
    }
  }

  // ---- mærke
  const brandTokens = clean(input.brands)
    .split(/[,;]/)
    .map((s) => clean(s))
    .filter(Boolean);
  type BrandHit = { text: string; ck: string; vocab: VocabBrand | null };
  const hits: BrandHit[] = brandTokens.map((t) => ({ text: t, ck: compactKey(t), vocab: vocab.brandByCk.get(compactKey(t)) ?? null }));
  const isChainHit = (h: BrandHit) => h.vocab?.chain === true || CHAIN_WORDS.has(h.ck);
  let primary: BrandHit | null = null;
  primary = hits.find((h) => h.vocab && !isChainHit(h)) ?? null;
  if (!primary) primary = hits.find((h) => !isChainHit(h)) ?? null;
  if (!primary) primary = hits.find((h) => h.vocab) ?? hits[0] ?? null;
  let brandFromTitle = false;
  if (!primary) {
    // ingen OFF-brand: længste kendte mærke forrest i titlen
    const view = liveChunks(chunks);
    for (let n = Math.min(3, view.length - 1); n >= 1 && !primary; n--) {
      const ck = view.slice(0, n).map((c) => c.ck).join("");
      const v = vocab.brandByCk.get(ck);
      if (v && ck.length >= 3 && !v.chain) {
        primary = { text: v.name, ck, vocab: v };
        brandFromTitle = true;
      }
    }
  }
  const extraBrands = hits.filter((h) => h !== primary).map((h) => h.text);
  const brandName = primary ? (primary.vocab?.name ?? primary.text) : null;
  const brandKnown = !!primary?.vocab;

  // mærket (og evt. 2.-3. mærke) fjernes fra titlen
  const stripBrand = (ck: string) => {
    if (ck.length < 3) return;
    const view = chunks;
    for (let n = Math.min(5, view.length); n >= 1; n--) {
      for (let i = 0; i + n <= view.length; i++) {
        let all = true;
        for (let j = i; j < i + n; j++) if (view[j].removed) all = false;
        if (!all) continue;
        if (chunkRun(view, i, n) === ck) {
          for (let j = i; j < i + n; j++) view[j].removed = true;
        }
      }
    }
  };
  for (const h of hits) if (!CHAIN_WORDS.has(h.ck) || h === primary) stripBrand(h.ck);
  if (primary) stripBrand(primary.ck);

  // ---- sub brand
  let subbrand: string | null = null;
  let subbrandHint: { name: string; share: number } | null = null;
  if (primary) {
    // 2. mærke i OFF der er en kendt linje under 1. mærke
    for (const h of hits) {
      if (h === primary) continue;
      const s = vocab.subbrandByCk.get(h.ck);
      if (s && s.brandKeys.includes(primary.ck)) {
        subbrand = s.name;
        break;
      }
    }
    if (!subbrand) {
      const view = liveChunks(chunks);
      const first = chunks.findIndex((c) => !c.removed);
      for (let n = Math.min(3, view.length - 1); n >= 1 && first >= 0; n--) {
        const ck = view.slice(0, n).map((c) => c.ck).join("");
        const s = vocab.subbrandByCk.get(ck);
        const typeHit = vocab.typeByCk.get(ck);
        if (s && s.brandKeys.includes(primary.ck) && !(typeHit && typeHit.entry.n >= 3)) {
          subbrand = s.name;
          subbrandHint = s.topShare >= 50 && s.topType ? { name: s.topType, share: s.topShare } : null;
          let removed = 0;
          for (let i = first; i < chunks.length && removed < n; i++) {
            if (!chunks[i].removed) {
              chunks[i].removed = true;
              removed += 1;
            }
          }
          break;
        }
      }
    }
  }

  // ---- sprog (efter mærket er fjernet, så mærkeord ikke tæller som ordforråd)
  const lang = detectLanguage(liveChunks(chunks), input, vocab);

  // ---- flag: økologi, gluten, laktose, vegansk, sukker, frost, koffein, alkohol, fedt-%
  const lower = (c: Chunk) => c.text.toLowerCase();
  const consume = (pred: (c: Chunk, i: number) => boolean): boolean => {
    let hit = false;
    chunks.forEach((c, i) => {
      if (!c.removed && pred(c, i)) {
        c.removed = true;
        hit = true;
      }
    });
    return hit;
  };
  const phrase = (words: string[]): boolean => {
    // fjerner en frase af sammenhængende chunks (nøgler)
    const keys = words.map(compactKey);
    for (let i = 0; i + keys.length <= chunks.length; i++) {
      let ok = true;
      for (let j = 0; j < keys.length; j++) if (chunks[i + j].removed || chunks[i + j].ck !== keys[j]) ok = false;
      if (ok) {
        for (let j = 0; j < keys.length; j++) chunks[i + j].removed = true;
        return true;
      }
    }
    return false;
  };

  // Økologisk på flere sprog (compactKey: ö → ø, accenter fjernet). Dansk
  // "biologisk" er ikke økologi og tæller ikke.
  const orgWords = new Set([
    "økologisk", "økologiske", "øko", "økol", "økologi", "økologiskt", "bio", "organic",
    "økologisch", "økologische", "økologischer", "ekologisk", "ekologiska", "ekologiskt", "eko",
    "biologisch", "biologische", "biologique", "biologiques", "biologico", "biologica", "biologici", "biologiche",
    "ecologico", "ecologica", "organico", "organica", "ekologiczny", "ekologiczna", "ekologiczne", "luomu",
  ]);
  const orgInName = consume((c) => orgWords.has(c.ck));
  // sammensætning: "Økohavregryn" → "Havregryn"
  chunks.forEach((c) => {
    if (!c.removed && /^øko[a-zæøå]{4,}$/.test(c.ck) && !vocab.typeByCk.has(c.ck)) {
      c.text = ucFirst(c.text.replace(/^øko-?/i, ""));
      c.ck = compactKey(c.text);
      filters.organic = "Økologisk";
    }
  });
  const labOrg = labels.some((t) => /(^|:)(organic|eu-organic|dk-øko|ø-mærket|økologisk)|-bio-|^en:bio$|øko/.test(t) && !/non-eu-agriculture/.test(t));
  if (orgInName || labOrg) filters.organic = "Økologisk";
  if (orgInName && !labOrg && labels.length > 0) issues.push("oekologisk-kun-i-navn");

  const gfInName =
    consume((c) => ["glutenfri", "glutenfrit", "glutenfree", "glutenfrei"].includes(c.ck)) ||
    phrase(["uden", "gluten"]) ||
    phrase(["gluten", "fri"]) ||
    phrase(["gluten", "free"]);
  const gfLabel = labels.some((t) => /gluten-free|no-gluten|glutenfri|gluten-fri/.test(t));
  if (gfInName || gfLabel) {
    if (allergens.includes("en:gluten")) issues.push("glutenfri-men-allergen-gluten");
    else filters.glutenFree = "Glutenfri";
  }

  const lfInName =
    consume((c) => ["laktosefri", "laktosefrit", "lactosefree", "laktosefrei", "lactofree"].includes(c.ck)) ||
    phrase(["uden", "laktose"]) ||
    phrase(["lactose", "free"]);
  const lfLabel = labels.some((t) => /lactose-free|no-lactose|laktosefri|lactose-free/.test(t));
  if (lfInName || lfLabel) filters.lactoseFree = "Laktosefri";

  const veganInName = consume((c) => ["vegansk", "veganske", "vegan"].includes(c.ck));
  const plantInName = consume((c) => ["plantebaseret", "plantebaserede"].includes(c.ck));
  const vegetarInName = consume((c) => ["vegetarisk", "vegetariske", "vegetar"].includes(c.ck));
  const veganLabel = labels.some((t) => /(^|:)vegan$|european-vegetarian-union-vegan|the-vegan-society|v-label-international-vegan/.test(t));
  const vegLabel = labels.some((t) => /(^|:)vegetarian$|european-vegetarian-union$/.test(t));
  if (veganInName || veganLabel || plantInName) {
    if (allergens.includes("en:milk") || allergens.includes("en:eggs")) issues.push("vegansk-men-allergen-maelk-aeg");
    else {
      filters.vegan = "Vegansk";
      if (plantInName && !veganInName && !veganLabel) keywords.push("plantebaseret");
    }
  } else if (vegetarInName || vegLabel) {
    filters.vegetarian = "Vegetarisk";
  }

  // sukker
  const sugarVal = num(nutriments["sugars_100g"]);
  const sfInName =
    consume((c) => ["sukkerfri", "sukkerfrit", "sugarfree", "zuckerfrei", "sukkerfrie", "usødet", "usoedet"].includes(c.ck)) ||
    phrase(["zero", "sugar"]) ||
    phrase(["uden", "sukker"]) ||
    phrase(["sugar", "free"]) ||
    phrase(["no", "sugar"]);
  const nasInName =
    phrase(["uden", "tilsat", "sukker"]) ||
    phrase(["u", "tilsat", "sukker"]) ||
    phrase(["ikke", "tilsat", "sukker"]) ||
    phrase(["ingen", "tilsat", "sukker"]) ||
    phrase(["no", "added", "sugar"]) ||
    phrase(["u", "sukker"]);
  if (phrase(["med", "tilsat", "sukker"]) || phrase(["m", "tilsat", "sukker"])) keywords.push("med tilsat sukker");
  if (sfInName) {
    if (sugarVal !== null && sugarVal > 2.5) {
      filters.noAddedSugar = "Uden tilsat sukker";
      issues.push("sukkerfri-men-sukker-i-naering");
    } else {
      filters.sugarFree = "Sukkerfri";
    }
  } else if (nasInName || labels.some((t) => /no-added-sugar|no-sugar/.test(t))) {
    filters.noAddedSugar = "Uden tilsat sukker";
  }
  if (/sødestof|acesulfam|aspartam|sucralose|steviol|sweetener|süßungsmittel|cyklamat|saccharin|erythritol|xylitol/.test(ingredients)) {
    filters.sweeteners = "Sødestoffer";
  }

  if (consume((c) => c.ck === "fuldkorn")) filters.wholeGrain = "Fuldkorn";
  if (phrase(["tilsat", "kulsyre"]) || phrase(["med", "kulsyre"]) || phrase(["m", "kulsyre"])) keywords.push("med kulsyre");

  // certifikater (MSC, ASC, Fairtrade) renses ud som filter — ikke i type/variation
  const certs: string[] = [];
  for (const [ck, label] of [["msc", "MSC"], ["asc", "ASC"], ["fairtrade", "Fairtrade"]] as const) {
    if (consume((c) => c.ck === ck && liveChunks(chunks).length > 1)) certs.push(label);
  }
  filters.certifications = certs;

  // frost
  let frozenToken: string | null = null;
  const frozenInName = consume((c) => {
    const hit = ["frost", "frossen", "frosne", "frosset", "dybfrost", "frozen", "dybfrosne", "dybfrossen"].includes(c.ck);
    if (hit && !frozenToken && ["frossen", "frosne", "frosset"].includes(c.ck)) frozenToken = c.ck;
    return hit;
  });
  const frozenTag = catTags.some((t) => /frozen/.test(t));
  if (frozenInName || frozenTag) filters.storage = "Frost";

  // koffein
  if (consume((c) => ["koffeinfri", "koffeinfrit", "decaf", "koffeinfrie"].includes(c.ck)) || phrase(["uden", "koffein"])) {
    filters.decaf = "Koffeinfri";
  }

  // alkohol
  const alcVal = num(nutriments["alcohol_100g"]);
  const alcFreeInName =
    consume((c) => ["alkoholfri", "alkoholfrit", "alkoholfrie", "alkoholfrei", "alcoholfree"].includes(c.ck)) ||
    phrase(["uden", "alkohol"]) ||
    phrase(["alcohol", "free"]) ||
    phrase(["alkohol", "fri"]);
  const alcCategory = catTags.some((t) => /beer|wine|spirits|alcohol|liqueur|cider|vodka|whisky|rum|gin\b/.test(t)) ||
    /\b(øl|pilsner|vin|rødvin|hvidvin|cider|whisky|vodka|gin|rom|likør|lager)\b/i.test(titleText);

  // procenttegn: fedt, alkohol eller ingrediens
  const percents: { value: string; index: number }[] = [];
  chunks.forEach((c, i) => {
    if (!c.removed && PERCENT_RE.test(c.text)) percents.push({ value: c.text, index: i });
  });
  const fatContext = /mælk|fløde|creme|yoghurt|skyr|smør|margarine|\bost\b|ost$|hakket|kød|oksekød|svinekød|fars|medister|pålæg|kvark|tykmælk|yogurt|piskefløde|kærnemælk|ymer/i;
  for (const p of percents) {
    const c = chunks[p.index];
    const m = PERCENT_RE.exec(c.text);
    if (!m) continue;
    const value = normalizeNumber(m[1]);
    const nextWord = chunks[p.index + 1] && !chunks[p.index + 1].removed ? lower(chunks[p.index + 1]) : "";
    const prevWord = chunks[p.index - 1] ? lower(chunks[p.index - 1]) : "";
    if (alcCategory && !alcFreeInName && value <= 80 && filters.alcoholPercent === null && !/fedt|kakao|kød|frugt|indhold/.test(nextWord)) {
      filters.alcoholPercent = value;
      filters.alcohol = "Indeholder alkohol";
      c.removed = true;
      if (/^(alk|alc|alkohol|vol)\.?$/.test(nextWord)) chunks[p.index + 1].removed = true;
      continue;
    }
    if (/^(fedt|fat)$/.test(nextWord) || (fatContext.test(titleText) && !/kakao|kød|frugt|indhold|nougat|mandel|nødder|chokolade/.test(nextWord + " " + prevWord) && !m[2])) {
      if (filters.fatPercent === null) filters.fatPercent = value;
      c.removed = true;
      if (/^(fedt|fat)$/.test(nextWord)) chunks[p.index + 1].removed = true;
      continue;
    }
    // ingrediens-% ("70% kakao", "80% kød"): fjernes fra teksten, står stadig i originalen
    c.removed = true;
    if (nextWord && /^(kakao|kød|frugt|indhold|nougat|mandler|nødder|chokolade|juice|fedt|fat|oksekød|svinekød|laks|tun|tomat|kokos)$/.test(nextWord)) {
      chunks[p.index + 1].removed = true;
    }
  }
  if (alcFreeInName) filters.alcohol = "Alkoholfri";
  else if (!filters.alcohol && alcVal !== null && alcVal > 0.5) {
    filters.alcohol = "Indeholder alkohol";
    filters.alcoholPercent = Math.round(alcVal * 10) / 10;
  }

  // ost 45+
  let cheesePlus: string | null = null;
  chunks.forEach((c) => {
    if (!c.removed && CHEESE_PLUS_RE.test(c.text)) {
      cheesePlus = c.text;
      c.removed = true;
    }
  });

  // tilstand: røget/kogt/…  (bevarer ordets egen bøjning til titlen)
  let cookedWord: string | null = null;
  chunks.forEach((c) => {
    if (!c.removed && !cookedWord && COOKED_WORDS.includes(c.ck)) {
      // kun hvis der er flere ord tilbage (ellers er ordet selve varen)
      if (liveChunks(chunks).length > 1) {
        cookedWord = lower(c);
        c.removed = true;
      }
    }
  });
  if (cookedWord) filters.cooked = cookedWord;
  if (consume((c) => ["rå", "raa", "fersk", "ferske", "rå."].includes(c.ck) && liveChunks(chunks).length > 1)) filters.raw = "rå";

  if (consume((c) => c.ck === "light" && liveChunks(chunks).length > 1)) keywords.push("light");

  // oprindelsesland
  const originCountries: string[] = [];
  for (const t of input.originsTags ?? []) {
    const country = COUNTRY[String(t).replace(/^[a-z]{2}:/, "")];
    if (country && !originCountries.includes(country)) originCountries.push(country);
  }
  if (originCountries.length === 0) {
    if (consume((c) => ["dansk", "danske"].includes(c.ck) && liveChunks(chunks).length > 1) || labels.some((t) => /made-in-denmark|dk-/.test(t)))
      originCountries.push("Danmark");
  }
  if (originCountries.length === 0 && !/\bvin\b|rødvin|hvidvin|rosévin|champagne|cava|prosecco|crémant|vino\b/i.test(titleText)) {
    const live = liveChunks(chunks);
    for (let i = 0; i < live.length && live.length > 1; i++) {
      const country = ORIGIN_ADJECTIVES[live[i].ck];
      if (!country) continue;
      const next = live[i + 1];
      if (next && (vocab.typeByCk.has(live[i].ck + next.ck) || ORIGIN_STYLE_NOUNS.has(next.ck))) continue;
      live[i].removed = true;
      originCountries.push(country);
      break;
    }
  }
  if (originCountries.length) filters.countryOfOrigin = originCountries.slice(0, 3).join(" / ");

  // dyrevelfærd
  const welfare: string[] = [];
  if (consume((c) => ["skrabeæg", "skrabeæggene"].includes(c.ck))) welfare.push("Skrabeæg");
  for (const t of labels) {
    const m = /dyrevelf|animal-welfare|bedre-dyrevelfærd/.exec(t);
    if (m) welfare.push("Bedre dyrevelfærd");
  }
  filters.animalWelfare = Array.from(new Set(welfare));

  // ---- produkttype
  const remaining = liveChunks(chunks);
  let typeText: string | null = null;
  let typeEntry: VocabType | null = null;
  let typePlural = false;
  let typeVia: TypeCandidate["via"] | null = null;
  let typeScore = 0;
  let typeMargin = 1;
  let typePrefix: string | null = null;
  const consumed = new Set<number>();
  const search = findTypeCandidates(chunks, vocab);
  const headSet = new Set(search.head);
  const headWords = search.head.filter((c) => !FUNCTION_WORDS.has(c.ck) && /[a-zæøå]/i.test(c.text));
  const spanChunks = (cand: TypeCandidate): number[] => {
    const idx: number[] = [];
    for (let i = cand.start; i < chunks.length && idx.length < cand.len; i++) {
      if (!chunks[i].removed) idx.push(i);
    }
    return idx;
  };
  let chosen: TypeCandidate | null = search.cands[0] ?? null;
  if (chosen) {
    const top = chosen;
    const runnerUp = search.cands.find(
      (c) => c !== top && (c.entry?.name ?? c.text) !== (top.entry?.name ?? top.text) &&
        !(c.start >= top.start && c.start < top.start + top.len),
    );
    typeMargin = runnerUp ? top.score - runnerUp.score : 1;
    // et hit efter "med/uden" er variation; varen står i hovedet foran
    const inHead = spanChunks(top).every((i) => headSet.has(chunks[i]));
    if (!inHead && headWords.length > 0) chosen = null;
    // "Gifflar m. blåbær": hovedet er helt brugt på mærke/linje, så varen følger af linjen
    const brandHintEarly = primary?.vocab && primary.vocab.topShare >= 70 && primary.vocab.n >= 4 && primary.vocab.topType;
    if (!inHead && headWords.length === 0 && search.hasMarker && (subbrandHint || brandHintEarly)) chosen = null;
  }
  // OFF-kategori som fald-tilbage eller bekræftelse
  let categoryType: string | null = null;
  for (const t of catTags) {
    const hit = CATEGORY_TYPES.find(([re]) => re.test(t));
    if (hit) {
      categoryType = hit[1];
      break;
    }
  }
  if (!chosen && clean(input.genericName) && headWords.length === 0) {
    // evt. generic_name som anden kilde, når selve navnet ikke giver en type
    const g = findTypeCandidates(chunkify(clean(input.genericName).toLowerCase()), vocab).cands;
    if (g[0] && g[0].entry && g[0].score >= 0.7) {
      typeText = g[0].entry.name;
      typeEntry = g[0].entry;
      typeVia = "category";
      typeScore = 0.6;
      issues.push("type-fra-generic-name");
    }
  }
  if (chosen && !typeText) {
    spanChunks(chosen).forEach((i) => consumed.add(i));
    typeEntry = chosen.entry;
    typePlural = chosen.plural;
    typeVia = chosen.via;
    if (chosen.via === "vocab" || chosen.via === "joined") {
      typeText = chosen.entry!.name;
      if (chosen.plural && chosen.entry!.plural) typeText = chosen.entry!.plural;
      else if (chosen.plural) typeText = sentenceCase(chosen.text);
    } else if (chosen.via === "suffix" && chosen.entry && chosen.prefix) {
      typeText = chosen.plural && chosen.entry.plural ? chosen.entry.plural : chosen.entry.name;
      typePrefix = chosen.prefix;
    } else {
      typeText = sentenceCase(chosen.text);
    }
    const coverage = chosen.len / Math.max(1, remaining.length);
    const freq = chosen.entry ? typeFrequency(chosen.entry, vocab) : 0;
    if (chosen.via === "vocab") {
      typeScore = 0.55 + 0.3 * coverage + 0.15 * freq;
      if (chosen.len === remaining.length) typeScore = Math.min(1, typeScore + 0.1);
      if (chosen.entry && chosen.entry.n <= 1) typeScore -= 0.1;
    } else if (chosen.via === "joined") {
      typeScore = 0.55 + 0.2 * coverage;
    } else if (chosen.via === "suffix" && chosen.prefix) {
      typeScore = 0.68 + 0.15 * freq;
    } else {
      typeScore = 0.45;
    }
    typeScore = Math.max(0, Math.min(1, typeScore - (typeMargin < 0.08 ? 0.1 : 0)));
  }
  if (!typeText) {
    // fald-tilbage: kun ét ord = selve varen; ellers hovedets sidste ord; ellers OFF-kategorien
    const words = headWords.length ? headWords : liveChunks(chunks).filter((c) => !FUNCTION_WORDS.has(c.ck) && /[a-zæøå]/i.test(c.text));
    const brandHint =
      primary?.vocab && primary.vocab.topShare >= 70 && primary.vocab.n >= 4 && primary.vocab.topType
        ? { name: primary.vocab.topType, share: primary.vocab.topShare }
        : null;
    const hint = subbrandHint ?? brandHint;
    if (words.length === 0 && hint) {
      typeText = hint.name;
      typeVia = "hint";
      typeScore = 0.4 + 0.2 * (hint.share / 100);
      issues.push("type-fra-maerke");
    } else if (words.length === 0 && categoryType) {
      typeText = categoryType;
      typeVia = "category";
      typeScore = 0.5;
      issues.push("type-fra-off-kategori");
    } else if (words.length === 1 && hint && (vocab.words.get(words[0].text.toLowerCase()) ?? 0) >= 5 && !vocab.typeByCk.has(words[0].ck)) {
      typeText = hint.name;
      typeVia = "hint";
      typeScore = 0.4 + 0.2 * (hint.share / 100);
      issues.push("type-fra-maerke");
    } else if (words.length === 1) {
      typeText = sentenceCase(words[0].text);
      typeVia = "guess";
      typeScore = 0.5;
      consumed.add(chunks.indexOf(words[0]));
      issues.push("type-ikke-i-ordforraad");
    } else if (words.length >= 2) {
      const allUnknown = words.every((w) => !vocab.words.has(w.text.toLowerCase()) && !vocab.typeByCk.has(w.ck));
      if (allUnknown && words.length <= 3) {
        // "Osso buco", "Pulled pork": ukendt flerords-navn = selve varen
        typeText = sentenceCase(words.map((w) => w.text).join(" "));
        typeVia = "guess";
        typeScore = 0.4;
        words.forEach((w) => consumed.add(chunks.indexOf(w)));
        issues.push("type-ikke-i-ordforraad");
      } else {
        const last = words[words.length - 1];
        typeText = sentenceCase(last.text);
        typeVia = "guess";
        typeScore = 0.3;
        consumed.add(chunks.indexOf(last));
        issues.push("type-gaettet-sidste-ord");
      }
    }
  }
  if (categoryType && chosen && typeEntry && compactKey(categoryType) === compactKey(typeEntry.name)) {
    typeScore = Math.min(1, typeScore + 0.05);
  }

  if (typeText && /^instant kaffe$/i.test(typeText)) typeText = "Instantkaffe";

  // ---- variation og nøgleord af det der er tilbage
  const restChunks: Chunk[] = [];
  let prefixAt = 0;
  chunks.forEach((c, i) => {
    if (!c.removed && !consumed.has(i)) restChunks.push(c);
    else if (!c.removed && consumed.has(i) && typePrefix && restChunks.length >= 0 && prefixAt === 0 && chosen && i === chosen.start) {
      prefixAt = restChunks.length + 1; // 1-baseret: 0 = ikke sat
    }
  });
  // nøgleord i flere ord ("i skiver", "på dåse", "uden sten", "med kulsyre") og enkeltord fra nøgleordslisten
  const kwTaken = new Set<Chunk>();
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= restChunks.length; i++) {
      const slice = restChunks.slice(i, i + n);
      if (slice.some((c) => kwTaken.has(c))) continue;
      const ck = slice.map((c) => c.ck).join("");
      const kw = vocab.keywordByCk.get(ck);
      if (!kw) continue;
      const asVariationWord = n === 1 ? (vocab.words.get(slice[0].text.toLowerCase()) ?? 0) : 0;
      if (n === 1 && (kw.n < 3 || asVariationWord > kw.n)) continue;
      if (n === 1 && FUNCTION_WORDS.has(ck)) continue;
      slice.forEach((c) => kwTaken.add(c));
      if (!keywords.some((k) => compactKey(k) === ck)) keywords.push(kw.name.toLowerCase());
    }
  }
  // en revet/i blok-regel er i arkene (REGLER.md "Ost: revet og i blok"): behold som nøgleord, hvis fundet ovenfor
  let variationParts = restChunks.filter((c) => !kwTaken.has(c)).map((c) => lower(c));
  if (typePrefix) {
    // restChunks kan have mistet nøgleord foran sammensætningen — placér ud fra de ord, der står før den
    const before = prefixAt > 0 ? restChunks.slice(0, prefixAt - 1).filter((c) => !kwTaken.has(c)).length : 0;
    variationParts.splice(Math.min(before, variationParts.length), 0, typePrefix);
  }
  // forkortelser: "m." → med, "u." → uden
  variationParts = variationParts.map((w) => (w === "m" ? "med" : w === "u" ? "uden" : w));
  // dubletter, ord der allerede står i type/brand
  const known = new Set<string>();
  for (const w of (typeText ?? "").toLowerCase().split(/\s+/)) known.add(compactKey(w));
  for (const w of (brandName ?? "").toLowerCase().split(/\s+/)) known.add(compactKey(w));
  const seenWord = new Set<string>();
  variationParts = variationParts.filter((w) => {
    const k = compactKey(w);
    if (!k) return false;
    if (known.has(k) && k.length > 2) return false;
    if (seenWord.has(k) && !FUNCTION_WORDS.has(k)) return false;
    seenWord.add(k);
    return true;
  });
  if (typeText && /^kaffe$/i.test(typeText) && variationParts.includes("instant")) {
    typeText = "Instantkaffe";
    variationParts = variationParts.filter((w) => w !== "instant");
  }
  // ledetråde i kanten
  while (variationParts.length && ["og", "med", "i", "af", "på", "fra", "til", "uden"].includes(variationParts[variationParts.length - 1])) {
    variationParts.pop();
  }
  while (variationParts.length && ["og"].includes(variationParts[0])) variationParts.shift();
  let variant: string | null = variationParts.join(" ").replace(/\s+/g, " ").trim() || null;
  if (cheesePlus) variant = variant ? `${cheesePlus}, ${variant}` : cheesePlus;
  if (variant) variant = variant.replace(/,\s*,/g, ",");

  // ---- pakning
  let packaging: string | null = null;
  for (const t of input.packagingTags ?? []) {
    const p = OFF_PACKAGING[String(t).toLowerCase()];
    if (p) {
      packaging = p;
      break;
    }
  }

  // ---- kategori
  let category: string | null = typeEntry?.category || null;
  if (filters.storage === "Frost") category = "Frost";
  if (!category) {
    const hay = `${titleText} ${clean(input.genericName)} ${catText} ${catTags.join(" ")}`.toLowerCase();
    for (const [name, re] of CATEGORY_RULES) {
      if (re.test(hay)) {
        category = name;
        break;
      }
    }
  }
  if (!category) {
    category = "Kolonial";
    issues.push("kategori-ikke-afgjort");
  }

  // ---- kød
  const meatHay = `${titleText} ${typeText ?? ""} ${clean(input.genericName)} ${catTags.join(" ")}`.toLowerCase();
  const meatish = /kød|fisk|kylling|bøf|pølse|medister|bacon|skinke|laks|rejer|filet|okse|gris|kalv|lam\b|and\b|tun\b|meat|fish|poultry|sausage/.test(meatHay);
  if (meatish && filters.vegan === null) {
    const kinds = MEAT_KINDS.filter(([, re]) => re.test(meatHay)).map(([k]) => k);
    if (kinds.length) filters.meatType = kinds[0];
  }

  // Quantity = kun vægt/volumen; stk og "N x" står kun i Pack Count (brugerens regler 2026-10-11 punkt 1-3)
  if (quantityText) {
    const multi = /^(\d+) x (.+)$/.exec(quantityText);
    const pieces = /^(\d+(?:\.\d+)?) stk$/.exec(quantityText);
    if (multi) {
      if (packCount === null) packCount = parseInt(multi[1], 10);
      quantityText = multi[2];
    } else if (pieces) {
      if (packCount === null && Number.isInteger(parseFloat(pieces[1]))) packCount = parseInt(pieces[1], 10);
      quantityText = null;
    }
  }

  // ---- titel efter titelreglen (uden brand og mængde)
  const stateWord = filters.cooked ?? null;
  const frozenWord =
    filters.storage === "Frost"
      ? (frozenToken ?? (typePlural || /(er|e|ne)$/.test(compactKey(typeText ?? "")) ? "frosne" : "frosset"))
      : null;
  const flagWords: string[] = [];
  if (filters.decaf) flagWords.push("koffeinfri");
  if (filters.sugarFree) flagWords.push("sukkerfri");
  if (filters.glutenFree) flagWords.push("glutenfri");
  if (filters.lactoseFree) flagWords.push("laktosefri");
  if (filters.alcohol === "Alkoholfri") flagWords.push("alkoholfri");
  if (filters.vegan) flagWords.push("vegansk");
  const paren: string[] = [];
  if (filters.raw) paren.push(filters.raw);
  paren.push(...keywords);
  if (packaging && !paren.some((p) => compactKey(p) === compactKey(packaging!))) paren.push(packaging.toLowerCase());
  const bodyParts: string[] = [];
  if (frozenWord) bodyParts.push(frozenWord);
  if (stateWord) bodyParts.push(stateWord);
  if (typeText) bodyParts.push(bodyParts.length > 0 && !/^[A-ZÆØÅ]{2,}/.test(typeText) ? typeText.charAt(0).toLowerCase() + typeText.slice(1) : typeText);
  if (variant) bodyParts.push(variant);
  bodyParts.push(...flagWords);
  let title = bodyParts.join(" ").replace(/\s+/g, " ").trim();
  title = ucFirst(title.length && title === title.toUpperCase() ? title.toLowerCase() : title);
  if (paren.length) title = `${title} (${paren.join(", ")})`;

  // ---- sikkerhed
  const typeFieldScore = typeText ? typeScore : 0;
  let brandScore: number;
  if (primary && brandKnown && !brandFromTitle) brandScore = 0.97;
  else if (primary && brandFromTitle) brandScore = 0.85;
  else if (primary && !brandKnown) brandScore = brandTokens.length === 1 ? 0.9 : 0.75;
  else {
    brandScore = 0.55;
    issues.push("mangler-brand");
  }
  if (primary && !brandKnown) issues.push("brand-ukendt-i-arkene");
  if (extraBrands.length && !hits.every((h) => h === primary || isChainHit(h) || CHAIN_WORDS.has(h.ck))) issues.push("flere-maerker");

  // variation: andel ord vi kan forklare
  let variationScore = 1;
  if (variant) {
    const words = variant.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 1 && !FUNCTION_WORDS.has(w));
    if (words.length) {
      let explained = 0;
      for (const w of words) {
        const ck = compactKey(w);
        if (vocab.words.has(w) || vocab.typeByCk.has(ck) || vocab.keywordByCk.has(ck) || /^\d/.test(w) || /[æøå]/.test(w)) explained += 1;
        else if (singularCandidates(ck).some((s) => vocab.typeByCk.has(s))) explained += 0.7;
        else if (lang.code === "da") explained += 0.35;
      }
      variationScore = 0.45 + 0.55 * (explained / words.length);
      if (words.length > 5) {
        variationScore -= 0.1;
        issues.push("lang-variation");
      }
    }
  }
  if (!typeText) variationScore = 0.3;

  const lengthWords = titleText.split(/\s+/).length;
  let raw = 100 * (0.42 * typeFieldScore + 0.18 * brandScore + 0.2 * variationScore + 0.2 * lang.score);
  if (lang.code === "foreign") issues.push("ikke-dansk-navn");
  if (shouting) raw -= 2;
  if (lengthWords > 8) {
    raw -= 6;
    issues.push("langt-navn");
  }
  if (lengthWords === 1 && typeVia === "guess") raw -= 4;
  if (qtyOff?.issue === "maengde-ikke-aflaest") raw -= 1;
  if (issues.includes("maengde-afviger-fra-navn")) raw -= 3;
  if (issues.some((i) => i.startsWith("glutenfri-men") || i.startsWith("vegansk-men") || i === "sukkerfri-men-sukker-i-naering")) raw -= 5;
  raw = Math.max(0, Math.min(100, raw));

  const plural = typeEntry?.plural || null;
  return {
    version: OFF_SPLIT_VERSION,
    title,
    brand: brandName,
    brandKnown,
    extraBrands,
    subbrand,
    productType: typeText,
    productTypePlural: plural,
    variant,
    keywords,
    packaging,
    category,
    quantityText,
    packCount,
    filters,
    confidence: calibrate(raw),
    rawScore: Math.round(raw * 10) / 10,
    fieldScores: {
      brand: Math.round(brandScore * 100),
      type: Math.round(typeFieldScore * 100),
      variation: Math.round(variationScore * 100),
      language: Math.round(lang.score * 100),
    },
    language: lang.code,
    issues: Array.from(new Set(issues)),
  };
}

// Kalibrering: ukalibreret score → procent korrekte opdelinger i prøvesættet fra arkene
// (scripts/off-import/evaluate-split.mjs). Rækkefølge: stigende score.
// Målt 2026-10-11 på 2.286 rækker fra Bilka/REMA/SPAR, hvor navnet indeholder facit-typen
// (ordforråd bygget uden de rækker). Monotont glattet.
export const CALIBRATION: [score: number, percent: number][] = [
  [0, 0],
  [35, 3],
  [53, 25],
  [70, 35],
  [80, 45],
  [85, 58],
  [88, 62],
  [91, 76],
  [94, 82],
  [97, 92],
  [100, 96],
];

export function calibrate(score: number): number {
  const pts = CALIBRATION;
  if (score <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (score <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const t = x1 === x0 ? 0 : (score - x0) / (x1 - x0);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return pts[pts.length - 1][1];
}
