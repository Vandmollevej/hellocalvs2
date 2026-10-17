// Kvalitetskontrol af en aflæst ingrediensliste (docs/DECISIONS.md 2026-10-14).
// Brugerens test (kinesisk chilisauce): "SOIASAUCE", "SFSAMFRØ", "krydderler",
// "cltronsyre", citronsyre "E202" læst som "£202" og næringstabellens
// "Energi" læst som "Fnergi" med volapyk — alt sammen gemt uden at nogen
// opdagede det.
//
// Selve stavelogikken ligger i src/lib/spelling-engine.ts (samme motor som
// nattens stavekontrol-robot). Her bruges den, når en liste gemmes:
// - `fixes`: sikre rettelser, der laves automatisk.
// - `doubts`: mulige fejl, der ikke kan rettes sikkert. Telefonens egen
//   aflæsning bruges så ikke (AI læser billedet), og AI'ens aflæsning sættes
//   ned i sikkerhed, så den står på admin → Usikkerheder → Indhold. Nattens
//   robot lægger dem desuden på admin → Stavekontrol.
//
// Ingen imports med "@/": modulet testes direkte med node --test.

import {
  CURRENCY_E_NUMBER,
  SEED_DICTIONARY,
  applySafeCorrections,
  isJunkToken,
  nutritionTailStart,
  replaceAt,
  tokenize,
  type SpellingDictionary,
} from "./spelling-engine.ts";

export type IngredientTextReview = { text: string; fixes: string[]; doubts: string[] };

// AI-aflæsninger med tvivl får højst denne sikkerhed (under URGENT_BELOW = 0,7
// i src/lib/uncertainty-thresholds.ts → rød og øverst på Usikkerheder).
export const DOUBTFUL_INGREDIENTS_CONFIDENCE = 0.6;

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

// Brudstykker, der ikke er ord (":699k1", "ee") — se isJunkToken.
export function junkTokens(text: string): string[] {
  return tokenize(text)
    .map((token) => token.text)
    .filter(isJunkToken);
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

// Uden dansk ordbog: kun de sprogfrie rettelser (næringstabellen, E-numre).
function languageFreeCorrections(text: string, fixes: string[]): string {
  let result = text;
  const tail = nutritionTailStart(result);
  if (tail !== null) {
    fixes.push(`Næringstabellen fjernet ("${result.slice(tail).trim().slice(0, 30)}")`);
    result = replaceAt(result, tail, result.length, "");
  }
  const withE = result.replace(CURRENCY_E_NUMBER, (_m, digits: string) => `E${digits.toUpperCase()}`);
  if (withE !== result) fixes.push("E-nummer læst som £/€ rettet til E");
  return withE;
}

// Tegnsætning (brugerens fejlrapport 2026-10-17: "karamelE150d", "E338), ,
// naturlige", "aromaer(inkl."): dobbelte kommaer, manglende mellemrum før
// parentes/E-nummer og efter komma/parentes, mellemrum før komma/punktum.
// Rører ikke decimaltal ("1,5 %") eller E-nummer-varianter ("E160a(ii)").
export function normalizeIngredientPunctuation(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/,(?:\s*,)+/g, ",")
    .replace(/\(\s*[,;]\s*/g, "(")
    .replace(/\s*[,;]\s*\)/g, ")")
    .replace(/\(\s+/g, "(")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/(?<=\p{L}{2})\(/gu, " (")
    .replace(/(\p{Ll}{2})(E\d{3})/gu, "$1 $2")
    .replace(/([,;])(?=\p{L})/gu, "$1 ")
    .replace(/\)(?=[\p{L}\d])/gu, ") ")
    .trim();
}

export function reviewIngredientsText(
  raw: string,
  language?: string | null,
  dictionary: SpellingDictionary = SEED_DICTIONARY,
): IngredientTextReview {
  const fixes: string[] = [];
  const doubts: string[] = [];
  let text = raw.trim();
  if (!text) return { text, fixes, doubts };

  if (/^\s*(?:[EF][nm]erg[iq1l]|energy|næringsindhold|nutrition)/i.test(text)) {
    doubts.push("Listen starter med næringstabellen");
  }

  if (looksDanish(text, language)) {
    const result = applySafeCorrections(text, dictionary);
    text = result.text;
    fixes.push(...result.fixed);
    for (const finding of result.uncertain) {
      doubts.push(
        finding.reason === "junk" || finding.suggestion === ""
          ? `Volapyk i listen: "${finding.word}"`
          : finding.suggestion
            ? `Mulig stavefejl: "${finding.word}" → "${finding.suggestion}"?`
            : `Ukendt ord: "${finding.word}"`,
      );
    }
  } else {
    text = languageFreeCorrections(text, fixes);
    const junk = junkTokens(text);
    if (junk.length) doubts.push(`Volapyk i listen: ${junk.slice(0, 5).join(" ")}`);
  }

  const punctuated = normalizeIngredientPunctuation(text);
  if (punctuated !== text) {
    fixes.push("Tegnsætning rettet");
    text = punctuated;
  }

  const odd = text.match(ODD_CHARS);
  if (odd) doubts.push(`Usædvanligt tegn "${odd[0]}" i listen`);
  if (unbalancedParentheses(text)) doubts.push("Parenteserne går ikke op");
  const letters = text.replace(/[^\p{L}]/gu, "").length;
  if (letters < text.replace(/\s/g, "").length * 0.6) doubts.push("For få bogstaver — teksten ligner støj");

  return { text, fixes, doubts };
}

// Visning af lister, der blev gemt før kontrollen: de samme sikre rettelser;
// data i databasen ændres ikke (det gør nattens stavekontrol-robot).
export function displayIngredientsText(text: string): string {
  return reviewIngredientsText(text).text || text;
}
