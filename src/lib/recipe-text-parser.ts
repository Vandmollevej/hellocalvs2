// Robot 1 til "Indsæt tekst" og "Scan" under Retter (brugerens krav
// 2026-10-07): læser en komplet opskriftstekst og trækker straks antal
// personer, ingredienser med mængde, fremgangsmåde (trin) og næringstabel ud.
// Ren funktion uden database og uden AI — samme resultat på telefon og server.

export type ParsedIngredient = {
  raw: string;
  name: string;
  amount: number | null;
  unit: string | null;
  // Omregnet til gram, når enheden kan det (g, kg, dl, spsk …); ellers null.
  grams: number | null;
};

export type ParsedNutrition = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  perServing: boolean;
};

export type ParsedRecipe = {
  title: string;
  servings: number | null;
  ingredients: ParsedIngredient[];
  steps: string[];
  nutrition: ParsedNutrition | null;
};

const INGREDIENT_HEADING = /^(ingredienser|ingredients|du skal bruge|det skal du bruge|ingredienser til \d+.*)\s*:?\s*$/i;
const STEPS_HEADING = /^(fremgangsmåde|fremgangsmaade|sådan gør du|saadan gør du|tilberedning|instructions|directions|method|trin)\s*:?\s*$/i;
const NUTRITION_HEADING = /^(næringsindhold|næringsdeklaration|næringsværdi|næringsværdier|nutrition|nutrition facts)\b.*$/i;
const SERVINGS = /(?:antal\s+(?:personer|portioner)\s*:?\s*|til\s+|serves\s+|portioner\s*:?\s*|personer\s*:?\s*)?(\d{1,2})\s*(?:personer|pers\.?|portioner|serveringer|servings|people)\b/i;
const SERVINGS_LABELLED = /^(?:antal\s+personer|antal\s+portioner|portioner|personer|serves|servings)\s*:?\s*(\d{1,2})\s*$/i;

const UNIT_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  kg: 1000,
  dl: 100,
  cl: 10,
  ml: 1,
  l: 1000,
  liter: 1000,
  spsk: 15,
  tsk: 5,
  knsp: 1,
  knivspids: 1,
};
// Enheder uden fast gramvægt; genkendes, så de ikke ender i ingrediensnavnet.
const OTHER_UNITS = ["stk", "dåse", "dåser", "fed", "bundt", "skive", "skiver", "pk", "pakke", "pakker", "håndfuld", "tern", "stilk", "stængel"];

const VULGAR: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

function parseNumber(token: string): number | null {
  const trimmed = token.trim();
  if (VULGAR[trimmed] !== undefined) return VULGAR[trimmed];
  const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

const AMOUNT_LINE = new RegExp(
  `^(\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?|\\d+/\\d+|[½¼¾⅓⅔])?\\s*(${[
    ...Object.keys(UNIT_GRAMS),
    ...OTHER_UNITS,
  ]
    .sort((a, b) => b.length - a.length)
    .join("|")})?\\.?\\s+(.+)$`,
  "i",
);

export function parseIngredientLine(rawLine: string): ParsedIngredient {
  const raw = rawLine.replace(/^[\s\-•*·–]+/, "").trim();
  const match = raw.match(AMOUNT_LINE);
  if (!match || (!match[1] && !match[2])) return { raw, name: raw, amount: null, unit: null, grams: null };
  // Intervaller ("2-3 dl") bruger det første tal.
  const amount = match[1] ? parseNumber(match[1].split(/[-–]/)[0]) : null;
  const unit = match[2] ? match[2].toLowerCase() : null;
  const name = match[3].replace(/^(af|fra)\s+/i, "").trim();
  const perUnit = unit ? UNIT_GRAMS[unit] : undefined;
  const grams = amount !== null && perUnit !== undefined ? Math.round(amount * perUnit * 10) / 10 : null;
  return { raw, name, amount, unit, grams };
}

function stripStepNumber(line: string) {
  return line.replace(/^\s*(?:trin\s*)?\d{1,2}\s*[.):-]\s*/i, "").replace(/^[\s\-•*·–]+/, "").trim();
}

function numberAfter(label: RegExp, text: string): number | null {
  const match = text.match(label);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function parseNutrition(lines: string[], headingLine: string): ParsedNutrition | null {
  const text = lines.join("\n");
  const kcal = numberAfter(/(\d+(?:[.,]\d+)?)\s*kcal/i, text) ?? numberAfter(/(?:energi|energy)[^\d\n]{0,12}(\d+(?:[.,]\d+)?)/i, text);
  const protein = numberAfter(/protein[^\d\n]{0,12}(\d+(?:[.,]\d+)?)/i, text);
  const carbs = numberAfter(/(?:kulhydrat(?:er)?|carbohydrates?|carbs)[^\d\n]{0,12}(\d+(?:[.,]\d+)?)/i, text);
  const fat = numberAfter(/(?:^|\n)\s*(?:fedt|fat)[^\d\n]{0,12}(\d+(?:[.,]\d+)?)/i, text);
  if (kcal === null && protein === null && carbs === null && fat === null) return null;
  return { kcal, protein, carbs, fat, perServing: /(pr\.?|per)\s*(portion|person|servering|serving)/i.test(`${headingLine}\n${text}`) };
}

export function parseRecipeText(input: string): ParsedRecipe {
  const lines = input.replace(/\r/g, "").split("\n").map((line) => line.trim());
  type Section = "head" | "ingredients" | "steps" | "nutrition";
  let section: Section = "head";
  const head: string[] = [];
  const ingredientLines: string[] = [];
  const stepLines: string[] = [];
  const nutritionLines: string[] = [];
  let nutritionHeading = "";
  let servings: number | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (INGREDIENT_HEADING.test(line)) {
      section = "ingredients";
      const inline = line.match(/\b(\d{1,2})\s*(personer|portioner)/i);
      if (inline && servings === null) servings = Number(inline[1]);
      continue;
    }
    if (STEPS_HEADING.test(line)) {
      section = "steps";
      continue;
    }
    if (NUTRITION_HEADING.test(line)) {
      section = "nutrition";
      nutritionHeading = line;
      continue;
    }
    const labelled = line.match(SERVINGS_LABELLED);
    if (labelled && servings === null) {
      servings = Number(labelled[1]);
      continue;
    }
    if (servings === null && section === "head") {
      const inline = line.match(SERVINGS);
      if (inline && line.length <= 40) {
        servings = Number(inline[1]);
        continue;
      }
    }
    if (section === "head") head.push(line);
    else if (section === "ingredients") ingredientLines.push(line);
    else if (section === "steps") stepLines.push(line);
    else nutritionLines.push(line);
  }

  // Uden nogen overskrifter: første linje er titlen, resten tolkes som trin.
  const title = (head[0] ?? "").replace(/^#+\s*/, "").slice(0, 120);
  const rest = head.slice(1);
  const steps = (stepLines.length > 0 ? stepLines : ingredientLines.length === 0 ? rest : [])
    .map(stripStepNumber)
    .filter(Boolean);

  return {
    title,
    servings,
    ingredients: ingredientLines.map(parseIngredientLine).filter((i) => i.name),
    steps,
    nutrition: nutritionLines.length > 0 ? parseNutrition(nutritionLines, nutritionHeading) : null,
  };
}
