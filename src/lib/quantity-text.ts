// Mængdetekst i arkenes stil (brugerens regel 2026-10-10, docs/REGLER.md →
// "Quantity i samme stil"): tal, mellemrum, enhed med småt — "1 l", "200 g",
// "6 x 0.33 l", "ca. 600 g"; aldrig "1l", "1Ltr" eller "200 g.".
// Decimaltegnet er punktum her; visningen lokaliserer det (DecimalText).

const UNITS: Record<string, string> = {
  kg: "kg", kilo: "kg", g: "g", gr: "g", "gr.": "g", gram: "g", mg: "mg",
  l: "l", ltr: "l", liter: "l", litre: "l", dl: "dl", cl: "cl", ml: "ml",
  stk: "stk", pcs: "stk", pc: "stk", "stk.": "stk",
};
const UNIT = "(kg|kilo|g|gr\\.?|gram|mg|ml|cl|dl|l|ltr|liter|litre|stk\\.?|pcs|pc)";
const NUM = "(\\d+(?:[.,]\\d+)?)";

function num(n: string): string {
  return String(Math.round(parseFloat(n.replace(",", ".")) * 1000) / 1000);
}

/** "1l" → "1 l", "500ML" → "500 ml", "6x33cl" → "6 x 33 cl", "1,5 Ltr." → "1.5 l". Andet returneres trimmet. */
export function formatQuantityText(text: string | null | undefined): string | null {
  const raw = text?.trim();
  if (!raw) return null;
  const t = raw.replace(/\.$/, "").trim();
  const multi = new RegExp(`^(\\d+)\\s*[x×]\\s*${NUM}\\s*${UNIT}$`, "i").exec(t);
  if (multi) return `${multi[1]} x ${num(multi[2])} ${UNITS[multi[3].toLowerCase()]}`;
  const single = new RegExp(`^(ca\\.?\\s*)?${NUM}\\s*${UNIT}$`, "i").exec(t);
  if (single) return `${single[1] ? "ca. " : ""}${num(single[2])} ${UNITS[single[3].toLowerCase()]}`;
  return raw;
}
