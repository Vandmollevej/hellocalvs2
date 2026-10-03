import type { ImageBox } from "@/lib/product-analysis-types";

// Mærkat-aflæsning af vareforsiden (docs/DECISIONS.md 2026-10-02): finder
// alle mærker/badges ud over hovedlogoet — laktosefri "-L", Haltungsform,
// QMilch, Øko, Nøglehul, MSC, Fairtrade, "uden tilsat sukker" osv. Kører kun
// i det natlige job "label-scan" (src/lib/product-label-scan.ts); det er
// lavere prioritet end selve scanningen og må ikke forsinke den.

export const LABELS_PROMPT_VERSION = "labels-v1-2026-10-02";

export const LABEL_CATEGORIES = [
  "DIET",
  "ORGANIC",
  "ANIMAL_WELFARE",
  "QUALITY",
  "SUSTAINABILITY",
  "HEALTH",
  "ORIGIN",
  "OTHER",
] as const;
export type LabelCategory = (typeof LABEL_CATEGORIES)[number];

export type DetectedLabel = {
  key: string;
  name: string;
  text: string | null;
  category: LabelCategory;
  box: ImageBox | null;
  confidence: number;
};

export type LabelsAnalysis = { labels: DetectedLabel[]; overallConfidence: number };

const IMAGE_BOX_SCHEMA = {
  anyOf: [
    {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
      },
      required: ["x", "y", "width", "height"],
      additionalProperties: false,
    },
    { type: "null" },
  ],
};

export const LABELS_SCHEMA = {
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
    overallConfidence: { type: "number" },
  },
  required: ["labels", "overallConfidence"],
  additionalProperties: false,
};

// Kendte mærker med faste nøgler, så samme mærke får samme nøgle på tværs
// af varer (og dermed kan filtreres og vises ens). Andre mærker får en
// nøgle AI'en selv danner (små bogstaver, bindestreger).
export const KNOWN_LABEL_KEYS: { key: string; name: string; category: LabelCategory; hint: string }[] = [
  { key: "lactose-free", name: "Laktosefri", category: "DIET", hint: "Laktosefri / Laktosefrei / Lactose free, ofte et '-L' i cirkel" },
  { key: "gluten-free", name: "Glutenfri", category: "DIET", hint: "Glutenfri / Glutenfrei / overstreget aks" },
  { key: "sugar-free", name: "Sukkerfri", category: "DIET", hint: "Sukkerfri / uden tilsat sukker / Zuckerfrei" },
  { key: "vegan", name: "Vegansk", category: "DIET", hint: "Vegan / V-Label vegan / vegansk" },
  { key: "vegetarian", name: "Vegetarisk", category: "DIET", hint: "Vegetarisk / V-Label vegetarian" },
  { key: "organic-eu", name: "EU-økologi", category: "ORGANIC", hint: "EU's grønne blad med stjerner" },
  { key: "organic-dk", name: "Ø-mærket", category: "ORGANIC", hint: "Det røde danske Ø-mærke / 'Statskontrolleret økologisk'" },
  { key: "organic-de", name: "Bio-Siegel", category: "ORGANIC", hint: "Det tyske sekskantede Bio-Siegel" },
  { key: "organic-krav", name: "KRAV", category: "ORGANIC", hint: "Svensk KRAV-mærke" },
  { key: "keyhole", name: "Nøglehulsmærket", category: "HEALTH", hint: "Grønt nøglehul (DK/SE/NO)" },
  { key: "whole-grain", name: "Fuldkornsmærket", category: "HEALTH", hint: "Orange fuldkornslogo" },
  { key: "nutri-score-a", name: "Nutri-Score A", category: "HEALTH", hint: "Nutri-Score med A fremhævet (brug b–e for de øvrige: nutri-score-b …)" },
  { key: "haltungsform-1", name: "Haltungsform 1 (Stall)", category: "ANIMAL_WELFARE", hint: "Tysk Haltungsform-skala med 1 fremhævet (brug haltungsform-2 … haltungsform-5)" },
  { key: "bedre-dyrevelfaerd-1", name: "Bedre Dyrevelfærd 1 hjerte", category: "ANIMAL_WELFARE", hint: "Dansk hjerte-mærke, 1-3 hjerter (bedre-dyrevelfaerd-2, -3)" },
  { key: "dyrenes-beskyttelse", name: "Anbefalet af Dyrenes Beskyttelse", category: "ANIMAL_WELFARE", hint: "" },
  { key: "free-range", name: "Fritgående", category: "ANIMAL_WELFARE", hint: "Fritgående / Freiland / Frilandsgris" },
  { key: "qmilch", name: "QMilch", category: "QUALITY", hint: "Tysk QM-Milch kvalitetsmærke (ko i cirkel, QMilch.info)" },
  { key: "qs", name: "QS-Prüfzeichen", category: "QUALITY", hint: "Tysk QS-mærke" },
  { key: "ohne-gentechnik", name: "Ohne Gentechnik", category: "QUALITY", hint: "Tysk 'Ohne GenTechnik' grønt mærke" },
  { key: "msc", name: "MSC", category: "SUSTAINABILITY", hint: "Blåt MSC-fiskemærke" },
  { key: "asc", name: "ASC", category: "SUSTAINABILITY", hint: "Grønt ASC-mærke" },
  { key: "fairtrade", name: "Fairtrade", category: "SUSTAINABILITY", hint: "" },
  { key: "rainforest-alliance", name: "Rainforest Alliance", category: "SUSTAINABILITY", hint: "Grøn frø" },
  { key: "fsc", name: "FSC", category: "SUSTAINABILITY", hint: "Emballagemærke" },
  { key: "svanemaerket", name: "Svanemærket", category: "SUSTAINABILITY", hint: "Nordisk svane" },
  { key: "pant", name: "Pant", category: "OTHER", hint: "Dansk pant A/B/C eller tysk Pfand" },
  { key: "dk-origin", name: "Dansk oprindelse", category: "ORIGIN", hint: "Dansk flag / 'Dansk' oprindelsesmærke" },
  { key: "de-origin", name: "Tysk oprindelse", category: "ORIGIN", hint: "'Aus Deutschland' / tysk flag" },
  { key: "se-origin", name: "Svensk oprindelse", category: "ORIGIN", hint: "'Från Sverige' / svensk flag" },
];

