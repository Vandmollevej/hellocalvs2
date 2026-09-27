// Lokal, gratis tekstgenkendelse af et kamerabillede (tesseract.js, kører i
// browseren) samt regex-parsing af en næringsdeklarations rå OCR-tekst. Bruges
// af det guidede auto-genkendelsesflow i /camera/create, jf. docs/DECISIONS.md:
// lokal OCR/regex forsøges altid først, AI-vision er kun sidste udvej.

export type ParsedNutrition = {
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

// Kører tesseract.js på et data-URL-billede og returnerer rå tekst. Dynamisk
// import, så biblioteket kun hentes i browseren og aldrig indgår i
// server-bundlen. `lang` skal udledes af brugerens REGION (se
// src/lib/regions.ts, regionToOcrLanguage), ikke af browserens/telefonens
// visningssprog — EU-lovgivning kræver indholdsdeklaration på det lokale
// sprog, uanset hvilket UI-sprog brugeren selv har valgt (docs/DECISIONS.md
// 2026-09-12).
export async function extractText(imageDataUrl: string, lang: string = "dan+eng"): Promise<string> {
  const { recognize } = await import("tesseract.js");
  const result = await recognize(imageDataUrl, lang);
  return result.data.text ?? "";
}

// Simpel heuristik for "har billedet overhovedet tekst" — bruges til at
// vælge mellem tekst-sporet (OCR + database-match) og det tekstløse spor
// (billedgenkendelse), jf. krav 2-3.
export function hasMeaningfulText(text: string): boolean {
  const letters = text.replace(/[^\p{L}\p{N}]/gu, "");
  return letters.length >= 4;
}

// Næringstabellens hovedlinjer på regionernes sprog (src/lib/regions.ts) +
// engelsk, inkl. typiske OCR-læsninger (ß -> B). Linjen skal STARTE med
// labelen, så underposter som "heraf mættede fedtsyrer" / "davon Zucker" /
// "of which saturates" aldrig læses som fedt eller kulhydrat, og
// "fettarme Milch" ikke er "Fett" (ordgrænse efter labelen).
const LABELS = {
  energy: ["energi", "energie", "energy", "brennwert", "énergie", "energia", "valor energético", "valor energetico", "energetische waarde"],
  fat: ["fedt", "fett", "fat", "vet", "vetten", "matières grasses", "matieres grasses", "lipides", "grassi", "grasas"],
  carbs: ["kulhydrat", "kulhydrater", "kolhydrat", "kolhydrater", "karbohydrat", "karbohydrater", "kohlenhydrate", "kohlenhydrat", "carbohydrate", "carbohydrates", "koolhydraten", "koolhydraat", "glucides", "carboidrati", "hidratos de carbono"],
  protein: ["protein", "proteiner", "eiweiß", "eiweiss", "eiweis", "eiweib", "eiwit", "eiwitten", "protéines", "proteines", "proteine", "proteínas", "proteinas"],
} as const;

type MacroKey = "fat" | "carbs" | "protein";

const NUMBER = "(\\d+(?:[.,]\\d+)?)";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Tabelkanter giver ofte et kort støjord foran labelen ("Så Fett 1,50",
// "3 Kohlenhydrate"), så ét ord på højst 3 tegn tillades først. Underposter
// starter med længere ord (heraf/davon/varav/dont/waarvan) eller ord, der
// ikke er labels ("of which", "di cui"), og rammes derfor ikke.
function lineStartPattern(labels: readonly string[]) {
  return new RegExp(
    `^[\\s\\-–•*·|]*(?:\\S{1,3}\\s+)?(?:${labels.map(escapeRegExp).join("|")})(?![\\p{L}])`,
    "iu",
  );
}

const LINE_START: Record<keyof typeof LABELS, RegExp> = {
  energy: lineStartPattern(LABELS.energy),
  fat: lineStartPattern(LABELS.fat),
  carbs: lineStartPattern(LABELS.carbs),
  protein: lineStartPattern(LABELS.protein),
};

// Underposter og øvrige linjer i tabellen. De læses kun efter tabellens
// første linje, så "Zucker"/"Salz" i ingredienslisten aldrig bliver tal.
const EXTRA_LABELS = {
  saturatedFatPer100g: ["mættede fedtsyrer", "mættet fedt", "mættede", "mettede fettsyrer", "mettet fett", "mättat fett", "mättade fettsyror", "gesättigte fettsäuren", "gesättigte", "gesåttigte", "saturates", "saturated fat", "saturated", "verzadigde vetzuren", "verzadigd", "acides gras saturés", "saturés", "acidi grassi saturi", "saturi", "saturadas", "saturados"],
  sugarsPer100g: ["sukkerarter", "sukker", "sockerarter", "socker", "zucker", "sugars", "sugar", "suikers", "suiker", "sucres", "zuccheri", "azúcares", "azucares"],
  saltPer100g: ["salt", "salz", "zout", "sel", "sale", "sal"],
  fiberPer100g: ["kostfibre", "kostfiber", "ballaststoffe", "voedingsvezel", "vezels", "fibres", "fibre", "fiber", "fibra"],
} as const;

type ExtraField = keyof typeof EXTRA_LABELS;

const EXTRA_PATTERN: Record<ExtraField, RegExp> = Object.fromEntries(
  Object.entries(EXTRA_LABELS).map(([field, labels]) => [
    field,
    new RegExp(`(?<![\\p{L}])(?:${labels.map(escapeRegExp).join("|")})(?![\\p{L}])`, "iu"),
  ]),
) as Record<ExtraField, RegExp>;

// Salt afrundes til to decimaler under 1 g (EU), de øvrige til én.
const EXTRA_MAX_DECIMALS: Record<ExtraField, number> = {
  saturatedFatPer100g: 1,
  sugarsPer100g: 1,
  saltPer100g: 2,
  fiberPer100g: 1,
};

function toNumber(text: string) {
  const value = parseFloat(text.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

// Tesseract læser ofte enheden "g" som 9 eller 0 ("1,5g" -> "1,50",
// "3,4g" -> "3,49"). Uden enhed og med flere decimaler end EU's
// afrundingsregler tillader (makroer: én, salt: to), eller over 100 g pr.
// 100 g, er sidste ciffer derfor enheden og fjernes.
function readMacroValue(rest: string, maxDecimals = 1): { value: number; corrected: boolean } | null {
  const match = new RegExp(`^[^0-9<]*?(<\\s*)?${NUMBER}\\s*(mg|g)?`, "iu").exec(rest);
  if (!match || match[1]) return null; // "<0,5 g" er en grænse, ikke en værdi
  let digits = match[2];
  const hasUnit = Boolean(match[3]);
  if (match[3]?.toLowerCase() === "mg") return null;
  let corrected = false;
  if (!hasUnit && /[90]$/.test(digits)) {
    const decimals = digits.split(/[.,]/)[1]?.length ?? 0;
    const whole = toNumber(digits) ?? 0;
    if (decimals > maxDecimals || (decimals === 0 && whole > 100)) {
      digits = digits.slice(0, -1).replace(/[.,]$/, "");
      corrected = true;
    }
  }
  const value = toNumber(digits);
  return value === null || value > 100 ? null : { value, corrected };
}

// "Energi 198 kJ / 47 kcal", "Brennwert kJ/kcal 198/47", "47 kcal" eller
// kun kJ (omregnes med EU's faktor 4,184).
function readEnergy(text: string): { kcal: number; kj: number | null } | null {
  const kcal = new RegExp(`${NUMBER}\\s*kcal`, "i").exec(text);
  const kjBefore = new RegExp(`${NUMBER}\\s*kj`, "i").exec(text);
  if (kcal) return { kcal: toNumber(kcal[1])!, kj: kjBefore ? toNumber(kjBefore[1]) : null };
  if (/kj\s*\/\s*kcal/i.test(text)) {
    const pair = new RegExp(`${NUMBER}\\s*/\\s*${NUMBER}`).exec(text.replace(/kj\s*\/\s*kcal/i, ""));
    if (pair) return { kcal: toNumber(pair[2])!, kj: toNumber(pair[1]) };
  }
  if (kjBefore) {
    const kj = toNumber(kjBefore[1])!;
    return { kcal: Math.round(kj / 4.184), kj };
  }
  return null;
}

export type DetailedNutritionParse = {
  values: Partial<ParsedNutrition> &
    Partial<Record<ExtraField, number>> & { energyKj?: number | null };
  // Tabellens kolonne: "pro 100 ml" / "pr. 100 g".
  basis: "100g" | "100ml" | "unknown";
  // Felter hvor et "g" læst som ciffer er fjernet — skal vises/tjekkes.
  corrected: (MacroKey | ExtraField)[];
  // Fedt x 9 + kulhydrat x 4 + protein x 4 ligger tæt på den læste kcal.
  plausible: boolean;
};

function readBasis(text: string): DetailedNutritionParse["basis"] {
  const explicit = /(?:pr\.?|per|pro|je|pour|por|\/)\s*100\s*(ml|g)/i.exec(text);
  const any = explicit ?? /100\s*(ml|g)(?![\p{L}])/iu.exec(text);
  if (!any) return "unknown";
  return any[1].toLowerCase() === "ml" ? "100ml" : "100g";
}

// Linjebaseret aflæsning af en næringstabel (pr. 100 g/ml-kolonnen er
// første tal efter labelen). Ren funktion — bruges af parseNutritionText og
// kan testes direkte mod rå OCR-tekst.
export function parseNutritionDetailed(rawText: string): DetailedNutritionParse {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const values: DetailedNutritionParse["values"] = {};
  const corrected: DetailedNutritionParse["corrected"] = [];
  let tableStarted = false;

  lines.forEach((line, index) => {
    if (values.kcalPer100g === undefined && (LINE_START.energy.test(line) || /kj\s*\/\s*kcal/i.test(line))) {
      // kcal står nogle gange på linjen under kJ — den oplyste kcal vinder
      // over en omregning fra kJ.
      const withNext = `${line} ${lines[index + 1] ?? ""}`;
      const energy = /kcal/i.test(line) ? readEnergy(line) : readEnergy(/kcal/i.test(withNext) ? withNext : line);
      if (energy && energy.kcal <= 900) {
        values.kcalPer100g = energy.kcal;
        values.energyKj = energy.kj;
        tableStarted = true;
      }
      return;
    }
    const macros: [MacroKey, keyof ParsedNutrition][] = [
      ["fat", "fatPer100g"],
      ["carbs", "carbsPer100g"],
      ["protein", "proteinPer100g"],
    ];
    for (const [key, field] of macros) {
      const start = LINE_START[key].exec(line);
      if (!start) continue;
      tableStarted = true;
      if (values[field] !== undefined) return;
      const read = readMacroValue(line.slice(start[0].length));
      if (read) {
        values[field] = read.value;
        if (read.corrected) corrected.push(key);
      }
      return;
    }
    if (!tableStarted) return;
    for (const field of Object.keys(EXTRA_PATTERN) as ExtraField[]) {
      if (values[field] !== undefined) continue;
      const hit = EXTRA_PATTERN[field].exec(line);
      if (!hit) continue;
      const read = readMacroValue(line.slice(hit.index + hit[0].length), EXTRA_MAX_DECIMALS[field]);
      if (read) {
        values[field] = read.value;
        if (read.corrected) corrected.push(field);
      }
      return;
    }
  });

  // Underposter kan ikke være større end deres hovedpost.
  if (values.saturatedFatPer100g !== undefined && (values.fatPer100g === undefined || values.saturatedFatPer100g > values.fatPer100g + 0.05)) {
    delete values.saturatedFatPer100g;
  }
  if (values.sugarsPer100g !== undefined && (values.carbsPer100g === undefined || values.sugarsPer100g > values.carbsPer100g + 0.05)) {
    delete values.sugarsPer100g;
  }

  // Reserve, når OCR har tabt "Energi"-labelen: første linje med kcal, som
  // ikke er referenceindtaget ("8400 kJ/2000 kcal").
  if (values.kcalPer100g === undefined) {
    const line = lines.find(
      (candidate) => /\d\s*kcal/i.test(candidate) && !/refer|erwachsen|voksen|vuxen|adult|\bri\b/i.test(candidate),
    );
    const energy = line ? readEnergy(line) : null;
    if (energy && energy.kcal <= 900) {
      values.kcalPer100g = energy.kcal;
      values.energyKj = energy.kj;
    }
  }

  const { kcalPer100g, fatPer100g, carbsPer100g, proteinPer100g } = values;
  let plausible = false;
  if (kcalPer100g !== undefined && fatPer100g !== undefined && carbsPer100g !== undefined && proteinPer100g !== undefined) {
    const atwater = 9 * fatPer100g + 4 * carbsPer100g + 4 * proteinPer100g;
    plausible =
      fatPer100g + carbsPer100g + proteinPer100g <= 102 &&
      Math.abs(atwater - kcalPer100g) <= Math.max(20, kcalPer100g * 0.2);
  }
  return { values, basis: readBasis(rawText), corrected, plausible };
}

// Returnerer alle fire pr.-100g-værdier, eller null hvis blot ét af dem ikke
// kunne udledes af den rå OCR-tekst, eller hvis tallene ikke hænger sammen
// (fedt x 9 + kulhydrat x 4 + protein x 4 skal ramme kcal inden for 20 %) —
// så overtager AI-vision.
export function parseNutritionText(rawText: string): ParsedNutrition | null {
  const { values, plausible } = parseNutritionDetailed(rawText);
  const { kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g } = values;
  if (
    !plausible ||
    kcalPer100g === undefined ||
    proteinPer100g === undefined ||
    carbsPer100g === undefined ||
    fatPer100g === undefined
  ) {
    return null;
  }
  return { kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g };
}

// Næring og ingredienser står ofte side om side på emballagen
// (docs/DECISIONS.md 2026-09-26). Finder ingredienslisten i OCR-teksten fra
// næringsfotoet: teksten efter en "Ingredienser:"-overskrift, frem til
// næringstabellen eller slutningen. null hvis der ikke er en tydelig liste.
const INGREDIENTS_HEADING =
  /(?:ingredienser|ingredients|ingrediensar|zutaten|ingrédients|ingrediënten|ingredienti|ingredientes|ainesosat|składniki)\s*:?/i;
// Næringstabellens start. Tesseract læser tit "Ä" som "Å" ("NÅHRWERTE"), og
// tyske tabeller starter med "Durchschnittliche Nährwerte".
const INGREDIENTS_END =
  /(?:næringsindhold|næringsdeklaration|næringsværdi|nutrition|näringsvärde|n[äåa]hrwert|durchschnittliche|brennwert|valeurs nutritionnelles|voedingswaarde|valori nutrizionali|informaci[óo]n nutricional)/i;

export function hasIngredientsHeading(rawText: string): boolean {
  return INGREDIENTS_HEADING.test(rawText);
}

export function findIngredientsSection(rawText: string): string | null {
  const text = rawText.replace(/\s+/g, " ");
  const heading = INGREDIENTS_HEADING.exec(text);
  if (!heading) return null;
  let section = text.slice(heading.index + heading[0].length);
  const end = INGREDIENTS_END.exec(section);
  if (end) section = section.slice(0, end.index);
  // OCR-støj efter listens afsluttende punktum ("Laktase. 1 ww") fjernes.
  section = section.trim().replace(/\.(?:\s+\S{1,2}){1,3}$/u, ".");
  return section.replace(/[^\p{L}]/gu, "").length >= 12 ? section : null;
}
