// WCAG 2.x-kontrast mellem to hex-farver (#RRGGBB). Bruges af designmanualen
// til at vise, om en tekstfarve kan læses på sin baggrund.

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((start) => parseInt(clean.slice(start, start + 2), 16));
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export type ContrastLevel = "AAA" | "AA" | "AA stor" | "Under AA";

// Stor tekst = mindst 24 px, eller mindst 18,66 px med fed vægt (WCAG 1.4.3).
export function contrastLevel(ratio: number, fontSizePx: number, fontWeight: number): ContrastLevel {
  const large = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
  if (ratio >= 7 || (large && ratio >= 4.5)) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (large && ratio >= 3) return "AA stor";
  return "Under AA";
}
