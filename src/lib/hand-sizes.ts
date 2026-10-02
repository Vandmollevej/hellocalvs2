// Håndfrugter og æg i tre størrelser: Lille / Normal / Stor (S/M/L).
//
// Gælder frugt og snack-grøntsager, man spiser hele (æble, banan, gulerod …),
// samt æg. Størrelsen vælges i mængdevælgeren på produktsiden og sætter
// mængden til ét stk. i den valgte størrelse — se docs/DECISIONS.md
// 2026-10-02 og docs/HAND-SIZES.md.
//
// Gram er den spiselige del (uden skræl, kerne, sten eller æggeskal), fordi
// kalorierne pr. 100 g gælder den spiselige del. Målene er hele frugten:
// Ø for runde, længde × Ø for aflange. Repræsentative midtværdier fra
// handelsklasser (EU-ægklasser S/M/L) og USDA-referencevægte, afrundet.
//
// Koblingen sker på varens navn (første kommaled, fx "Æble" i Frida-navnet
// "Æble, med skræl, rå"), så der kræves ingen ny databasekolonne. Forarbejdede
// varer (tørret, juice, konserves …) får ingen størrelser.

export type HandSizeKey = "small" | "medium" | "large";

export type HandSize = {
  key: HandSizeKey;
  grams: number;
  // Længde i cm for aflange varer; null for runde.
  lengthCm: number | null;
  diameterCm: number;
};

export type HandSizeItem = {
  id: string;
  label: string;
  group: "fruit" | "vegetable" | "egg";
  // Navne (første kommaled), der kobles til varen. Små bogstaver.
  aliases: string[];
  // Ekstra ord, der udelukker varen ud over de fælles forarbejdningsord.
  exclude?: RegExp;
  // Æg må gerne være kogte/stegte; frugt og grønt kun rå.
  allowCooked?: boolean;
  sizes: [HandSize, HandSize, HandSize];
};

function round(id: string, label: string, group: HandSizeItem["group"], aliases: string[], s: [number, number], m: [number, number], l: [number, number]): HandSizeItem {
  return {
    id,
    label,
    group,
    aliases,
    sizes: [
      { key: "small", diameterCm: s[0], grams: s[1], lengthCm: null },
      { key: "medium", diameterCm: m[0], grams: m[1], lengthCm: null },
      { key: "large", diameterCm: l[0], grams: l[1], lengthCm: null },
    ],
  };
}

// [længde, Ø, gram]
function long(id: string, label: string, group: HandSizeItem["group"], aliases: string[], s: [number, number, number], m: [number, number, number], l: [number, number, number]): HandSizeItem {
  return {
    id,
    label,
    group,
    aliases,
    sizes: [
      { key: "small", lengthCm: s[0], diameterCm: s[1], grams: s[2] },
      { key: "medium", lengthCm: m[0], diameterCm: m[1], grams: m[2] },
      { key: "large", lengthCm: l[0], diameterCm: l[1], grams: l[2] },
    ],
  };
}

