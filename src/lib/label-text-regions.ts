import { hasIngredientsHeading, isNutritionHeading, nutritionLineKind } from "@/lib/product-ocr";
import type { OcrBox, OcrLine } from "@/lib/product-ocr-prioritized";

// Finder næringstabellen og ingredienslisten på et kamerabillede ud fra
// OCR-linjernes placering (docs/DECISIONS.md 2026-09-28). Bruges på
// stregkodefotoet, energifotoet og indholdsfotoet: ordet "Ingredienser" (på
// regionernes sprog) udløser altid indholds-trinnet, og næringstabellen
// kræver mindst to forskellige tabelrækker. Boksene vises som en grøn ramme
// om tekstfeltet.

export type LabelRegions = { nutrition: OcrBox | null; ingredients: OcrBox | null };

// Linjer under denne sikkerhed er typisk baggrund (fliser, træ) eller støj.
const MIN_LINE_CONFIDENCE = 40;

function height(box: OcrBox) {
  return Math.max(1, box.y1 - box.y0);
}

function union(boxes: OcrBox[]): OcrBox {
  return {
    x0: Math.min(...boxes.map((box) => box.x0)),
    y0: Math.min(...boxes.map((box) => box.y0)),
    x1: Math.max(...boxes.map((box) => box.x1)),
    y1: Math.max(...boxes.map((box) => box.y1)),
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function overlapsHorizontally(a: OcrBox, b: OcrBox, tolerance: number) {
  return a.x0 <= b.x1 + tolerance && b.x0 <= a.x1 + tolerance;
}

// Næringstabellen: linjer, der er en tabelrække eller tabellens overskrift,
// grupperes lodret; gruppen med flest forskellige rækker vinder, og tal-
// kolonnen til højre for labels tages med.
function findNutrition(lines: OcrLine[]): OcrBox | null {
  const rows = lines
    .filter((line) => line.confidence >= MIN_LINE_CONFIDENCE)
    .map((line) => ({ line, kind: nutritionLineKind(line.text) }))
    .filter((row): row is { line: OcrLine; kind: NonNullable<typeof row.kind> } => row.kind !== null)
    .sort((a, b) => a.line.box.y0 - b.line.box.y0);
  if (rows.length < 2) return null;

  const lineHeight = median(rows.map((row) => height(row.line.box)));
  const groups: (typeof rows)[] = [];
  for (const row of rows) {
    const group = groups.at(-1);
    const bottom = group ? Math.max(...group.map((item) => item.line.box.y1)) : 0;
    if (group && row.line.box.y0 - bottom <= lineHeight * 3) group.push(row);
    else groups.push([row]);
  }
  const best = groups
    .map((group) => ({ group, kinds: new Set(group.map((row) => row.kind)) }))
    .filter(({ kinds }) => [...kinds].some((kind) => kind !== "heading") && kinds.size >= 2)
    .sort((a, b) => b.kinds.size - a.kinds.size)[0];
  if (!best) return null;

  const labels = union(best.group.map((row) => row.line.box));
  const width = labels.x1 - labels.x0;
  const values = lines.filter((line) => {
    const center = (line.box.y0 + line.box.y1) / 2;
    return (
      line.confidence >= MIN_LINE_CONFIDENCE &&
      center >= labels.y0 &&
      center <= labels.y1 &&
      line.box.x0 >= labels.x0 - width * 0.2 &&
      line.box.x1 <= labels.x1 + width * 1.5
    );
  });
  return union([labels, ...values.map((line) => line.box)]);
}

// Ingredienslisten: fra overskriften og nedad, så længe linjerne står tæt
// under hinanden i samme kolonne — og aldrig ind i næringstabellen.
function findIngredients(lines: OcrLine[], nutrition: OcrBox | null): OcrBox | null {
  const heading = lines.find((line) => line.confidence >= MIN_LINE_CONFIDENCE && hasIngredientsHeading(line.text));
  if (!heading) return null;
  const lineHeight = height(heading.box);
  let box = heading.box;
  const below = lines
    .filter((line) => line !== heading && line.box.y0 >= heading.box.y0 - lineHeight / 2)
    .sort((a, b) => a.box.y0 - b.box.y0);
  for (const line of below) {
    if (line.box.y0 - box.y1 > lineHeight * 1.6) break;
    if (!overlapsHorizontally(box, line.box, lineHeight / 2)) continue;
    if (isNutritionHeading(line.text)) break;
    if (nutrition && line.box.y0 >= nutrition.y0 && overlapsHorizontally(nutrition, line.box, 0)) break;
    box = union([box, line.box]);
  }
  return box;
}

export function findLabelRegions(lines: OcrLine[] | undefined): LabelRegions {
  if (!lines?.length) return { nutrition: null, ingredients: null };
  const nutrition = findNutrition(lines);
  return { nutrition, ingredients: findIngredients(lines, nutrition) };
}
