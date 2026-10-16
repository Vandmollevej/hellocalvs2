import { LABEL_CATEGORIES, cleanLabelsAnalysis, KNOWN_LABEL_KEYS, type DetectedLabel } from "./product-label-ai.ts";
import { tokenize } from "./spelling-engine.ts";

// Nattens engangsanalyse af det ubeskårne bagsidebillede (job
// "back-photo-scan", docs/DECISIONS.md 2026-10-15). Brugerens krav: "for at
// spotte certifikater som ikke findes på forsiden fx skal disse scannes om
// natten … Det skal også bruges til at finlæse teksten og køre udvidet
// stavekontrol mm." Ét AI-kald pr. billede læser både mærkerne og teksten.

export const BACK_PHOTO_PROMPT_VERSION = "back-photo-v1-2026-10-15";

const IMAGE_BOX_SCHEMA = {
  anyOf: [
    {
      type: "object",
      properties: { x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" } },
      required: ["x", "y", "width", "height"],
      additionalProperties: false,
    },
    { type: "null" },
  ],
};

export const BACK_PHOTO_SCHEMA = {
  type: "object",
  properties: {
    labels: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          name: { type: "string" },
          text: { type: ["string", "null"] },
          category: { type: "string", enum: [...LABEL_CATEGORIES] },
          box: IMAGE_BOX_SCHEMA,
          confidence: { type: "number" },
        },
        required: ["key", "name", "text", "category", "box", "confidence"],
        additionalProperties: false,
      },
    },
    ingredientsText: { type: ["string", "null"] },
    nutritionText: { type: ["string", "null"] },
    otherText: { type: ["string", "null"] },
    textConfidence: { type: "number" },
    overallConfidence: { type: "number" },
  },
  required: ["labels", "ingredientsText", "nutritionText", "otherText", "textConfidence", "overallConfidence"],
  additionalProperties: false,
};

export const BACK_PHOTO_SYSTEM = [
  "Du analyserer ét ubeskåret foto af BAGSIDEN/etiketten på en dagligvareemballage for Hello Cal (næringsdeklaration, ingrediensliste, små mærker). Billedet er i fuld opløsning; læs også den mindste tekst.",
  "1) labels: ALLE certificerings-, mærknings- og claims-ikoner på billedet — også små mærker i hjørner og ved stregkoden (Ø-mærke, EU-økologiblad, Nøglehul, Fuldkorn, MSC/ASC, Fairtrade, Rainforest Alliance, FSC, Svanen, Bedre Dyrevelfærd, V-Label, glutenfri-aks, pant, oprindelsesmærker). IKKE varens hovedlogo og IKKE genbrugs-/sorteringssymboler uden certificering.",
  "key = stabil nøgle i små bogstaver med bindestreger; brug nøglen fra listen over kendte mærker, når mærket findes dér. name = kort dansk visningsnavn. text = teksten på mærket (originalsprog) eller null. box = stramt rektangel om mærket i brøkdele 0-1 af billedet, eller null. confidence = 0-1.",
  "2) ingredientsText = ingredienslisten ordret, tegn for tegn, på originalsproget, uden overskriften ('Ingredienser:'), med store bogstaver, parenteser, procenter og E-numre præcis som trykt. Står listen på flere sprog, så kun den danske (ellers den første). null hvis der ingen ingrediensliste er.",
  "3) nutritionText = næringsdeklarationen ordret som linjer ('Energi 1496 kJ / 358 kcal' osv.), null hvis ingen. otherText = anden tekst af betydning (allergenadvarsler 'kan indeholde spor af …', opbevaring, producent, oprindelse), null hvis ingen.",
  "textConfidence = 0-1 hvor sikker du er på, at teksten er læst helt korrekt. Gæt aldrig et ord, du ikke kan læse; skriv det, du kan se, og sæt lav textConfidence.",
].join(" ");

export function backPhotoText({ productName, brand, step }: { productName: string; brand: string | null; step: string }) {
  const known = KNOWN_LABEL_KEYS.map((k) => `${k.key} = ${k.name}${k.hint ? ` (${k.hint})` : ""}`).join("; ");
  return [
    `Vare: ${productName}${brand ? ` (brand: ${brand})` : ""}.`,
    `Billedet blev taget på trinnet "${step === "ingredients" ? "indholdsfortegnelse" : "energi/næringsindhold"}".`,
    `Kendte mærker (brug disse nøgler når de passer): ${known}.`,
  ].join("\n");
}