export const HAND_SIZE_ITEMS: HandSizeItem[] = [
  // Frugt — runde (Ø)
  round("apple", "Æble", "fruit", ["æble", "æbler"], [6.5, 120], [7.5, 165], [8.5, 230]),
  round("orange", "Appelsin", "fruit", ["appelsin", "appelsiner"], [6.5, 110], [7.5, 150], [8.5, 200]),
  round("mandarin", "Mandarin", "fruit", ["mandarin", "mandariner", "satsuma", "satsumas"], [5, 55], [6, 75], [7, 100]),
  round("clementine", "Klementin", "fruit", ["klementin", "klementiner", "clementin", "clementiner"], [5, 50], [5.5, 65], [6.5, 85]),
  round("peach", "Fersken", "fruit", ["fersken", "ferskner", "fladfersken", "fladferskner"], [6, 110], [7, 145], [8, 185]),
  round("nectarine", "Nektarin", "fruit", ["nektarin", "nektariner"], [5.5, 100], [6.5, 135], [7.5, 170]),
  round("plum", "Blomme", "fruit", ["blomme", "blommer"], [4, 40], [5, 60], [6, 85]),
  round("apricot", "Abrikos", "fruit", ["abrikos", "abrikoser"], [3.5, 25], [4.5, 35], [5.5, 50]),
  round("fig", "Figen (frisk)", "fruit", ["figen", "figner"], [4, 40], [5, 50], [6, 65]),
  round("persimmon", "Sharonfrugt / kaki", "fruit", ["sharonfrugt", "sharonfrugter", "kaki", "kakifrugt", "persimmon"], [6, 130], [7, 170], [8, 220]),
  // Frugt — aflange (længde × Ø)
  long("banana", "Banan", "fruit", ["banan", "bananer"], [16, 3.2, 100], [19, 3.5, 120], [22, 3.8, 140]),
  long("pear", "Pære", "fruit", ["pære", "pærer"], [8, 6, 130], [10, 6.5, 170], [12, 7.5, 230]),
  long("kiwi", "Kiwi", "fruit", ["kiwi", "kiwier", "kiwifrugt", "kiwifrugter"], [5.5, 4.5, 55], [6.5, 5, 70], [7.5, 5.5, 90]),
  // Snack-grøntsager
  long("carrot", "Gulerod", "vegetable", ["gulerod", "gulerødder"], [15, 2.5, 50], [18, 3, 70], [21, 3.5, 95]),
  long("snack-cucumber", "Snackagurk", "vegetable", ["snackagurk", "snackagurker", "minimagurk", "minimagurker", "miniagurk", "miniagurker"], [10, 2.5, 50], [13, 3, 70], [16, 3.5, 100]),
  long("snack-pepper", "Snackpeberfrugt", "vegetable", ["snackpeberfrugt", "snackpeberfrugter", "snack peberfrugt", "minipeberfrugt", "minipeberfrugter"], [7, 3, 20], [9, 3.5, 30], [11, 4, 40]),
  long("celery", "Bladselleri (stilk)", "vegetable", ["bladselleri", "selleristang", "selleristænger", "stilkselleri"], [20, 2, 30], [25, 2.5, 40], [30, 3, 60]),
  round("tomato", "Tomat", "vegetable", ["tomat", "tomater"], [5, 60], [6.5, 120], [8, 180]),
  // Æg (EU-klasser S/M/L; gram uden skal)
  {
    ...long("egg", "Æg", "egg", ["æg", "hønseæg", "høneæg"], [5.3, 4, 43], [5.7, 4.3, 50], [6, 4.5, 58]),
    allowCooked: true,
    exclude: /(hvide|blomme|pulver|salat|røræg|omelet|kage|nudl|pasta|vagtel|ande|gåse|struds)/i,
  },
];

// Forarbejdede varer, hvor stk.-størrelser ikke giver mening.
const PROCESSED = /(tørre|tørret|juice|saft|nektar\b|konserv|dåse|syltet|kompot|sirup|lage|mos\b|puré|pure\b|frost|frossen|frosne|chips|marmelade|syltetøj|smoothie|pulver|kage|tærte|is\b)/i;
const COOKED = /(kogt|stegt|bagt|grillet|dampet|ovnbagt)/i;
const LEADING_WORDS = /^(økologisk[e]?|øko|dansk[e]?|frisk[e]?|hel[e]?)\s+/;

function normalizeSegment(segment: string): string {
  let text = segment.trim().toLowerCase().replace(/\s+/g, " ");
  // Fjern "økologiske", "danske" osv. foran selve varen.
  for (let i = 0; i < 3 && LEADING_WORDS.test(text); i++) text = text.replace(LEADING_WORDS, "");
  return text;
}

export function findHandSizeItem(name?: string | null): HandSizeItem | null {
  if (!name) return null;
  const firstSegment = normalizeSegment(name.split(",")[0] ?? name);
  if (!firstSegment) return null;
  const item = HAND_SIZE_ITEMS.find((candidate) => candidate.aliases.includes(firstSegment));
  if (!item) return null;
  if (PROCESSED.test(name)) return null;
  if (!item.allowCooked && COOKED.test(name)) return null;
  if (item.exclude?.test(name)) return null;
  return item;
}

export function mediumHandSizeGrams(name?: string | null): number | null {
  return findHandSizeItem(name)?.sizes[1].grams ?? null;
}

// Billedets højde i forhold til det største billede: lineært efter gram,
// så "Lille" på 60 % af gram også står i 60 % af højden.
export function handSizeImageScale(size: HandSize, item: HandSizeItem): number {
  const largest = item.sizes[2].grams;
  return largest > 0 ? size.grams / largest : 1;
}

function formatCm(value: number): string {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(value);
}

// "Ø7,5 cm" for runde, "19 × Ø3,5 cm" for aflange.
export function formatHandSizeDimensions(size: HandSize): string {
  return size.lengthCm === null
    ? `Ø${formatCm(size.diameterCm)} cm`
    : `${formatCm(size.lengthCm)} × Ø${formatCm(size.diameterCm)} cm`;
}
