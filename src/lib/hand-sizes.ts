// Håndfrugter og æg i tre størrelser: Lille / Normal / Stor (S/M/L).
//
// Gælder frugt og snack-grøntsager, man spiser hele (æble, banan, gulerod …),
// samt æg. Størrelsen vælges i mængdevælgeren på produktsiden og sætter
// mængden til ét stk. i den valgte størrelse — se docs/DECISIONS.md
// 2026-10-02 og docs/HAND-SIZES.md.
//
// Hver størrelse har hel vægt (som på køkkenvægten) og spiselig vægt. Den
// spiselige vægt = hel vægt minus USDA's spild-procent (skræl, sten,
// kernehus, skal) og er den, der registreres, fordi kalorier pr. 100 g gælder
// den spiselige del. Målene er hele varen: Ø for runde, længde × Ø for
// aflange. Repræsentative midtværdier fra handelsklasser (EU-ægklasser S/M/L)
// og USDA-referencevægte, afrundet.
//
// Koblingen sker på varens navn (første kommaled, fx "Æble" i Frida-navnet
// "Æble, med skræl, rå"), så der kræves ingen ny databasekolonne. Forarbejdede
// varer (tørret, juice, konserves …) får ingen størrelser.

export type HandSizeKey = "small" | "medium" | "large";

export type HandSize = {
  key: HandSizeKey;
  // Hele varen, som den vejer på køkkenvægten (med skræl, sten, skal …).
  wholeGrams: number;
  // Den spiselige del — det er den, der registreres og giver kalorierne.
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
  // Andel af hel vægt, der ikke spises (USDA "refuse"), og hvad det er.
  refusePercent: number;
  refuseKey: RefuseKey;
  // "USDA" når procenten er USDA's (SR Legacy); "skøn" når den ikke kunne
  // bekræftes.
  refuseSource: "USDA" | "skøn";
  // Ekstra ord, der udelukker varen ud over de fælles forarbejdningsord.
  exclude?: RegExp;
  // Æg må gerne være kogte/stegte; frugt og grønt kun rå.
  allowCooked?: boolean;
  sizes: [HandSize, HandSize, HandSize];
};

// Hvad der ikke spises; teksten står i i18n under addProduct.refuse.<nøgle>.
export type RefuseKey =
  | "core"
  | "peel"
  | "pit"
  | "stem"
  | "peelCalyx"
  | "topPeel"
  | "ends"
  | "stemSeeds"
  | "stemEnd"
  | "shell";

type Refuse = { percent: number; key: RefuseKey; source?: "USDA" | "skøn" };
type Base = Omit<HandSizeItem, "sizes" | "refusePercent" | "refuseKey" | "refuseSource">;

const KEYS: HandSizeKey[] = ["small", "medium", "large"];

function edible(wholeGrams: number, refusePercent: number): number {
  return Math.round(wholeGrams * (1 - refusePercent / 100));
}

function build(base: Base, refuse: Refuse, dims: [number | null, number, number][]): HandSizeItem {
  return {
    ...base,
    refusePercent: refuse.percent,
    refuseKey: refuse.key,
    refuseSource: refuse.source ?? "USDA",
    sizes: dims.map(([lengthCm, diameterCm, wholeGrams], index) => ({
      key: KEYS[index],
      lengthCm,
      diameterCm,
      wholeGrams,
      grams: edible(wholeGrams, refuse.percent),
    })) as [HandSize, HandSize, HandSize],
  };
}

// Runde: [Ø, hel vægt i g]
function round(base: Base, refuse: Refuse, s: [number, number], m: [number, number], l: [number, number]) {
  return build(base, refuse, [s, m, l].map(([d, g]) => [null, d, g] as [null, number, number]));
}

// Aflange: [længde, Ø, hel vægt i g]
function long(base: Base, refuse: Refuse, s: [number, number, number], m: [number, number, number], l: [number, number, number]) {
  return build(base, refuse, [s, m, l]);
}