export const LABELS_SYSTEM = [
  "Du analyserer FORSIDEN af en dagligvareemballage for Hello Cal og finder ALLE mærkater, badges, certificeringsmærker og claims-ikoner — IKKE hovedlogoet/brandet og IKKE varens navn.",
  "Eksempler: laktosefri '-L'-cirkel, Haltungsform-skala, QMilch, Ø-mærke, EU-økologiblad, Nøglehul, Fuldkorn, Nutri-Score, MSC/ASC, Fairtrade, 'Ohne Gentechnik', pantmærke, oprindelsesflag, Bedre Dyrevelfærd-hjerter, 'uden tilsat sukker'.",
  "Reklame-/kampagneelementer (fx fodboldspillere, 'nyhed', konkurrencer) er ikke mærkater — udelad dem.",
  "key = stabil nøgle i små bogstaver med bindestreger. Brug nøglen fra listen over kendte mærker, når mærket findes dér (fx haltungsform-3 for Haltungsform med 3 fremhævet). Ellers dan en kort engelsk nøgle, fx 'no-added-salt'.",
  "name = kort dansk visningsnavn, fx 'Laktosefri' eller 'Haltungsform 3 (Frischluftstall)'.",
  "text = teksten præcis som den står på mærket (originalsprog), eller null når mærket er rent grafisk.",
  "category = DIET (laktose-/gluten-/sukkerfri, vegansk), ORGANIC, ANIMAL_WELFARE, QUALITY (kvalitetsmærker som QMilch/QS), SUSTAINABILITY (MSC, Fairtrade, Svanen, FSC), HEALTH (Nøglehul, Fuldkorn, Nutri-Score), ORIGIN (oprindelsesflag/-mærker), OTHER.",
  "box = rektangel om netop dette mærke i brøkdele 0-1 af billedets bredde/højde (x,y = øverste venstre hjørne). Boksen skal være stram om mærket, men medtage hele mærket. null hvis mærket ikke kan afgrænses.",
  "confidence = 0-1 hvor sikker du er på, at mærket faktisk er på emballagen OG er genkendt rigtigt.",
  "Returnér en tom liste, hvis der ingen mærkater er. Gæt ikke; sæt lav confidence på tvivlsomme fund.",
].join(" ");

export function labelsText({ productName, brand }: { productName: string; brand: string | null }) {
  const known = KNOWN_LABEL_KEYS.map((k) => `${k.key} = ${k.name}${k.hint ? ` (${k.hint})` : ""}`).join("; ");
  return [
    `Vare: ${productName}${brand ? ` (brand: ${brand})` : ""}.`,
    `Kendte mærker (brug disse nøgler når de passer): ${known}.`,
    "Find alle mærkater på forsiden.",
  ].join("\n");
}

function cleanBox(box: ImageBox | null): ImageBox | null {
  if (!box) return null;
  const values = [box.x, box.y, box.width, box.height].map(Number);
  if (values.some((v) => !Number.isFinite(v))) return null;
  const [x, y, width, height] = values;
  if (width <= 0.005 || height <= 0.005 || x < 0 || y < 0 || x > 1 || y > 1) return null;
  return { x, y, width: Math.min(width, 1 - x), height: Math.min(height, 1 - y) };
}

export function normalizeLabelKey(key: string): string {
  return key
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Rydder AI-svaret: gyldige nøgler, kategorier og bokse, én række pr. nøgle.
export function cleanLabelsAnalysis(value: unknown): LabelsAnalysis {
  const raw = (value ?? {}) as Partial<LabelsAnalysis>;
  const seen = new Set<string>();
  const labels: DetectedLabel[] = [];
  for (const item of Array.isArray(raw.labels) ? raw.labels : []) {
    const key = normalizeLabelKey(String(item?.key ?? ""));
    const name = String(item?.name ?? "").trim();
    if (!key || !name || seen.has(key)) continue;
    const confidence = Number(item?.confidence);
    if (!Number.isFinite(confidence) || confidence <= 0) continue;
    const category = LABEL_CATEGORIES.includes(item?.category as LabelCategory) ? (item.category as LabelCategory) : "OTHER";
    seen.add(key);
    labels.push({
      key,
      name: name.slice(0, 80),
      text: item?.text ? String(item.text).trim().slice(0, 120) : null,
      category,
      box: cleanBox(item?.box ?? null),
      confidence: Math.min(1, confidence),
    });
  }
  const overall = Number(raw.overallConfidence);
  return { labels, overallConfidence: Number.isFinite(overall) ? Math.max(0, Math.min(1, overall)) : 0 };
}
