// Kvalitetskontrol af en aflæst ingrediensliste (docs/DECISIONS.md 2026-10-14).
// Brugerens test (kinesisk chilisauce): "SOYA" i stedet for "SOJA",
// citronsyre "E202" læst som "£202" og næringstabellens "Energi" læst som
// "Fnergi" — alt sammen gemt uden at nogen opdagede det.
//
// - `fixes`: sikre rettelser, der laves automatisk (E-nummer læst som £/€,
//   dansk stavning "soja", næringstabellen skåret fra listen).
// - `doubts`: tegn på fejllæsning, som ikke kan rettes sikkert. Telefonens
//   egen aflæsning bruges så ikke (AI læser billedet), og AI'ens aflæsning
//   sættes ned i sikkerhed, så den står på admin → Usikkerheder → Indhold.
//
// Ingen imports med "@/": modulet testes direkte med node --test.

export type IngredientTextReview = { text: string; fixes: string[]; doubts: string[] };

// AI-aflæsninger med tvivl får højst denne sikkerhed (under URGENT_BELOW = 0,7
// i src/lib/uncertainty-thresholds.ts → rød og øverst på Usikkerheder).
export const DOUBTFUL_INGREDIENTS_CONFIDENCE = 0.6;

const LETTER = "a-zA-ZæøåÆØÅäöüÄÖÜéÉèÈ";

// E-nummer, hvor OCR/AI har læst "E" som pund- eller eurotegn.
const CURRENCY_E_NUMBER = /[£€]\s?(\d{3,4}[a-d]?)(?![\d])/gi;

// Næringstabellen, der er læst med ind i listen — også OCR-varianter som
// "Fnergi"/"Enerqi" og tal med kJ/kcal.
const NUTRITION_START = new RegExp(
  `(?<![${LETTER}])(?:[EF][nm]erg[iq1l]|energy|næringsindhold|næringsværdi|næringsdeklaration|nutrition|gennemsnitlig næring)(?![${LETTER}])|\\d+(?:[.,]\\d+)?\\s?(?:kj|kcal)(?![${LETTER}])`,
  "i",
);

// Tegn, der aldrig står i en ingrediensliste.
const ODD_CHARS = /[£€$@#|\\~^{}_¤§]/;

// Ord, der kun findes i danske ingredienslister — afgør dansk stavning, når
// sproget ikke er oplyst (telefonens egen aflæsning).
const DANISH_WORDS =
  /(?<![a-zæøå])(?:ingredienser|sukker|vand|olie|hvede\w*|mælk\w*|krydderi\w*|eddike|hvidløg|stivelse|surhedsregulerende|konserveringsmiddel|farvestof|fortykningsmiddel|smagsforstærker|rapsolie|solsikkeolie|chili|citronsyre|salt|og|med)(?![a-zæøå])/giu;

export function looksDanish(text: string, language?: string | null): boolean {
  if (language) return /^(da|dan|dansk|danish)\b/i.test(language.trim());
  if (/[æøå]/i.test(text)) return true;
  return (text.match(DANISH_WORDS) ?? []).length >= 3;
}

// "soya" → "soja" med samme store/små bogstaver (SOYA → SOJA, Soyabønner → Sojabønner).
function danishSoja(text: string): string {
  return text.replace(new RegExp(`(?<![${LETTER}])(s)(o)(y)(a)`, "gi"), (_m, s, o, y, a) => `${s}${o}${y === "Y" ? "J" : "j"}${a}`);
}

function unbalancedParentheses(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth -= 1;
    if (depth < 0) return true;
  }
  return depth !== 0;
}

// Visning af lister, der blev gemt før kontrollen: kun de sikre tegnrettelser
// (E-nummer og dansk "soja"); data i databasen ændres ikke.
export function displayIngredientsText(text: string): string {
  const withE = text.replace(CURRENCY_E_NUMBER, (_m, digits: string) => `E${digits.toUpperCase()}`);
  return looksDanish(withE) ? danishSoja(withE) : withE;
}

export function reviewIngredientsText(raw: string, language?: string | null): IngredientTextReview {
  const fixes: string[] = [];
  const doubts: string[] = [];
  let text = raw.trim();
  if (!text) return { text, fixes, doubts };

  const nutrition = NUTRITION_START.exec(text);
  if (nutrition && nutrition.index > 0) {
    text = text.slice(0, nutrition.index).replace(/[\s,;:.–-]+$/u, "").trim();
    if (text && !/[.)]$/.test(text)) text += ".";
    fixes.push(`Næringstabellen skåret fra listen ("${nutrition[0]}")`);
  } else if (nutrition) {
    doubts.push(`Listen starter med næringstabellen ("${nutrition[0]}")`);
  }

  const withE = text.replace(CURRENCY_E_NUMBER, (_m, digits: string) => `E${digits.toUpperCase()}`);
  if (withE !== text) {
    fixes.push("E-nummer læst som £/€ rettet til E");
    text = withE;
  }

  if (looksDanish(text, language)) {
    const soja = danishSoja(text);
    if (soja !== text) {
      fixes.push('Dansk stavning: "soya" → "soja"');
      text = soja;
    }
  }

  const odd = text.match(ODD_CHARS);
  if (odd) doubts.push(`Usædvanligt tegn "${odd[0]}" i listen`);
  if (unbalancedParentheses(text)) doubts.push("Parenteserne går ikke op");
  const letters = text.replace(/[^\p{L}]/gu, "").length;
  if (letters < text.replace(/\s/g, "").length * 0.6) doubts.push("For få bogstaver — teksten ligner støj");

  return { text, fixes, doubts };
}