export const HAND_SIZE_ITEMS: HandSizeItem[] = [
  // Frugt — runde (Ø)
  round({ id: "apple", label: "Æble", group: "fruit", aliases: ["æble", "æbler"] }, { percent: 10, key: "core" }, [6.5, 135], [7.5, 185], [8.5, 255]),
  round({ id: "orange", label: "Appelsin", group: "fruit", aliases: ["appelsin", "appelsiner"] }, { percent: 27, key: "peel" }, [6.5, 150], [7.5, 205], [8.5, 275]),
  round({ id: "mandarin", label: "Mandarin", group: "fruit", aliases: ["mandarin", "mandariner", "satsuma", "satsumas"] }, { percent: 26, key: "peel" }, [5, 75], [6, 100], [7, 135]),
  round({ id: "clementine", label: "Klementin", group: "fruit", aliases: ["klementin", "klementiner", "clementin", "clementiner"] }, { percent: 23, key: "peel" }, [5, 65], [5.5, 85], [6.5, 110]),
  round({ id: "peach", label: "Fersken", group: "fruit", aliases: ["fersken", "ferskner", "fladfersken", "fladferskner"] }, { percent: 4, key: "pit" }, [6, 115], [7, 150], [8, 195]),
  round({ id: "nectarine", label: "Nektarin", group: "fruit", aliases: ["nektarin", "nektariner"] }, { percent: 9, key: "pit" }, [5.5, 110], [6.5, 150], [7.5, 185]),
  round({ id: "plum", label: "Blomme", group: "fruit", aliases: ["blomme", "blommer"] }, { percent: 6, key: "pit" }, [4, 45], [5, 65], [6, 90]),
  round({ id: "apricot", label: "Abrikos", group: "fruit", aliases: ["abrikos", "abrikoser"] }, { percent: 7, key: "pit" }, [3.5, 30], [4.5, 40], [5.5, 55]),
  round({ id: "fig", label: "Figen (frisk)", group: "fruit", aliases: ["figen", "figner"] }, { percent: 1, key: "stem" }, [4, 40], [5, 50], [6, 65]),
  round({ id: "persimmon", label: "Sharonfrugt / kaki", group: "fruit", aliases: ["sharonfrugt", "sharonfrugter", "kaki", "kakifrugt", "persimmon"] }, { percent: 16, key: "peelCalyx" }, [6, 155], [7, 200], [8, 260]),
  // Frugt — aflange (længde × Ø)
  long({ id: "banana", label: "Banan", group: "fruit", aliases: ["banan", "bananer"] }, { percent: 36, key: "peel" }, [16, 3.2, 155], [19, 3.5, 185], [22, 3.8, 220]),
  long({ id: "pear", label: "Pære", group: "fruit", aliases: ["pære", "pærer"] }, { percent: 10, key: "core" }, [8, 6, 145], [10, 6.5, 190], [12, 7.5, 255]),
  long({ id: "kiwi", label: "Kiwi", group: "fruit", aliases: ["kiwi", "kiwier", "kiwifrugt", "kiwifrugter"] }, { percent: 14, key: "peel", source: "skøn" }, [5.5, 4.5, 65], [6.5, 5, 80], [7.5, 5.5, 105]),
  // Snack-grøntsager
  long({ id: "carrot", label: "Gulerod", group: "vegetable", aliases: ["gulerod", "gulerødder"] }, { percent: 11, key: "topPeel" }, [15, 2.5, 55], [18, 3, 80], [21, 3.5, 105]),
  long({ id: "snack-cucumber", label: "Snackagurk", group: "vegetable", aliases: ["snackagurk", "snackagurker", "minimagurk", "minimagurker", "miniagurk", "miniagurker"] }, { percent: 3, key: "ends" }, [10, 2.5, 50], [13, 3, 70], [16, 3.5, 105]),
  long({ id: "snack-pepper", label: "Snackpeberfrugt", group: "vegetable", aliases: ["snackpeberfrugt", "snackpeberfrugter", "snack peberfrugt", "minipeberfrugt", "minipeberfrugter"] }, { percent: 18, key: "stemSeeds" }, [7, 3, 25], [9, 3.5, 35], [11, 4, 50]),
  long({ id: "celery", label: "Bladselleri (stilk)", group: "vegetable", aliases: ["bladselleri", "selleristang", "selleristænger", "stilkselleri"] }, { percent: 11, key: "ends", source: "skøn" }, [20, 2, 35], [25, 2.5, 45], [30, 3, 65]),
  round({ id: "tomato", label: "Tomat", group: "vegetable", aliases: ["tomat", "tomater"] }, { percent: 9, key: "stemEnd" }, [5, 65], [6.5, 130], [8, 200]),
  // Æg: EU-klasserne S/M/L (under 53 g, 53–63 g, 63–73 g med skal)
  {
    ...long({ id: "egg", label: "Æg", group: "egg", aliases: ["æg", "hønseæg", "høneæg"] }, { percent: 12, key: "shell" }, [5.3, 4, 48], [5.7, 4.3, 58], [6, 4.5, 68]),
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

// Billedets højde i forhold til det største billede: lineært efter hel
// vægt, så "Lille" på 60 % af vægten også står i 60 % af højden.
export function handSizeImageScale(size: HandSize, item: HandSizeItem): number {
  const largest = item.sizes[2].wholeGrams;
  return largest > 0 ? size.wholeGrams / largest : 1;
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