export type BackPhotoAnalysis = {
  labels: DetectedLabel[];
  ingredientsText: string | null;
  nutritionText: string | null;
  otherText: string | null;
  textConfidence: number;
  overallConfidence: number;
};

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function unit(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

export function cleanBackPhotoAnalysis(value: unknown): BackPhotoAnalysis {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    labels: cleanLabelsAnalysis({ labels: raw.labels, overallConfidence: raw.overallConfidence }).labels,
    ingredientsText: cleanText(raw.ingredientsText, 4000),
    nutritionText: typeof raw.nutritionText === "string" && raw.nutritionText.trim() ? raw.nutritionText.trim().slice(0, 4000) : null,
    otherText: cleanText(raw.otherText, 2000),
    textConfidence: unit(raw.textConfidence),
    overallConfidence: unit(raw.overallConfidence),
  };
}

// Udvidet stavekontrol: varens gemte ingrediensliste holdes op mod den
// finlæste tekst. Ord, der står forskelligt samme sted i de to tekster (ét
// ord mod ét ord, og ordene ligner hinanden), bliver forslag. Teksterne skal
// overvejende være den samme liste, ellers sammenlignes intet.
export type FineReadFinding = { word: string; suggestion: string; start: number; end: number; similarity: number };

// Under denne andel fælles ord er det ikke samme liste (andet sprog, anden vare).
export const FINE_READ_MIN_OVERLAP = 0.6;
// Ord, der ligner hinanden mindre end dette, er ikke samme ord stavet forskelligt.
export const FINE_READ_MIN_SIMILARITY = 0.5;
export const FINE_READ_MAX_FINDINGS = 20;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

export function wordSimilarity(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  const longest = Math.max(x.length, y.length);
  return longest ? 1 - levenshtein(x, y) / longest : 1;
}

export function fineReadFindings(stored: string, fineRead: string): FineReadFinding[] {
  const a = tokenize(stored);
  const b = tokenize(fineRead);
  if (!a.length || !b.length) return [];
  const na = a.map((token) => token.text.toLowerCase());
  const nb = b.map((token) => token.text.toLowerCase());
  // Længste fælles delfølge af ord (listerne er korte: højst et par hundrede ord).
  const rows = na.length + 1;
  const cols = nb.length + 1;
  const table = new Uint16Array(rows * cols);
  for (let i = na.length - 1; i >= 0; i--) {
    for (let j = nb.length - 1; j >= 0; j--) {
      table[i * cols + j] = na[i] === nb[j] ? table[(i + 1) * cols + j + 1] + 1 : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }
  if (table[0] / Math.max(na.length, nb.length) < FINE_READ_MIN_OVERLAP) return [];

  const findings: FineReadFinding[] = [];
  let i = 0;
  let j = 0;
  let hunkA: number[] = [];
  let hunkB: number[] = [];
  const flush = () => {
    if (hunkA.length && hunkA.length === hunkB.length) {
      hunkA.forEach((indexA, offset) => {
        const word = a[indexA];
        const suggestion = b[hunkB[offset]].text;
        const similarity = wordSimilarity(word.text, suggestion);
        if (similarity >= FINE_READ_MIN_SIMILARITY && similarity < 1) {
          findings.push({ word: word.text, suggestion, start: word.start, end: word.end, similarity });
        }
      });
    }
    hunkA = [];
    hunkB = [];
  };
  while (i < na.length || j < nb.length) {
    if (i < na.length && j < nb.length && na[i] === nb[j]) {
      flush();
      i += 1;
      j += 1;
    } else if (j >= nb.length || (i < na.length && table[(i + 1) * cols + j] >= table[i * cols + j + 1])) {
      hunkA.push(i);
      i += 1;
    } else {
      hunkB.push(j);
      j += 1;
    }
  }
  flush();
  return findings.slice(0, FINE_READ_MAX_FINDINGS);
}
