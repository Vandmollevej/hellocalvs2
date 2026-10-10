// "Tilføj egen måling" (Indstillinger → Visning → Forside): den grå tekst under
// tallet i tal-hjulet må højst have 2 linjer á 15 tegn (brugerkrav 2026-10-09).

export const CUSTOM_MEASURE_MAX_LINES = 2;
export const CUSTOM_MEASURE_MAX_LINE_LENGTH = 15;

/** Splitter en tekst i linjer og afkorter hver linje og antallet af linjer til grænserne. */
export function clampMeasureText(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .slice(0, CUSTOM_MEASURE_MAX_LINES)
    .map((line) => line.slice(0, CUSTOM_MEASURE_MAX_LINE_LENGTH))
    .join("\n");
}

/** Tekstens ikke-tomme linjer, klar til visning. */
export function measureTextLines(text: string): string[] {
  return clampMeasureText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Foreslår en tekst ud fra en etiket: ét ord pr. linje, hvis den ikke passer på
 * én linje, ellers hele etiketten på første linje.
 */
export function suggestMeasureText(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const full = words.join(" ");
  if (full.length <= CUSTOM_MEASURE_MAX_LINE_LENGTH) return full;
  const first: string[] = [];
  while (words.length > 0 && [...first, words[0]].join(" ").length <= CUSTOM_MEASURE_MAX_LINE_LENGTH) {
    first.push(words.shift() as string);
  }
  return clampMeasureText(`${first.join(" ")}\n${words.join(" ")}`);
}
